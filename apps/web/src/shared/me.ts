import { getJson } from './api';

export type Role = 'GENERAL_USER' | 'ROOM_ADMINISTRATOR' | 'SYSTEM_ADMINISTRATOR';

/** Who is signed in, as API-035 answers. */
export interface Me {
  fullName: string;
  role: Role;
}

/**
 * API-035 — the caller's own name and role, so a page can show only the commands that role is
 * given (ADR-003). Hiding a command is presentation: the endpoint behind it still refuses.
 */
export const getMe = () => getJson<Me>('/auth/me');
