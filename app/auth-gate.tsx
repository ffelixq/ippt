'use client';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {Activity, ArrowRight, Eye, EyeOff, LockKeyhole} from 'lucide-react';
import App from './stride';
import {clearCache, readCache} from '@/lib/offline';
import {AUTH_REQUIRED, LOGOUT_SIGNAL, forgetSession, offlineSessionValid, rememberSession} from '@/lib/client-auth';

export default function AuthGate() {
  const [phase, setPhase] = useState<'checking' | 'login' | 'ready' | 'error'>('checking');
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const expiresAt = useRef(0);
  async function check() {
    try {
      const response = await fetch('/api/auth/session', {cache: 'no-store'});
      const body = await response.json() as {userKey: string, expiresAt: number, error?: string};
      if (response.ok) { rememberSession(body); expiresAt.current = body.expiresAt; setPhase('ready'); setMessage(''); }
      else if (response.status === 401) { forgetSession(); setPhase('login'); setMessage(''); }
      else { setMessage(body.error || 'Could not connect. Please retry.'); setPhase('error'); }
    } catch {
      const cache = await readCache().catch(() => undefined);
      if (offlineSessionValid() && cache?.userKey === 'felixdasumo') setPhase('ready');
      else { setMessage('Connect to the internet to sign in.'); setPhase('error'); }
    }
  }
  useEffect(() => {
    void check();
    const expired = () => { setPassword(''); setMessage('Sign in again to continue. Your unsaved records are kept on this device.'); setPhase('login'); };
    const onStorage = (event: StorageEvent) => { if (event.key === LOGOUT_SIGNAL) { setPassword(''); setMessage(''); setPhase('login'); } };
    const timer = setInterval(() => { if (expiresAt.current <= Date.now() && !offlineSessionValid()) setPhase(p => p === 'ready' ? 'login' : p); }, 30000);
    window.addEventListener(AUTH_REQUIRED, expired);
    window.addEventListener('storage', onStorage);
    return () => { clearInterval(timer); window.removeEventListener(AUTH_REQUIRED, expired); window.removeEventListener('storage', onStorage); };
  }, []);
  async function login(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username, password})});
      const body = await response.json() as {userKey: string, expiresAt: number, error?: string};
      if (!response.ok) throw new Error(body.error || 'Could not sign in. Please retry.');
      rememberSession(body); expiresAt.current = body.expiresAt; setPassword(''); setVisible(false); setPhase('ready');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not sign in. Please retry.'); }
    finally { setBusy(false); }
  }
  async function logout() {
    const response = await fetch('/api/auth/logout', {method: 'POST'});
    if (!response.ok) throw new Error('Could not sign out. Please reconnect and try again.');
    forgetSession();
    expiresAt.current = 0;
    await clearCache().catch(() => {});
    try { localStorage.removeItem('stride-interval-draft-v1'); localStorage.setItem(LOGOUT_SIGNAL, String(Date.now())); } catch {}
    setPassword(''); setMessage(''); setPhase('login');
  }
  if (phase === 'ready') return <App onSignOut={logout}/>;
  return <main className="sign-in-page"><div className="sign-in-wrap">
    <div className="wordmark sign-in-brand"><Activity size={28}/>stride<span>.</span></div>
    <section className="card sign-in-card">
      <span className="round-icon"><LockKeyhole size={22}/></span>
      <span className="eyebrow">YOUR TRAINING, YOUR PACE</span>
      <h1>{phase === 'checking' ? 'Getting ready…' : 'Welcome back.'}</h1>
      <p>{phase === 'checking' ? 'Opening your training space.' : 'Sign in to pick up where you left off.'}</p>
      {phase === 'login' && <form className="form-stack" onSubmit={login}>
        <label className="field"><span>Username</span><input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={100} value={username} onChange={e => setUsername(e.target.value)} disabled={busy}/></label>
        <label className="field"><span>Password</span><span className="password-control"><input name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required maxLength={256} value={password} onChange={e => setPassword(e.target.value)} disabled={busy}/><button className="icon-btn" type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></span></label>
        {message && <p className="error-text" role="alert">{message}</p>}
        <button className="btn sign-in-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}{!busy && <ArrowRight size={18}/>}</button>
      </form>}
      {phase === 'error' && <><p className="error-text" role="alert">{message}</p><button className="btn sign-in-submit" onClick={() => { setPhase('checking'); void check(); }}>Try again</button></>}
    </section><p className="sign-in-footer">One step. A little progress. Every day.</p>
  </div></main>;
}
