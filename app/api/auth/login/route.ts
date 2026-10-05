import { authentication } from '@/lib/auth';
import { authResponse } from '@/lib/auth-core';
export async function POST(req: Request) {
  try { return await authentication().login(req); }
  catch { return authResponse({error: 'Sign-in is temporarily unavailable. Please try again.'}, 503); }
}
