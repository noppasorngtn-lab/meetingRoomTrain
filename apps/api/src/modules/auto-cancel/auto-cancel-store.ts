import { BookingSnapshot } from '../notification/booking-notifier';
import { BookingStatus } from '../reminder/reminder-store';

/** A booking as the auto-cancel job sees it (ENT-007 · ENT-008). */
export interface AutoCancelCandidate extends BookingSnapshot {
  id: string;
  status: BookingStatus;
}

/** Where the job reads pending bookings and cancels them. Persistence arrives with the booking unit. */
export interface AutoCancelStore {
  /** Bookings still PENDING_APPROVAL whose start time is `now` or earlier. */
  listPendingStartedBy(now: Date): Promise<AutoCancelCandidate[]>;
  /**
   * PENDING_APPROVAL → CANCELLED, releasing the slot — only if it is still pending, because an
   * administrator may approve it between the read and the write (BR-mrr-016). False if not.
   */
  cancelIfPending(id: string): Promise<boolean>;
}

export const AUTO_CANCEL_STORE = Symbol('AUTO_CANCEL_STORE');
