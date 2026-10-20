import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Caller } from '../../common/auth/current-user';
import { CLOCK, Clock } from '../../common/clock';
import { KYSELY } from '../../common/database/database.module';
import { Database } from '../../common/database/schema';
import { BookingNotifier } from '../notification/booking-notifier';

export interface CreateBookingInput {
  roomId: string;
  startAt: Date;
  endAt: Date;
  title: string;
  attendeeIds: string[];
  equipmentIds: string[];
}

export interface CreatedBooking {
  id: string;
  status: 'CONFIRMED' | 'PENDING_APPROVAL';
  message: string;
}

const TITLE_MAX = 200;

/** A field the form must fix before the booking is even looked at (BR-mrr-002 · UI-mrr-006). */
export class BookingInvalid extends Error {
  constructor(readonly field: string, message: string) {
    super(message);
    this.name = 'BookingInvalid';
  }
}

/** The room does not exist or was archived. */
export class BookingRoomNotFound extends Error {
  constructor() {
    super('ไม่พบห้อง');
    this.name = 'BookingRoomNotFound';
  }
}

/** BR-mrr-012 — a room under maintenance takes no new booking. */
export class RoomUnderMaintenance extends Error {
  constructor() {
    super('ห้องนี้ปิดปรับปรุง ไม่สามารถจองได้');
    this.name = 'RoomUnderMaintenance';
  }
}

/** BR-mrr-001 — [start, end) overlaps a booking that holds the time. */
export class SlotTaken extends Error {
  constructor() {
    super('ห้องนี้ไม่ว่างในช่วงเวลาที่เลือก กรุณาเลือกเวลาอื่น');
    this.name = 'SlotTaken';
  }
}

/** PostgreSQL's exclusion_violation — raised by bookings_no_overlap. */
export const EXCLUSION_VIOLATION = '23P01';

/** BR-mrr-002 — returns the title as it is saved. */
export function checkTitle(raw: string): string {
  const title = raw.trim();
  if (!title) throw new BookingInvalid('title', 'กรุณาระบุหัวข้อการประชุม');
  if (title.length > TITLE_MAX) throw new BookingInvalid('title', `หัวข้อการประชุมต้องไม่เกิน ${TITLE_MAX} ตัวอักษร`);
  return title;
}

/** BR-mrr-002 — the booker is not counted unless they are picked (AC-mrr-007). */
export function checkAttendeeIds(ids: string[]): string[] {
  const unique = [...new Set(ids)];
  if (unique.length === 0) throw new BookingInvalid('attendees', 'กรุณาระบุผู้เข้าร่วมอย่างน้อย 1 คน');
  return unique;
}

export function checkTimes(startAt: Date, endAt: Date, now: Date): void {
  if (endAt.getTime() <= startAt.getTime()) throw new BookingInvalid('end', 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม');
  if (startAt.getTime() <= now.getTime()) throw new BookingInvalid('start', 'เวลาเริ่มต้องเป็นเวลาในอนาคต');
}

/** Every id must be an active user; returns them with their email, in no particular order. */
export async function activeAttendees(tx: Kysely<Database>, ids: string[]) {
  const found = await tx.selectFrom('users').select(['id', 'email']).where('id', 'in', ids).where('active', '=', true).execute();
  if (found.length !== ids.length) throw new BookingInvalid('attendees', 'ไม่พบผู้เข้าร่วมบางคนในรายชื่อผู้ใช้');
  return found;
}

/** Every id must be a facility still offered (ENT-004 active). */
export async function checkEquipment(tx: Kysely<Database>, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const found = await tx.selectFrom('facilities').select('id').where('id', 'in', ids).where('active', '=', true).execute();
  if (found.length !== ids.length) throw new BookingInvalid('equipment', 'ไม่พบอุปกรณ์เสริมบางรายการ');
}

@Injectable()
export class BookingService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly notifier: BookingNotifier,
  ) {}

  /**
   * UC-mrr-003. The room's settings are read at the moment of confirming, not when the form was
   * opened (BR-mrr-010 · AC-mrr-031), and the room row stays locked until commit so a switch to
   * maintenance or to needs-approval cannot slip in between.
   *
   * A booking that is usable at once gets its success mail inside the transaction: if the mail
   * fails, nothing is saved (BR-mrr-019). A booking that waits for approval sends no mail — it is
   * not a success yet (BR-mrr-007) and is never reminded (BR-mrr-008).
   */
  async create(caller: Caller, input: CreateBookingInput): Promise<CreatedBooking> {
    const now = this.clock.now();
    const title = checkTitle(input.title);
    const attendeeIds = checkAttendeeIds(input.attendeeIds);
    checkTimes(input.startAt, input.endAt, now);
    const equipmentIds = [...new Set(input.equipmentIds)];

    return this.db.transaction().execute(async (tx) => {
      const room = await tx
        .selectFrom('meeting_rooms as r')
        .innerJoin('meeting_room_versions as v', 'v.id', 'r.current_version_id')
        .select(['r.id', 'r.status', 'v.id as versionId', 'v.name', 'v.requires_approval'])
        .where('r.id', '=', input.roomId)
        .forShare()
        .executeTakeFirst();
      if (!room || room.status === 'ARCHIVED') throw new BookingRoomNotFound();
      if (room.status === 'UNDER_MAINTENANCE') throw new RoomUnderMaintenance();

      const attendees = await activeAttendees(tx, attendeeIds);
      await checkEquipment(tx, equipmentIds);

      const status = room.requires_approval ? 'PENDING_APPROVAL' : 'CONFIRMED';
      let id: string;
      try {
        ({ id } = await tx
          .insertInto('bookings')
          .values({
            room_id: room.id,
            room_version_id: room.versionId,
            booked_by: caller.userId,
            title,
            start_at: input.startAt,
            end_at: input.endAt,
            status,
            reminder_at: null,
            cancel_reason: null,
            created_at: now,
          })
          .returning('id')
          .executeTakeFirstOrThrow());
      } catch (err) {
        if ((err as { code?: string }).code === EXCLUSION_VIOLATION) throw new SlotTaken();
        throw err;
      }
      await tx.insertInto('booking_attendees').values(attendeeIds.map((user_id) => ({ booking_id: id, user_id }))).execute();
      if (equipmentIds.length) {
        await tx
          .insertInto('booking_equipment_requests')
          .values(equipmentIds.map((facility_id) => ({ booking_id: id, facility_id })))
          .execute();
      }

      if (status === 'PENDING_APPROVAL') return { id, status, message: 'ส่งคำขอจองแล้ว รอการอนุมัติ' };

      const booker = await tx.selectFrom('users').select('email').where('id', '=', caller.userId).executeTakeFirstOrThrow();
      const { reminderSent } = await this.notifier.bookingCreated(
        {
          title,
          roomName: room.name,
          startAt: input.startAt,
          endAt: input.endAt,
          bookerEmail: booker.email,
          attendeeEmails: attendeeIds.map((u) => attendees.find((a) => a.id === u)!.email),
        },
        now,
      );
      // The immediate reminder is the one reminder this booking ever gets (BR-mrr-023).
      if (reminderSent) {
        await tx.updateTable('bookings').set({ reminder_status: 'SENT', reminder_at: now }).where('id', '=', id).execute();
      }
      return { id, status, message: 'จองห้องสำเร็จ' };
    });
  }
}
