// This marker permits previously signed-in offline use only; the server never
// trusts it. Every online data request still requires the HttpOnly session.
const KEY = 'stride-offline-session';
export const AUTH_REQUIRED = 'stride-auth-required';
export function rememberSession(value: {userKey: string, expiresAt: number}) {
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch {}
}
export function offlineSessionValid() {
  try { const value = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return value?.userKey === 'felixdasumo' && Number.isFinite(value.expiresAt) && value.expiresAt > Date.now(); }
  catch { return false; }
}
export function forgetSession() { try { localStorage.removeItem(KEY); } catch {} }
export function requireSignIn() { forgetSession(); window.dispatchEvent(new Event(AUTH_REQUIRED)); }
export const LOGOUT_SIGNAL = 'stride-signed-out';
