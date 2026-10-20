import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Caller } from '../../common/auth/current-user';
import { KYSELY } from '../../common/database/database.module';
import { Database } from '../../common/database/schema';

export interface MyBooking {
  id: string;
  roomId: string;
  roomName: string;
  startAt: string;
  endAt: string;
  title: string;
  status: Database['bookings']['status'];
}

export interface MyBookingsPage {
  items: MyBooking[];
  page: number;
  pageSize: number;
  total: number;
}

/** UI-mrr-007 overflow — 20 to a page, the latest start first. */
export const PAGE_SIZE = 20;

@Injectable()
export class MyBookingsService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  /**
   * API-006 · ACL-007 scope own — only bookings the caller made, in every status so the history
   * shows too. A booking the caller only attends is not theirs here (AC-mrr-011).
   */
  async list(caller: Caller, page: number): Promise<MyBookingsPage> {
    const mine = this.db.selectFrom('bookings as b').where('b.booked_by', '=', caller.userId);
    const { total } = await mine.select((eb) => eb.fn.countAll<string>().as('total')).executeTakeFirstOrThrow();
    const rows = await mine
      .innerJoin('meeting_rooms as r', 'r.id', 'b.room_id')
      .innerJoin('meeting_room_versions as v', 'v.id', 'r.current_version_id')
      .select(['b.id', 'b.room_id', 'v.name as room_name', 'b.start_at', 'b.end_at', 'b.title', 'b.status'])
      .orderBy('b.start_at', 'desc')
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
        status: b.status,
      })),
      page,
      pageSize: PAGE_SIZE,
      total: Number(total),
    };
  }
}
