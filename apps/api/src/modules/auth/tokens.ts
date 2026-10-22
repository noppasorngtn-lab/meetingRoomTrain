import { createHash, randomBytes, randomInt } from 'node:crypto';

/** A login code is six digits (BR-mrr-027). */
export const newCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** Unguessable value for a magic link or a session cookie. */
export const newToken = (): string => randomBytes(32).toString('base64url');

/** Only hashes are stored — a database read does not hand out a code, a link or a session. */
export const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
