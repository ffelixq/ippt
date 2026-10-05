import { authentication } from '@/lib/auth';
import { authResponse } from '@/lib/auth-core';
export async function GET(req: Request) {
  try {
    const session = await authentication().session(req);
    return session ? authResponse({userKey: session.userId, expiresAt: session.expiresAt}) : authResponse({error: 'Sign in to continue.'}, 401);
  } catch { return authResponse({error: 'Sign-in is temporarily unavailable. Please try again.'}, 503); }
}
