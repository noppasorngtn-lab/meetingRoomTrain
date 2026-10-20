import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Caller } from '../../common/auth/current-user';
import { Clock, CLOCK } from '../../common/clock';
import { KYSELY } from '../../common/database/database.module';
import { Database } from '../../common/database/schema';
import { BookingNotifier } from '../notification/booking-notifier';
import { BookingNotFound } from './booking-edit.service';

/** ACL-008 is ROLE-002's alone — a General User, or a System Administrator, decides nothing. */
export class NotRoomAdministrator extends Error {}

/** BR-mrr-013 — the room names its own approver, and then only they decide its bookings. */
export class NotTheApprover extends Error {}

/** ACL-008 condition — only a booking in PENDING_APPROVAL is decided here (STM-mrr-001). */
export class NotPending extends Error {
  constructor() {
    super('การจองนี้ไม่ได้รออนุมัติแล้ว');
    this.name = 'NotPending';
  }
}

export interface PendingBooking {
  id: string;
  roomId: string;
  roomName: string;
  startAt: string;
  endAt: string;
  title: string;
  bookedBy: { id: string; fullName: string };
  /** The room's approver now, or null when any Room Administrator may decide (BR-mrr-013). */
  approver: { id: string; fullName: string } | null;
  /** Whether the caller may approve or reject it — UI-mrr-009 disables the buttons when not. */
  canDecide: boolean;
}

export interface PendingPage {
  items: PendingBooking[];
  page: number;
  pageSize: number;
  total: number;
}

/** UI-mrr-009 overflow — 20 to a page, the nearest start first. */
export const PAGE_SIZE = 20;

/**
 * API-010 · API-011 · API-012 — a Room Administrator lists and decides the bookings that wait for
 * approval (UC-mrr-007 · ACL-008).
 */
@Injectable()
export class BookingApprovalService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly notifier: BookingNotifier,
  ) {}

  /**
   * ACL-008 scope all — every pending booking, including rooms whose approver is someone else
   * (marked canDecide: false) and ones whose start has passed, which stay approvable (BR-mrr-016).
   */
  async listPending(caller: Caller, page: number): Promise<PendingPage> {
    await this.assertRoomAdministrator(this.db, caller, 'คุณไม่มีสิทธิ์เข้าหน้านี้');
    const pending = this.db.selectFrom('bookings as b').where('b.status', '=', 'PENDING_APPROVAL');
    const { total } = await pending.select((eb) => eb.fn.countAll<string>().as('total')).executeTakeFirstOrThrow();
    const rows = await pending
      .innerJoin('meeting_rooms as r', 'r.id', 'b.room_id')
      .innerJoin('meeting_room_versions as v', 'v.id', 'r.current_version_id')
      .innerJoin('users as booker', 'booker.id', 'b.booked_by')
      .leftJoin('users as approver', 'approver.id', 'v.approver_id')
      .select([
        'b.id', 'b.room_id', 'v.name as room_name', 'b.start_at', 'b.end_at', 'b.title',
        'booker.id as booker_id', 'booker.full_name as booker_name', 'approver.id as approver_id', 'approver.full_name as approver_name',
      ])
      .orderBy('b.start_at', 'asc')
      .orderBy('b.id')
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .execute();
    return {
      items: rows.map((b) => ({
        id: b.id,
        roomId: b.room_id,
        roomName: b.room_name,
        startAt: b.start_at.toISOString(),
        endAt: b.end_at.toISOString(),
        title: b.title,
        bookedBy: { id: b.booker_id, fullName: b.booker_name },
        approver: b.approver_id && b.approver_name ? { id: b.approver_id, fullName: b.approver_name } : null,
        canDecide: b.approver_id === null || b.approver_id === caller.userId,
      })),
      page,
      pageSize: PAGE_SIZE,
      total: Number(total),
    };
  }

  async approve(caller: Caller, id: string): Promise<{ message: string }> {
    const now = this.clock.now();
    return this.db.transaction().execute(async (tx) => {
      // No start-time check: a booking the auto-cancel could not mail stays approvable (BR-mrr-016).
      const current = await this.lockDecidable(tx, caller, id, 'อนุมัติ');
      await tx.updateTable('bookings').set({ status: 'APPROVED' }).where('id', '=', id).execute();
      await this.record(tx, caller, id, 'APPROVE', now);

      const { email: bookerEmail } = await tx
        .selectFrom('users')
        .select('email')
        .where('id', '=', current.booked_by)
        .executeTakeFirstOrThrow();
      // Last, inside the transaction: a mail that does not go undoes the approval (BR-mrr-019).
      await this.notifier.bookingApproved({
        title: current.title, roomName: current.roomName, startAt: current.start_at, endAt: current.end_at, bookerEmail, attendeeEmails: [],
      });
      return { message: 'อนุมัติการจองสำเร็จ' };
    });
  }

  /**
   * REJECTED no longer holds time, so the slot is free again the moment this commits (the
   * bookings_no_overlap constraint counts only the states that hold time). No mail: BR-mrr-007
   * names no event for a rejection.
   */
  async reject(caller: Caller, id: string): Promise<{ message: string }> {
    const now = this.clock.now();
    return this.db.transaction().execute(async (tx) => {
      await this.lockDecidable(tx, caller, id, 'ปฏิเสธ');
      await tx.updateTable('bookings').set({ status: 'REJECTED' }).where('id', '=', id).execute();
      await this.record(tx, caller, id, 'REJECT', now);
      return { message: 'ปฏิเสธการจองสำเร็จ' };
    });
  }

  /** BR-mrr-017 — who · when · what · why, in the same transaction as the decision. */
  private async record(tx: Kysely<Database>, caller: Caller, id: string, action: 'APPROVE' | 'REJECT', at: Date) {
    await tx.insertInto('booking_audit_entries').values({ booking_id: id, actor_id: caller.userId, action, reason: null, detail: null, at }).execute();
  }

  /** The booking, locked for this transaction, if the caller may decide it (ACL-008 · BR-mrr-013). */
  private async lockDecidable(tx: Kysely<Database>, caller: Caller, id: string, verb: string) {
    await this.assertRoomAdministrator(tx, caller, `เฉพาะผู้ดูแลห้องเท่านั้นที่${verb}ได้`);

    const current = await tx
      .selectFrom('bookings')
      .select(['id', 'room_id', 'booked_by', 'title', 'start_at', 'end_at', 'status'])
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    if (!current) throw new BookingNotFound();
    if (current.status !== 'PENDING_APPROVAL') throw new NotPending();

    // The approver named now, on the room's current version — "กำหนดทีหลังได้" (BR-mrr-013).
    const room = await tx
      .selectFrom('meeting_rooms as r')
      .innerJoin('meeting_room_versions as v', 'v.id', 'r.current_version_id')
      .select(['v.name', 'v.approver_id'])
      .where('r.id', '=', current.room_id)
      .executeTakeFirstOrThrow();
    if (room.approver_id !== null && room.approver_id !== caller.userId) {
      throw new NotTheApprover(`เฉพาะผู้อนุมัติประจำห้องนี้เท่านั้นที่${verb}ได้`);
    }
    return { ...current, roomName: room.name };
  }

  /** The role is read from the database on every call, never trusted from the request. */
  private async assertRoomAdministrator(db: Kysely<Database>, caller: Caller, refusal: string) {
    const me = await db.selectFrom('users').select('role').where('id', '=', caller.userId).executeTakeFirst();
    if (me?.role !== 'ROOM_ADMINISTRATOR') throw new NotRoomAdministrator(refusal);
  }
}
