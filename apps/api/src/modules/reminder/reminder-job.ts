import { Inject, Injectable } from '@nestjs/common';
import { BookingNotifier, EmailDeliveryFailed } from '../notification/booking-notifier';
import { REMINDER_STORE, ReminderStore } from './reminder-store';

const LEAD_MS = 15 * 60 * 1000;
/** Only a booking that can really be used is reminded — not one still waiting for approval (BR-mrr-008). */
const USABLE = new Set(['CONFIRMED', 'APPROVED']);

/** One pass of the scheduled reminder (UC-mrr-018): every booking starting within 15 minutes. */
@Injectable()
export class ReminderJob {
  constructor(
    @Inject(REMINDER_STORE) private readonly store: ReminderStore,
    private readonly notifier: BookingNotifier,
  ) {}

  async run(now: Date): Promise<void> {
    const due = await this.store.listUpcoming(now, new Date(now.getTime() + LEAD_MS));
    for (const b of due) {
      if (!USABLE.has(b.status)) continue;
      // One reminder per booking, ever — SENT or FAILED, it is never sent again (BR-mrr-023 · BR-mrr-020).
      if (b.reminderStatus !== 'NOT_SENT') continue;
      try {
        await this.notifier.reminderDue(b);
      } catch (err) {
        if (!(err instanceof EmailDeliveryFailed)) throw err;
        // The booking itself is untouched; only the reminder outcome is written (UC-mrr-018 exception flow).
        await this.store.recordReminder(b.id, 'FAILED', now);
        continue;
      }
      await this.store.recordReminder(b.id, 'SENT', now);
    }
  }
}
