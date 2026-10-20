import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Caller } from '../../common/auth/current-user';
import { CLOCK, Clock } from '../../common/clock';
import { KYSELY } from '../../common/database/database.module';
import { Database } from '../../common/database/schema';
import { EXCLUSION_VIOLATION, SlotTaken } from './booking.service';
import { assertRoomAdministrator, recordAudit } from './room-admin';

/** No such adjustment request. */
export class AdjustmentRequestNotFound extends Error {
  constructor() {
    super('ไม่พบคำขอแก้ไข');
    this.name = 'AdjustmentRequestNotFound';
  }
}

/** BR-mrr-014 — whoever asked does not decide, checked here whatever the screen shows (AC-mrr-044). */
export class OwnAdjustmentRequest extends Error {
  constructor() {
    super('ผู้แก้ไขอนุมัติคำขอของตัวเองไม่ได้ ต้องให้ผู้ดูแลห้องคนอื่นอนุมัติ');
    this.name = 'OwnAdjustmentRequest';
  }
}

/** ACL-012 condition — only a PENDING request is decided (STM-mrr-002: APPROVED and REJECTED are final). */
export class AdjustmentNotPending extends Error {
  constructor() {
    super('คำขอแก้ไขนี้ไม่ได้รออนุมัติแล้ว');
    this.name = 'AdjustmentNotPending';
  }
}

/** STM-mrr-002's states. */
type AdjustmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AdjustmentRequestRow {
  id: string;
  booking: { id: string; roomName: string; title: string; startAt: string; endAt: string };
  requestedBy: { id: string; fullName: string };
  /** Only the fields asked to change, in the api's own names (startAt · endAt as ISO instants). */
  proposedChanges: Record<string, unknown>;
  reason: string;
  status: AdjustmentStatus;
  createdAt: string;
  /** False on the caller's own request — UI-mrr-011 disables the buttons, and the api refuses anyway. */
  canDecide: boolean;
}

export interface AdjustmentPage {
  items: AdjustmentRequestRow[];
  page: number;
  pageSize: number;
  total: number;
}

/** UI-mrr-011 overflow — 20 to a page, the longest waiting first. */
export const PAGE_SIZE = 20;

const REFUSAL = 'คุณไม่มีสิทธิ์เข้าหน้านี้';

/**
 * API-017 · API-018 · API-019 — a Room Administrator lists the adjustment requests that wait and
 * approves or rejects one another Room Administrator made (UC-mrr-011 · ACL-012 · BR-mrr-014).
 */
@Injectable()
export class AdjustmentRequestService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** API-017 — every pending request, the caller's own included and marked canDecide: false. */
  async listPending(caller: Caller, page: number): Promise<AdjustmentPage> {
    await assertRoomAdministrator(this.db, caller, REFUSAL);
    const pending = this.db.selectFrom('booking_adjustment_requests as a').where('a.status', '=', 'PENDING');
    const { total } = await pending.select((eb) => eb.fn.countAll<string>().as('total')).executeTakeFirstOrThrow();
    const rows = await pending
      .innerJoin('bookings as b', 'b.id', 'a.booking_id')
      .innerJoin('meeting_rooms as r', 'r.id', 'b.room_id')
      .innerJoin('meeting_room_versions as v', 'v.id', 'r.current_version_id')
      .innerJoin('users as asker', 'asker.id', 'a.requested_by')
      .select([
        'a.id', 'a.proposed_changes', 'a.reason', 'a.status', 'a.created_at', 'b.id as booking_id', 'v.name as room_name', 'b.title',
        'b.start_at', 'b.end_at', 'asker.id as asker_id', 'asker.full_name as asker_name',
      ])
      .orderBy('a.created_at', 'asc')
      .orderBy('a.id')
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .execute();
    return {
      items: rows.map((a) => ({
        id: a.id,
        booking: { id: a.booking_id, roomName: a.room_name, title: a.title, startAt: a.start_at.toISOString(), endAt: a.end_at.toISOString() },
        requestedBy: { id: a.asker_id, fullName: a.asker_name },
        proposedChanges: a.proposed_changes,
        reason: a.reason,
        status: a.status,
        createdAt: a.created_at.toISOString(),
        canDecide: a.asker_id !== caller.userId,
      })),
      page,
      pageSize: PAGE_SIZE,
      total: Number(total),
    };
  }

  /**
   * API-018 — the asked-for values take effect on the booking, in the transaction that decides the
   * request. A new time must still find the slot free (the bookings_no_overlap constraint). No mail:
   * the meeting is over, and UC-mrr-011 names none.
   */
  async approve(caller: Caller, id: string): Promise<{ message: string }> {
    const now = this.clock.now();
    return this.db.transaction().execute(async (tx) => {
      const request = await this.lockDecidable(tx, caller, id);
      const changes = request.proposed_changes;
      const booking: { title?: string; start_at?: Date; end_at?: Date } = {};
      if (typeof changes.title === 'string') booking.title = changes.title;
      if (typeof changes.startAt === 'string') booking.start_at = new Date(changes.startAt);
      if (typeof changes.endAt === 'string') booking.end_at = new Date(changes.endAt);
      if (Object.keys(booking).length) {
        try {
          await tx.updateTable('bookings').set(booking).where('id', '=', request.booking_id).execute();
        } catch (err) {
          if ((err as { code?: string }).code === EXCLUSION_VIOLATION) throw new SlotTaken();
          throw err;
        }
      }
      if (Array.isArray(changes.attendeeIds)) {
        const attendeeIds = changes.attendeeIds as string[];
        await tx.deleteFrom('booking_attendees').where('booking_id', '=', request.booking_id).execute();
        await tx.insertInto('booking_attendees').values(attendeeIds.map((user_id) => ({ booking_id: request.booking_id, user_id }))).execute();
      }
      if (Array.isArray(changes.equipmentIds)) {
        const equipmentIds = changes.equipmentIds as string[];
        await tx.deleteFrom('booking_equipment_requests').where('booking_id', '=', request.booking_id).execute();
        if (equipmentIds.length) {
          await tx
            .insertInto('booking_equipment_requests')
            .values(equipmentIds.map((facility_id) => ({ booking_id: request.booking_id, facility_id })))
            .execute();
        }
      }
      await this.decide(tx, caller, request, 'APPROVED', now);
      return { message: 'อนุมัติคำขอแก้ไขสำเร็จ' };
    });
  }

  /** API-019 — the booking keeps its values; only the request is closed. */
  async reject(caller: Caller, id: string): Promise<{ message: string }> {
    const now = this.clock.now();
    return this.db.transaction().execute(async (tx) => {
      const request = await this.lockDecidable(tx, caller, id);
      await this.decide(tx, caller, request, 'REJECTED', now);
      return { message: 'ปฏิเสธคำขอแก้ไขสำเร็จ' };
    });
  }

  /** STM-mrr-002 PENDING → APPROVED | REJECTED, with its trail entry (BR-mrr-017). */
  private async decide(
    tx: Kysely<Database>,
    caller: Caller,
    request: { id: string; booking_id: string; proposed_changes: Record<string, unknown> },
    status: 'APPROVED' | 'REJECTED',
    now: Date,
  ): Promise<void> {
    await tx
      .updateTable('booking_adjustment_requests')
      .set({ status, decided_by: caller.userId, decided_at: now })
      .where('id', '=', request.id)
      .execute();
    await recordAudit(tx, {
      bookingId: request.booking_id,
      caller,
      action: status === 'APPROVED' ? 'APPROVE_ADJUSTMENT' : 'REJECT_ADJUSTMENT',
      at: now,
      detail: { requestId: request.id, proposedChanges: request.proposed_changes },
    });
  }

  /** ACL-012 — a Room Administrator, a PENDING request, and not the one who asked (BR-mrr-014). */
  private async lockDecidable(tx: Kysely<Database>, caller: Caller, id: string) {
    await assertRoomAdministrator(tx, caller, 'เฉพาะผู้ดูแลห้องเท่านั้นที่อนุมัติหรือปฏิเสธคำขอแก้ไขได้');
    const request = await tx
      .selectFrom('booking_adjustment_requests')
      .select(['id', 'booking_id', 'requested_by', 'proposed_changes', 'status'])
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    if (!request) throw new AdjustmentRequestNotFound();
    if (request.status !== 'PENDING') throw new AdjustmentNotPending();
    if (request.requested_by === caller.userId) throw new OwnAdjustmentRequest();
    return request;
  }
}
