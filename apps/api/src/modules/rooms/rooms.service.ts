import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { KYSELY } from '../../common/database/database.module';
import { Database } from '../../common/database/schema';

/**
 * What a booking form needs to know about a room — its current version only (DQ-mrr-002).
 * The approver and photos stay out until design answers GAP-mrr-013.
 */
export interface RoomInfo {
  id: string;
  name: string;
  capacity: number;
  requiresApproval: boolean;
  status: 'ACTIVE' | 'UNDER_MAINTENANCE';
}

export interface FacilityOption {
  id: string;
  name: string;
}

/** The room does not exist or was archived. */
export class RoomInfoNotFound extends Error {
  constructor() {
    super('ไม่พบห้อง');
    this.name = 'RoomInfoNotFound';
  }
}

@Injectable()
export class RoomsService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  /** API-022 — a room under maintenance is still shown, so the form can say why it cannot be booked. */
  async room(id: string): Promise<RoomInfo> {
    const row = await this.db
      .selectFrom('meeting_rooms as r')
      .innerJoin('meeting_room_versions as v', 'v.id', 'r.current_version_id')
      .select(['r.id', 'r.status', 'v.name', 'v.capacity', 'v.requires_approval'])
      .where('r.id', '=', id)
      .executeTakeFirst();
    if (!row || row.status === 'ARCHIVED') throw new RoomInfoNotFound();
    return { id: row.id, name: row.name, capacity: row.capacity, requiresApproval: row.requires_approval, status: row.status };
  }

  /** API-002 — the facilities still offered as a choice (ENT-004 active). */
  async activeFacilities(): Promise<FacilityOption[]> {
    return this.db.selectFrom('facilities').select(['id', 'name']).where('active', '=', true).orderBy('name').execute();
  }
}
