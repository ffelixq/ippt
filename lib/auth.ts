import { env } from 'cloudflare:workers';
import { createAuth } from './auth-core';
import { database } from './store';
export function authentication() { return createAuth(database(), env.STRIDE_PASSWORD_HASH ?? ''); }
