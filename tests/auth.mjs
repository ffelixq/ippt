import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {pbkdf2Sync, randomBytes} from 'node:crypto';
import {registerHooks} from 'node:module';
import {ACCOUNT_ID, createAuth, digest, passwordMatches, SESSION_SECONDS} from '../lib/auth-core.ts';

// Exercise the actual SQL in SQLite, with the same atomic batch contract as D1.
const sqlite = new DatabaseSync(':memory:');
for (const name of ['0001_training.sql', '0002_auth.sql']) sqlite.exec(readFileSync(new URL('../migrations/' + name, import.meta.url), 'utf8'));
function prepare(sql) {
  let args = [];
  return {bind(...values) {args = values; return this;},
    async first() {return sqlite.prepare(sql).get(...args) ?? null;},
    async run() {const result = sqlite.prepare(sql).run(...args); return {success: true, meta: {changes: Number(result.changes)}, results: []};},
    execute() {
      if (/\bRETURNING\b/.test(sql)) return {success: true, results: sqlite.prepare(sql).all(...args), meta: {changes: 1}};
      const result = sqlite.prepare(sql).run(...args); return {success: true, results: [], meta: {changes: Number(result.changes)}};
    },
  };
}
const db = {prepare, async batch(statements) {sqlite.exec('BEGIN'); try {const out = statements.map(s => s.execute()); sqlite.exec('COMMIT'); return out;} catch(error) {sqlite.exec('ROLLBACK'); throw error;}}};
const password = randomBytes(12).toString('hex');
const salt = randomBytes(16);
const stored = `pbkdf2-sha256$100000$${salt.toString('hex')}$${pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex')}`;
const auth = createAuth(db, stored);
const origin = 'https://stride.example';
const req = (path, body, headers = {}, method = 'POST') => new Request(origin + path, {method, headers: {Origin: origin, 'Content-Type': 'application/json', ...headers}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
const credentials = {username: ACCOUNT_ID, password};
assert(await passwordMatches(password, stored));
assert.equal(await passwordMatches(password + 'x', stored), false);
assert.throws(() => createAuth(db, ''), /not configured/);
assert.equal((await auth.login(req('/api/auth/login', credentials, {Origin: 'https://evil.example'}))).status, 403);
assert.equal((await auth.login(req('/api/auth/login', credentials, {'sec-fetch-site': 'cross-site'}))).status, 403);
assert.equal((await auth.login(req('/api/auth/login', {username: ACCOUNT_ID, password: 'x'.repeat(3000)}))).status, 400);
assert.equal((await auth.login(req('/api/auth/login', {...credentials, username: 'another-user'}))).status, 401);
assert.equal(await auth.session(req('/api/state', undefined, {'oai-authenticated-user-id': ACCOUNT_ID}, 'GET')), null);
const now = Date.now();
const signedIn = await auth.login(req('/api/auth/login', credentials), now);
assert.equal(signedIn.status, 200);
const cookie = signedIn.headers.get('set-cookie');
for (const part of ['__Host-stride_session=', 'HttpOnly', 'SameSite=Strict', 'Secure', 'Path=/']) assert(cookie.includes(part));
const token = cookie.split(';')[0].split('=')[1];
assert.match(token, /^[a-f0-9]{64}$/);
const record = sqlite.prepare('SELECT * FROM auth_sessions').get();
assert.notEqual(record.token_hash, token);
assert.equal(record.token_hash, await digest(token));
const sessionRequest = req('/api/state', undefined, {Cookie: cookie.split(';')[0]}, 'GET');
assert.equal((await auth.session(sessionRequest, now)).userId, ACCOUNT_ID);
assert.equal(await auth.session(sessionRequest, now + SESSION_SECONDS * 1000), null);
assert.equal(await auth.session(req('/api/state', undefined, {Cookie: '__Host-stride_session=' + '0'.repeat(64)}, 'GET')), null);
assert.equal(await createAuth(db, stored.slice(0, -1) + (stored.endsWith('0') ? '1' : '0')).session(sessionRequest), null);
assert.equal((await auth.logout(req('/api/auth/logout', undefined, {Cookie: cookie, Origin: 'https://evil.example'}))).status, 403);
assert(await auth.session(sessionRequest));
const signedOut = await auth.logout(req('/api/auth/logout', undefined, {Cookie: cookie}));
assert.equal(signedOut.status, 200);
assert(signedOut.headers.get('set-cookie').includes('Max-Age=0'));
assert.equal(await auth.session(sessionRequest), null);

// Parallel guesses cannot evade account-wide limits by changing IP or username.
const guesses = await Promise.all(Array.from({length: 9}, (_, i) => auth.login(req('/api/auth/login', {username: 'guess-' + i, password: 'wrong'}, {'CF-Connecting-IP': '192.0.2.' + i}), now)));
assert.equal(guesses.filter(r => r.status === 401).length, 5);
assert.equal(guesses.filter(r => r.status === 429).length, 4);
assert.equal(guesses.find(r => r.status === 429).headers.get('Retry-After'), '900');
assert.equal((await auth.login(req('/api/auth/login', credentials), now + 900001)).status, 200);
sqlite.exec('DELETE FROM auth_attempts');
for (let i = 0; i < 20; i++) assert.equal((await auth.login(req('/api/auth/login', {username: ACCOUNT_ID, password: 'wrong'}), now + i * 900001)).status, 401);
assert.equal((await auth.login(req('/api/auth/login', credentials), now + 20 * 900001)).status, 429);
assert.equal((await auth.login(req('/api/auth/login', credentials), now + 86400001)).status, 200);
sqlite.exec('DELETE FROM auth_attempts');

// Route-level checks: authenticated identity, no forged Sites headers, and
// preservation of the optimistic-concurrency guard on saved training.
globalThis.__strideTestEnv = {DB: db, STRIDE_PASSWORD_HASH: stored};
registerHooks({resolve(specifier, context, next) {
  if (specifier === 'cloudflare:workers') return {url: 'data:text/javascript,export const env = globalThis.__strideTestEnv;', shortCircuit: true};
  if (specifier.startsWith('@/')) return next(new URL('../' + specifier.slice(2) + '.ts', import.meta.url).href, context);
  return next(specifier, context);
}});
const stateRoute = await import('../app/api/state/route.ts');
const loginRoute = await import('../app/api/auth/login/route.ts');
const sessionRoute = await import('../app/api/auth/session/route.ts');
const {initial} = await import('../lib/data.ts');
assert.equal((await stateRoute.GET(req('/api/state', undefined, {'oai-authenticated-user-id': ACCOUNT_ID}, 'GET'))).status, 401);
assert.equal((await stateRoute.PUT(req('/api/state', {data: initial, userKey: ACCOUNT_ID, version: 0}))).status, 401);
const login = await loginRoute.POST(req('/api/auth/login', credentials));
const headers = {Cookie: login.headers.get('set-cookie').split(';')[0]};
assert.equal((await sessionRoute.GET(req('/api/auth/session', undefined, headers, 'GET'))).status, 200);
const payload = {data: structuredClone(initial), userKey: ACCOUNT_ID, version: 0};
assert.equal((await stateRoute.PUT(req('/api/state', payload, {...headers, Origin: 'https://evil.example'}))).status, 403);
assert.equal((await stateRoute.PUT(req('/api/state', {...payload, userKey: 'other'}, headers))).status, 409);
assert.equal((await stateRoute.PUT(req('/api/state', payload, headers))).status, 200);
assert.equal((await stateRoute.PUT(req('/api/state', payload, headers))).status, 409);
const saved = await stateRoute.GET(req('/api/state', undefined, headers, 'GET'));
assert.equal(saved.headers.get('Cache-Control'), 'private, no-store');
assert.deepEqual((await saved.json()).data, initial);
globalThis.__strideTestEnv.STRIDE_PASSWORD_HASH = '';
assert.equal((await loginRoute.POST(req('/api/auth/login', credentials))).status, 503);
assert.equal((await stateRoute.GET(req('/api/state', undefined, headers, 'GET'))).status, 503);
delete globalThis.__strideTestEnv;
sqlite.close();
console.log('Single-account auth, rate limits, session expiry/revocation, CSRF and protected state routes passed.');
