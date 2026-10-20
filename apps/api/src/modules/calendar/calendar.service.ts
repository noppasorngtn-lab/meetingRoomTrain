import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { KYSELY } from '../../common/database/database.module';
import { Caller } from '../../common/auth/current-user';
import { Database } from '../../common/database/schema';
import { CalendarView, rangeOf } from './calendar-range';

export type { Caller };

export interface CalendarSlot {
  startAt: string;
  endAt: string;
  busy: true;
  /** Only on bookings the caller made or attends (BR-mrr-021 · ACL-003 scope own). */
  details?: { bookedBy: string; title: string; attendees: string[] };
}

export interface RoomCalendar {
  roomId: string;
  view: CalendarView;
  from: string;
  to: string;
  slots: CalendarSlot[];
}

/** The room does not exist or was deleted (UC-mrr-002 exception flow). */
export class RoomNotFound extends Error {
  constructor(readonly roomId: string) {
    super('ไม่พบห้อง');
    this.name = 'RoomNotFound';
  }
}

/** Statuses that hold the room's time — the same three the no-overlap rule counts (BR-mrr-001). */
const HOLDS_TIME = ['PENDING_APPROVAL', 'CONFIRMED', 'APPROVED'] as const;

@Injectable()
export class CalendarService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async forRoom(caller: Caller, roomId: string, view: CalendarView, date: string): Promise<RoomCalendar> {
    const room = await this.db
      .selectFrom('meeting_rooms')
      .select('id')
      .where('id', '=', roomId)
      .where('status', '!=', 'ARCHIVED')
      .executeTakeFirst();
    if (!room) throw new RoomNotFound(roomId);

    const { from, to } = rangeOf(view, date);

    const bookings = await this.db
      .selectFrom('bookings as b')
      .innerJoin('users as u', 'u.id', 'b.booked_by')
      .select(['b.id', 'b.booked_by', 'b.title', 'b.start_at', 'b.end_at', 'u.full_name as booker'])
      .where('b.room_id', '=', roomId)
      .where('b.status', 'in', HOLDS_TIME)
      .where('b.start_at', '<', to)
      .where('b.end_at', '>', from)
      .orderBy('b.start_at')
      .execute();

    const ids = bookings.map((b) => b.id);
    const attendees = ids.length
      ? await this.db
          .selectFrom('booking_attendees as a')
          .innerJoin('users as u', 'u.id', 'a.user_id')
          .select(['a.booking_id', 'a.user_id', 'u.full_name'])
          .where('a.booking_id', 'in', ids)
          .orderBy('u.full_name')
          .execute()
      : [];

    const slots = bookings.map((b): CalendarSlot => {
      const people = attendees.filter((a) => a.booking_id === b.id);
      const mine = b.booked_by === caller.userId || people.some((a) => a.user_id === caller.userId);
      const slot: CalendarSlot = { startAt: b.start_at.toISOString(), endAt: b.end_at.toISOString(), busy: true };
      if (mine) slot.details = { bookedBy: b.booker, title: b.title, attendees: people.map((a) => a.full_name) };
      return slot;
    });

    return { roomId, view, from: from.toISOString(), to: to.toISOString(), slots };
  }
}
