import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Caller } from '../../common/auth/current-user';
import { CLOCK, Clock } from '../../common/clock';
import { KYSELY } from '../../common/database/database.module';
import { Database } from '../../common/database/schema';
import { assertRoomAdministrator } from '../booking/room-admin';
import { RoomInfoNotFound } from './rooms.service';

/**
 * API-024 — a Room Administrator puts a room under maintenance or opens it again (UC-mrr-014 ·
 * ACL-015). The bookings it already has stay as they are; only new ones are refused while it is
 * closed (BR-mrr-012), and that refusal lives where a booking is made.
 */
@Injectable()
export class RoomMaintenanceService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** STM-mrr-003 ACTIVE ↔ UNDER_MAINTENANCE, opening or closing the room's ENT-006 period. */
  async toggle(caller: Caller, roomId: string): Promise<{ message: string; status: 'ACTIVE' | 'UNDER_MAINTENANCE' }> {
    const now = this.clock.now();
    return this.db.transaction().execute(async (tx) => {
      // ACL-015 is ROLE-002's alone — a System Administrator does not do it either.
      await assertRoomAdministrator(tx, caller, 'เฉพาะผู้ดูแลห้องเท่านั้นที่ปิดปรับปรุงหรือเปิดใช้งานห้องได้');
      // Locked, so two presses at once cannot both read the same state and open two periods.
      const room = await tx.selectFrom('meeting_rooms').select(['id', 'status']).where('id', '=', roomId).forUpdate().executeTakeFirst();
      // ACL-015 condition — only ACTIVE or UNDER_MAINTENANCE; an archived room is gone (STM-mrr-003).
      if (!room || room.status === 'ARCHIVED') throw new RoomInfoNotFound();
      if (room.status === 'UNDER_MAINTENANCE') {
        await tx.updateTable('meeting_rooms').set({ status: 'ACTIVE' }).where('id', '=', room.id).execute();
        await tx.updateTable('room_maintenance_periods').set({ end_at: now }).where('room_id', '=', room.id).where('end_at', 'is', null).execute();
        return { message: 'เปิดห้องใช้งานแล้ว', status: 'ACTIVE' as const };
      }
      await tx.updateTable('meeting_rooms').set({ status: 'UNDER_MAINTENANCE' }).where('id', '=', room.id).execute();
      await tx.insertInto('room_maintenance_periods').values({ room_id: room.id, start_at: now, end_at: null, set_by: caller.userId }).execute();
      return { message: 'ตั้งห้องเป็นปิดปรับปรุงแล้ว การจองที่มีอยู่คงเดิม', status: 'UNDER_MAINTENANCE' as const };
    });
  }
}
