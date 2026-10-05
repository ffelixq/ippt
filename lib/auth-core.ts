// Server-only authentication. There is deliberately no registration endpoint.
export const ACCOUNT_ID = 'felixdasumo';
export const SESSION_SECONDS = 30 * 24 * 60 * 60;
const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('');
export const digest = async (value: string) => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
export function validPasswordHash(value: string) { return /^pbkdf2-sha256\$100000\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(value); }
export async function passwordMatches(password: string, stored: string) {
  if (!validPasswordHash(stored)) throw new Error('Authentication is not configured.');
  const [, iterations, salt, expected] = stored.split('$');
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const actual = hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(salt.match(/../g)!, x => parseInt(x, 16)), iterations: +iterations }, key, 256));
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return difference === 0;
}
export function sameOrigin(req: Request) {
  return req.headers.get('origin') === new URL(req.url).origin && req.headers.get('sec-fetch-site') !== 'cross-site';
}
function cookieName(req: Request) {
  const url = new URL(req.url);
  return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? 'stride_session' : '__Host-stride_session';
}
function tokenFrom(req: Request) {
  const name = cookieName(req);
  const value = req.headers.get('cookie')?.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='))?.slice(name.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
function sessionCookie(req: Request, token: string, maxAge: number) {
  return `${cookieName(req)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${cookieName(req).startsWith('__Host-') ? '; Secure' : ''}`;
}
export function authResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, {status, headers: {'Cache-Control': 'private, no-store', 'Vary': 'Cookie', ...headers}});
}
async function readCredentials(req: Request) {
  if (!req.headers.get('content-type')?.startsWith('application/json')) return null;
  const reader = req.body?.getReader();
  if (!reader) return null;
  let size = 0, raw = '';
  const decoder = new TextDecoder();
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) { await reader.cancel(); return null; }
    raw += decoder.decode(value, {stream: true});
  }
  try {
    const value = JSON.parse(raw + decoder.decode());
    return typeof value.username === 'string' && value.username.length <= 100 && typeof value.password === 'string' && value.password.length <= 256 ? value as {username: string, password: string} : null;
  } catch { return null; }
}
export function createAuth(db: D1Database, passwordHash: string) {
  if (!validPasswordHash(passwordHash)) throw new Error('Authentication is not configured.');
  return {
    async session(req: Request, now = Date.now()) {
      const token = tokenFrom(req);
      if (!token) return null;
      const row = await db.prepare('SELECT expires_at FROM auth_sessions WHERE token_hash = ? AND credential_hash = ? AND expires_at > ?').bind(await digest(token), await digest(passwordHash), now).first<{expires_at: number}>();
      return row ? {userId: ACCOUNT_ID, expiresAt: row.expires_at} : null;
    },
    async login(req: Request, now = Date.now()) {
      if (!sameOrigin(req)) return authResponse({error: 'Invalid origin.'}, 403);
      const credentials = await readCredentials(req);
      if (!credentials) return authResponse({error: 'Enter your username and password.'}, 400);
      // Account-wide limits prevent bypass by changing username or IP address.
      // D1 batch serializes these increments, including concurrent requests.
      const windows = [{key: 'login:quarter-hour', seconds: 900, maximum: 5}, {key: 'login:day', seconds: 86400, maximum: 20}];
      const attempts = await db.batch<{attempts: number, reset_at: number}>(windows.map(w => db.prepare(`INSERT INTO auth_attempts (key, attempts, reset_at) VALUES (?, 1, ?)
        ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN reset_at <= ? THEN 1 ELSE attempts + 1 END,
        reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END RETURNING attempts, reset_at`).bind(w.key, now + w.seconds * 1000, now, now)));
      const limited = attempts.flatMap((r, i) => r.results[0].attempts > windows[i].maximum ? [r.results[0].reset_at] : []);
      if (limited.length) {
        const retry = Math.ceil((Math.max(...limited) - now) / 1000);
        return authResponse({error: 'Too many sign-in attempts. Please try again later.', retryAfter: retry}, 429, {'Retry-After': String(retry)});
      }
      const valid = await passwordMatches(credentials.password, passwordHash);
      if (!valid || credentials.username !== ACCOUNT_ID) return authResponse({error: 'Incorrect username or password.'}, 401);
      const token = hex(crypto.getRandomValues(new Uint8Array(32)));
      const expiresAt = now + SESSION_SECONDS * 1000;
      const previous = tokenFrom(req);
      await db.batch([
        db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ? OR token_hash = ?').bind(now, previous ? await digest(previous) : ''),
        db.prepare('INSERT INTO auth_sessions (token_hash, credential_hash, expires_at) VALUES (?, ?, ?)').bind(await digest(token), await digest(passwordHash), expiresAt),
        db.prepare('DELETE FROM auth_attempts'),
      ]);
      return authResponse({userKey: ACCOUNT_ID, expiresAt}, 200, {'Set-Cookie': sessionCookie(req, token, SESSION_SECONDS)});
    },
    async logout(req: Request) {
      if (!sameOrigin(req)) return authResponse({error: 'Invalid origin.'}, 403);
      const token = tokenFrom(req);
      if (token) await db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await digest(token)).run();
      return authResponse({ok: true}, 200, {'Set-Cookie': sessionCookie(req, '', 0)});
    },
  };
}
