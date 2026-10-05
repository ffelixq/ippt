import { authentication } from '@/lib/auth';
import { authResponse } from '@/lib/auth-core';
export async function POST(req: Request) {
  try { return await authentication().logout(req); }
  catch { return authResponse({error: 'Could not sign out. Please reconnect and try again.'}, 503); }
}
