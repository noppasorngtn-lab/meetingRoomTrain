import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Caller } from '../../common/auth/current-user';
import { KYSELY } from '../../common/database/database.module';
import { Database } from '../../common/database/schema';
import { BookingNotFound } from './booking-edit.service';

/** BR-mrr-018 — a General User, the booker and the attendees included, sees no trail (AC-mrr-058 · AC-mrr-059). */
export class NotAuditReader extends Error {
  constructor() {
    super('เฉพาะผู้ดูแลห้องและผู้ดูแลระบบเท่านั้นที่ดูร่องรอยได้');
    this.name = 'NotAuditReader';
  }
}

/** ACL-013 · ACL-018 — the roles that read every booking's trail. */
const READS_TRAIL: readonly Database['users']['role'][] = ['ROOM_ADMINISTRATOR', 'SYSTEM_ADMINISTRATOR'];

export interface BookingAuditRow {
  id: string;
  actor: { id: string; fullName: string };
  /** ENT-010's action, in the api's own names — the screen words it. */
  action: Database['booking_audit_entries']['action'];
  /** Null where the action asks for none — APPROVE, REJECT, APPROVE_ADJUSTMENT, REJECT_ADJUSTMENT. */
  reason: string | null;
  /** The values before and after, where the action changed any. */
  detail: unknown;
  at: string;
}

/**
 * API-016 — who · when · what · why on one booking, read by a Room Administrator (ACL-013) or a
 * System Administrator (ACL-018).
 */
@Injectable()
export class BookingAuditService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async list(caller: Caller, bookingId: string): Promise<BookingAuditRow[]> {
    // The role is read from the database on every call, never trusted from the request.
    const me = await this.db.selectFrom('users').select('role').where('id', '=', caller.userId).executeTakeFirst();
    if (!me || !READS_TRAIL.includes(me.role)) throw new NotAuditReader();
    const booking = await this.db.selectFrom('bookings').select('id').where('id', '=', bookingId).executeTakeFirst();
    if (!booking) throw new BookingNotFound();
    const rows = await this.db
      .selectFrom('booking_audit_entries as e')
      .innerJoin('users as actor', 'actor.id', 'e.actor_id')
      .select(['e.id', 'e.action', 'e.reason', 'e.detail', 'e.at', 'actor.id as actor_id', 'actor.full_name as actor_name'])
      .where('e.booking_id', '=', bookingId)
      .orderBy('e.at', 'asc')
      .orderBy('e.id')
      .execute();
    return rows.map((e) => ({
      id: e.id,
      actor: { id: e.actor_id, fullName: e.actor_name },
      action: e.action,
      reason: e.reason,
      detail: e.detail,
      at: e.at.toISOString(),
    }));
  }
}
