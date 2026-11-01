import { finishEmailLink as finish } from '@/lib/auth/email-finish.ts';
import { rememberMethod, signIn } from '@/lib/session.ts';

// lib/auth/email-finish.ts with this request's session cookies.
export const finishEmailLink = (token: string) => finish(token, { signIn, rememberMethod });
