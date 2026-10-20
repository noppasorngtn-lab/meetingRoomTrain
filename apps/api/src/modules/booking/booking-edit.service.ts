import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Caller } from '../../common/auth/current-user';
import { CLOCK, Clock } from '../../common/clock';
import { KYSELY } from '../../common/database/database.module';
import { Database } from '../../common/database/schema';
import { BookingNotifier, BookingSnapshot } from '../notification/booking-notifier';
import {
  activeAttendees, BookingRoomNotFound, checkAttendeeIds, checkEquipment, checkTimes, checkTitle, EXCLUSION_VIOLATION,
  RoomUnderMaintenance, SlotTaken,
} from './booking.service';

type BookingStatus = Database['bookings']['status'];

export interface BookingDetail {
  id: string;
  roomId: string;
  roomName: string;
  startAt: string;
  endAt: string;
  title: string;
  status: BookingStatus;
  bookedBy: { id: string; fullName: string };
  attendees: { id: string; fullName: string }[];
  equipment: { id: string; name: string }[];
}

/** Every field may be left out; what is left out stays as it is. */
export interface EditBookingInput {
  startAt?: Date;
  endAt?: Date;
  title?: string;
  attendeeIds?: string[];
  equipmentIds?: string[];
}

/** No such booking — or one the caller may not see, which is answered the same way. */
export class BookingNotFound extends Error {
  constructor() {
    super('ไม่พบการจอง');
    this.name = 'BookingNotFound';
  }
}

/** ACL-005 · ACL-006 scope own — checked here, whatever the screen shows (AC-mrr-010). */
export class NotTheBooker extends Error {
  constructor() {
    super('เฉพาะผู้จองเท่านั้นที่แก้ไขหรือยกเลิกได้');
    this.name = 'NotTheBooker';
  }
}

/** The meeting has started, or the booking is no longer one that holds time. */
export class BookingLocked extends Error {}

/** ACL-005 · ACL-006 condition — the states an owner may still edit or cancel. */
const EDITABLE: readonly BookingStatus[] = ['PENDING_APPROVAL', 'CONFIRMED', 'APPROVED'];
/** ACL-013 · ACL-018 — these roles see every booking. */
const SEES_ALL = ['ROOM_ADMINISTRATOR', 'SYSTEM_ADMINISTRATOR'];

@Injectable()
export class BookingEditService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly notifier: BookingNotifier,
  ) {}

  /** API-007 — the booker sees their own booking; a Room or System Administrator sees any. */
  async get(caller: Caller, id: string): Promise<BookingDetail> {
    const detail = await this.read(this.db, id);
    if (!detail) throw new BookingNotFound();
    if (detail.bookedBy.id !== caller.userId) {
      const me = await this.db.selectFrom('users').select('role').where('id', '=', caller.userId).executeTakeFirst();
      if (!me || !SEES_ALL.includes(me.role)) throw new BookingNotFound();
    }
    return detail;
  }

  /**
   * UC-mrr-004 · API-008. Only the booker, only before the meeting starts. A new time is checked
   * the way a new booking is (AC-mrr-080): the room must be open and the slot free. A change of
   * time mails the booker and every attendee inside the transaction, so a mail failure saves
   * nothing (BR-mrr-019); a change of anything else saves without mail (AC-mrr-022 · AC-mrr-063).
   */
  async edit(caller: Caller, id: string, input: EditBookingInput): Promise<{ message: string }> {
    const now = this.clock.now();
    return this.db.transaction().execute(async (tx) => {
      const current = await this.lockOwn(tx, caller, id, now);

      const title = input.title === undefined ? current.title : checkTitle(input.title);
      const startAt = input.startAt ?? current.start_at;
      const endAt = input.endAt ?? current.end_at;
      const timeChanged = startAt.getTime() !== current.start_at.getTime() || endAt.getTime() !== current.end_at.getTime();
      if (timeChanged) checkTimes(startAt, endAt, now);

      const room = await tx
        .selectFrom('meeting_rooms as r')
        .innerJoin('meeting_room_versions as v', 'v.id', 'r.current_version_id')
        .select(['r.status', 'v.name'])
        .where('r.id', '=', current.room_id)
        .forShare()
        .executeTakeFirstOrThrow();
      // A new time counts as a new booking — a closed room takes none (BR-mrr-012 · AC-mrr-080).
      if (timeChanged && room.status === 'UNDER_MAINTENANCE') throw new RoomUnderMaintenance();
      if (timeChanged && room.status === 'ARCHIVED') throw new BookingRoomNotFound();

      if (input.attendeeIds !== undefined) {
        const attendeeIds = checkAttendeeIds(input.attendeeIds);
        await activeAttendees(tx, attendeeIds);
        await tx.deleteFrom('booking_attendees').where('booking_id', '=', id).execute();
        await tx.insertInto('booking_attendees').values(attendeeIds.map((user_id) => ({ booking_id: id, user_id }))).execute();
      }
      if (input.equipmentIds !== undefined) {
        const equipmentIds = [...new Set(input.equipmentIds)];
        await checkEquipment(tx, equipmentIds);
        await tx.deleteFrom('booking_equipment_requests').where('booking_id', '=', id).execute();
        if (equipmentIds.length) {
          await tx
            .insertInto('booking_equipment_requests')
            .values(equipmentIds.map((facility_id) => ({ booking_id: id, facility_id })))
            .execute();
        }
      }
      try {
        await tx.updateTable('bookings').set({ title, start_at: startAt, end_at: endAt }).where('id', '=', id).execute();
      } catch (err) {
        if ((err as { code?: string }).code === EXCLUSION_VIOLATION) throw new SlotTaken();
        throw err;
      }

      if (timeChanged) {
        const { email: bookerEmail } = await tx
          .selectFrom('users')
          .select('email')
          .where('id', '=', current.booked_by)
          .executeTakeFirstOrThrow();
        // The attendees as saved by this edit — the new list hears of the new time.
        const attendeeEmails = (
          await tx
            .selectFrom('booking_attendees as a')
            .innerJoin('users as u', 'u.id', 'a.user_id')
            .select('u.email')
            .where('a.booking_id', '=', id)
            .orderBy('u.email')
            .execute()
        ).map((a) => a.email);
        const snapshot = (s: Date, e: Date, t: string): BookingSnapshot => ({
          title: t, roomName: room.name, startAt: s, endAt: e, bookerEmail, attendeeEmails,
        });
        await this.notifier.bookingEdited(snapshot(current.start_at, current.end_at, current.title), snapshot(startAt, endAt, title));
      }
      return { message: 'บันทึกการแก้ไขสำเร็จ' };
    });
  }

  /**
   * UC-mrr-005 · API-009. Only the booker, only before the start (BR-mrr-009 — at 09:59 yes, at
   * 10:00 no). CANCELLED no longer holds time, so the slot is free again the moment this commits.
   * The booker and every attendee are mailed inside the transaction: a mail failure cancels
   * nothing (BR-mrr-019). The booker's own action leaves no audit entry (AC-mrr-054).
   */
  async cancel(caller: Caller, id: string): Promise<{ message: string }> {
    const now = this.clock.now();
    return this.db.transaction().execute(async (tx) => {
      const current = await this.lockOwn(tx, caller, id, now);
      await tx.updateTable('bookings').set({ status: 'CANCELLED' }).where('id', '=', id).execute();

      const room = await tx
        .selectFrom('meeting_rooms as r')
        .innerJoin('meeting_room_versions as v', 'v.id', 'r.current_version_id')
        .select('v.name')
        .where('r.id', '=', current.room_id)
        .executeTakeFirstOrThrow();
      const { email: bookerEmail } = await tx
        .selectFrom('users')
        .select('email')
        .where('id', '=', current.booked_by)
        .executeTakeFirstOrThrow();
      const attendeeEmails = (
        await tx
          .selectFrom('booking_attendees as a')
          .innerJoin('users as u', 'u.id', 'a.user_id')
          .select('u.email')
          .where('a.booking_id', '=', id)
          .orderBy('u.email')
          .execute()
      ).map((a) => a.email);
      await this.notifier.bookingCancelled({
        title: current.title, roomName: room.name, startAt: current.start_at, endAt: current.end_at, bookerEmail, attendeeEmails,
      });
      return { message: 'ยกเลิกการจองสำเร็จ' };
    });
  }

  /** The booking, locked for this transaction, if the caller may still change it (ACL-005 · ACL-006). */
  private async lockOwn(tx: Kysely<Database>, caller: Caller, id: string, now: Date) {
    const current = await tx
      .selectFrom('bookings')
      .select(['id', 'room_id', 'booked_by', 'title', 'start_at', 'end_at', 'status'])
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    if (!current) throw new BookingNotFound();
    if (current.booked_by !== caller.userId) throw new NotTheBooker();
    if (current.start_at.getTime() <= now.getTime()) {
      throw new BookingLocked('การประชุมเริ่มแล้ว กรุณาติดต่อผู้ดูแลห้องเพื่อแก้ไขหรือยกเลิก');
    }
    if (!EDITABLE.includes(current.status)) throw new BookingLocked('การจองนี้ถูกยกเลิกหรือปฏิเสธแล้ว แก้ไขหรือยกเลิกไม่ได้');
    return current;
  }

  private async read(db: Kysely<Database>, id: string): Promise<BookingDetail | null> {
    const b = await db
      .selectFrom('bookings as b')
      .innerJoin('meeting_rooms as r', 'r.id', 'b.room_id')
      .innerJoin('meeting_room_versions as v', 'v.id', 'r.current_version_id')
      .innerJoin('users as u', 'u.id', 'b.booked_by')
      .select(['b.id', 'b.room_id', 'v.name as room_name', 'b.start_at', 'b.end_at', 'b.title', 'b.status', 'u.id as booker_id', 'u.full_name as booker'])
      .where('b.id', '=', id)
      .executeTakeFirst();
    if (!b) return null;
    const attendees = await db
      .selectFrom('booking_attendees as a')
      .innerJoin('users as u', 'u.id', 'a.user_id')
      .select(['u.id', 'u.full_name'])
      .where('a.booking_id', '=', id)
      .orderBy('u.full_name')
      .execute();
    const equipment = await db
      .selectFrom('booking_equipment_requests as e')
      .innerJoin('facilities as f', 'f.id', 'e.facility_id')
      .select(['f.id', 'f.name'])
      .where('e.booking_id', '=', id)
      .orderBy('f.name')
      .execute();
    return {
      id: b.id,
      roomId: b.room_id,
      roomName: b.room_name,
      startAt: b.start_at.toISOString(),
      endAt: b.end_at.toISOString(),
      title: b.title,
      status: b.status,
      bookedBy: { id: b.booker_id, fullName: b.booker },
      attendees: attendees.map((a) => ({ id: a.id, fullName: a.full_name })),
      equipment,
    };
  }
}
