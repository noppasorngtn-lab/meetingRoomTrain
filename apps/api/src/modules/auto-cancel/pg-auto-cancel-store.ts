import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { loadSnapshots } from '../../common/booking-snapshots';
import { KYSELY } from '../../common/database/database.module';
import { Database } from '../../common/database/schema';
import { AutoCancelCandidate, AutoCancelStore } from './auto-cancel-store';

/** The auto-cancel job's view of the bookings table (UC-mrr-019 · BR-mrr-016). */
@Injectable()
export class PgAutoCancelStore implements AutoCancelStore {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async listPendingStartedBy(now: Date): Promise<AutoCancelCandidate[]> {
    const rows = await this.db
      .selectFrom('bookings')
      .select(['id', 'room_id', 'booked_by', 'title', 'start_at', 'end_at', 'status'])
      .where('status', '=', 'PENDING_APPROVAL')
      .where('start_at', '<=', now)
      .orderBy('start_at')
      .execute();
    const snapshots = await loadSnapshots(this.db, rows);
    return rows.map((r) => ({ ...snapshots.get(r.id)!, id: r.id, status: r.status }));
  }

  /** One conditional UPDATE: an administrator who approved it between the read and now wins (BR-mrr-016). */
  async cancelIfPending(id: string): Promise<boolean> {
    const done = await this.db
      .updateTable('bookings')
      .set({ status: 'CANCELLED' })
      .where('id', '=', id)
      .where('status', '=', 'PENDING_APPROVAL')
      .executeTakeFirst();
    return Number(done.numUpdatedRows) > 0;
  }
}
