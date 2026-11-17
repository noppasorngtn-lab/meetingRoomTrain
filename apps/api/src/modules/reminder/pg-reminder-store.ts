import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { loadSnapshots } from '../../common/booking-snapshots';
import { KYSELY } from '../../common/database/database.module';
import { Database } from '../../common/database/schema';
import { ReminderCandidate, ReminderStore } from './reminder-store';

/** The reminder job's view of the bookings table (UC-mrr-018 · BR-mrr-008 · BR-mrr-020 · BR-mrr-023). */
@Injectable()
export class PgReminderStore implements ReminderStore {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  /** Starting after `now` and no later than `until`, whatever the status — the job decides which are reminded. */
  async listUpcoming(now: Date, until: Date): Promise<ReminderCandidate[]> {
    const rows = await this.db
      .selectFrom('bookings')
      .select(['id', 'room_id', 'booked_by', 'title', 'start_at', 'end_at', 'status', 'reminder_status', 'reminder_at'])
      .where('start_at', '>', now)
      .where('start_at', '<=', until)
      .orderBy('start_at')
      .execute();
    const snapshots = await loadSnapshots(this.db, rows);
    return rows.map((r) => ({ ...snapshots.get(r.id)!, id: r.id, status: r.status, reminderStatus: r.reminder_status, reminderAt: r.reminder_at }));
  }

  async recordReminder(id: string, status: 'SENT' | 'FAILED', at: Date): Promise<void> {
    await this.db.updateTable('bookings').set({ reminder_status: status, reminder_at: at }).where('id', '=', id).execute();
  }
}
