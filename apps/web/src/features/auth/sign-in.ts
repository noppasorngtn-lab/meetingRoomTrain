import { ApiError, postJson } from '../../shared/api';

/** API-031 answers every request it did not fail with this one sentence (BR-mrr-026). */
export interface CodeSent {
  message: string;
}

/** What the code page shows above its form, and how loudly. */
export interface Notice {
  tone: 'info' | 'warning' | 'danger';
  text: string;
}

/** UI-mrr-001 error state — the email did not leave; the user asks again (BR-mrr-024). */
export const SEND_FAILED = 'ส่งรหัสไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';

/**
 * The email a code was asked for, kept for this tab so the code page still knows it when a magic
 * link that could not be used lands there (UI-mrr-002 error state).
 */
const REQUESTED_EMAIL = 'mrr.requestedEmail';

export const rememberEmail = (email: string) => {
  try {
    sessionStorage.setItem(REQUESTED_EMAIL, email);
  } catch {
    // Storage may be off; the page then asks for the email again.
  }
};

export const rememberedEmail = (): string | null => {
  try {
    return sessionStorage.getItem(REQUESTED_EMAIL);
  } catch {
    return null;
  }
};

/** API-031 — ask for a code. Asking again while a code is still usable is refused (409 · BR-mrr-025). */
export const requestCode = (email: string) => postJson<CodeSent>('/auth/otp/request', { email });

/** The sentence a failed request shows: the api's own, or the send failure when it never answered. */
export const noticeOf = (err: unknown): Notice => {
  if (err instanceof ApiError && err.status === 409) return { tone: 'warning', text: err.message };
  if (err instanceof ApiError && err.status !== 500 && err.message) return { tone: 'danger', text: err.message };
  return { tone: 'danger', text: SEND_FAILED };
};
