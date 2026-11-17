import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { KYSELY } from '../../common/database/database.module';
import { Database } from '../../common/database/schema';

export interface RoomSearch {
  /** The half-open slot [startAt, endAt) the room has to be free for (BR-mrr-001). */
  startAt: Date;
  endAt: Date;
  /** Seats needed; a room with exactly that many is enough. Left out, capacity is not asked. */
  attendees?: number;
  /** Every one of these must be on the room's current version. */
  facilityIds: string[];
}

export interface AvailableRoom {
  id: string;
  name: string;
  capacity: number;
  requiresApproval: boolean;
}

/** Statuses that hold the room's time — the same three the no-overlap rule and the calendar count (BR-mrr-001). */
const HOLDS_TIME = ['PENDING_APPROVAL', 'CONFIRMED', 'APPROVED'] as const;

@Injectable()
export class RoomSearchService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  /**
   * API-001 — the rooms a person could book for the slot: ACTIVE (BR-mrr-012 — a room under
   * maintenance or archived is not offered), seats enough, and no booking that holds time over the
   * slot, a booking still waiting for approval included (BR-mrr-001).
   */
  async available(search: RoomSearch): Promise<AvailableRoom[]> {
    let query = this.db
      .selectFrom('meeting_rooms as r')
      .innerJoin('meeting_room_versions as v', 'v.id', 'r.current_version_id')
      .select(['r.id', 'v.name', 'v.capacity', 'v.requires_approval'])
      .where('r.status', '=', 'ACTIVE')
      .where(({ not, exists, selectFrom }) =>
        not(
          exists(
            selectFrom('bookings as b')
              .select('b.id')
              .whereRef('b.room_id', '=', 'r.id')
              .where('b.status', 'in', HOLDS_TIME)
              .where('b.start_at', '<', search.endAt)
              .where('b.end_at', '>', search.startAt),
          ),
        ),
      );

    if (search.attendees !== undefined) query = query.where('v.capacity', '>=', search.attendees);

    for (const facilityId of search.facilityIds) {
      query = query.where(({ exists, selectFrom }) =>
        exists(
          selectFrom('room_version_facilities as f')
            .select('f.facility_id')
            .whereRef('f.room_version_id', '=', 'v.id')
            .where('f.facility_id', '=', facilityId),
        ),
      );
    }

    const rows = await query.orderBy('v.name').orderBy('r.id').execute();
    return rows.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity, requiresApproval: r.requires_approval }));
  }
}
