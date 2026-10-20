import { BookingSnapshot } from '../notification/booking-notifier';

export type BookingStatus = 'PENDING_APPROVAL' | 'CONFIRMED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ReminderStatus = 'NOT_SENT' | 'SENT' | 'FAILED';

/** A booking as the reminder job sees it (ENT-007 · ENT-008). */
export interface ReminderCandidate extends BookingSnapshot {
  id: string;
  status: BookingStatus;
  reminderStatus: ReminderStatus;
  reminderAt: Date | null;
}

/** Where the job reads bookings and writes the reminder outcome. Persistence arrives with the booking unit. */
export interface ReminderStore {
  /** Bookings starting after `now` and no later than `until`, whatever their status. */
  listUpcoming(now: Date, until: Date): Promise<ReminderCandidate[]>;
  recordReminder(id: string, status: 'SENT' | 'FAILED', at: Date): Promise<void>;
}

export const REMINDER_STORE = Symbol('REMINDER_STORE');
