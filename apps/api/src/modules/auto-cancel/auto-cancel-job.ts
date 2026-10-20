import { Inject, Injectable } from '@nestjs/common';
import { BookingNotifier, EmailDeliveryFailed } from '../notification/booking-notifier';
import { AUTO_CANCEL_STORE, AutoCancelStore } from './auto-cancel-store';

/** One pass of the scheduled auto-cancel (UC-mrr-019): pending bookings whose start time has come. */
@Injectable()
export class AutoCancelJob {
  constructor(
    @Inject(AUTO_CANCEL_STORE) private readonly store: AutoCancelStore,
    private readonly notifier: BookingNotifier,
  ) {}

  async run(now: Date): Promise<void> {
    for (const b of await this.store.listPendingStartedBy(now)) {
      try {
        await this.notifier.bookingAutoCancelled(b);
      } catch (err) {
        if (!(err instanceof EmailDeliveryFailed)) throw err;
        // Not cancelled: it stays pending, still approvable, and the next pass tries again (BR-mrr-016).
        continue;
      }
      await this.store.cancelIfPending(b.id);
    }
  }
}
