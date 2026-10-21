import { Kysely } from 'kysely';
import { Clock } from '../../src/common/clock';
import { Database } from '../../src/common/database/schema';
import { NotRoomAdministrator } from '../../src/modules/booking/room-admin';
import { RoomInfoNotFound } from '../../src/modules/rooms/rooms.service';
import { RoomMaintenanceService } from '../../src/modules/rooms/room-maintenance.service';
import { seedBooking, seedRoom, seedUser, startDatabase, truncateAll } from '../support/postgres';

jest.setTimeout(120_000);

/** 2026-10-<day>T<hh:mm> in Bangkok — the examples' "18/10 10:00". */
const at = (day: number, hhmm: string) => new Date(`2026-10-${day}T${hhmm}:00+07:00`);

describe('FE-mrr-035 a Room Administrator puts a room under maintenance or opens it again (UC-mrr-014)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let now: Date;
  let service: RoomMaintenanceService;
  let u1: string;
  let ra1: string;
  let roomA: { roomId: string; versionId: string };
  let booking: string;

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
  });

  afterAll(async () => {
    await stop();
  });

  beforeEach(async () => {
    await truncateAll(db);
    u1 = await seedUser(db, 'U1');
    ra1 = await seedUser(db, 'RA1', 'ROOM_ADMINISTRATOR');
    roomA = await seedRoom(db, 'ห้อง A', ra1);
    // SCN-mrr-053 — ห้อง A ACTIVE, with a CONFIRMED booking tomorrow 10:00–11:00.
    booking = await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:00') });
    now = at(17, '09:00');
    const clock: Clock = { now: () => now };
    service = new RoomMaintenanceService(db, clock);
  });

  const roomStatus = async () => (await db.selectFrom('meeting_rooms').select('status').where('id', '=', roomA.roomId).executeTakeFirstOrThrow()).status;
  const periods = () =>
    db.selectFrom('room_maintenance_periods').select(['start_at', 'end_at', 'set_by']).where('room_id', '=', roomA.roomId).orderBy('start_at').execute();

  it('AC-mrr-016 ห้อง A becomes UNDER_MAINTENANCE, tomorrow\'s booking stays CONFIRMED, and a period opens with no end', async () => {
    const done = await service.toggle({ userId: ra1 }, roomA.roomId);

    expect(done).toEqual({ message: 'ตั้งห้องเป็นปิดปรับปรุงแล้ว การจองที่มีอยู่คงเดิม', status: 'UNDER_MAINTENANCE' });
    expect(await roomStatus()).toBe('UNDER_MAINTENANCE');
    expect(await periods()).toEqual([{ start_at: at(17, '09:00'), end_at: null, set_by: ra1 }]);
    const kept = await db.selectFrom('bookings').select(['status', 'start_at', 'end_at']).where('id', '=', booking).executeTakeFirstOrThrow();
    expect(kept).toEqual({ status: 'CONFIRMED', start_at: at(18, '10:00'), end_at: at(18, '11:00') });
  });

  it('AC-mrr-081 opening ห้อง A again: ACTIVE, เปิดห้องใช้งานแล้ว, and the open period gets its end', async () => {
    await service.toggle({ userId: ra1 }, roomA.roomId);
    now = at(18, '12:00');

    const done = await service.toggle({ userId: ra1 }, roomA.roomId);

    expect(done).toEqual({ message: 'เปิดห้องใช้งานแล้ว', status: 'ACTIVE' });
    expect(await roomStatus()).toBe('ACTIVE');
    expect(await periods()).toEqual([{ start_at: at(17, '09:00'), end_at: at(18, '12:00'), set_by: ra1 }]);
  });

  it('closing again later opens a second period, the first one kept as it was', async () => {
    await service.toggle({ userId: ra1 }, roomA.roomId);
    now = at(18, '12:00');
    await service.toggle({ userId: ra1 }, roomA.roomId);
    now = at(19, '08:00');

    await service.toggle({ userId: ra1 }, roomA.roomId);

    expect(await periods()).toEqual([
      { start_at: at(17, '09:00'), end_at: at(18, '12:00'), set_by: ra1 },
      { start_at: at(19, '08:00'), end_at: null, set_by: ra1 },
    ]);
  });

  it.each([
    ['a General User', 'GENERAL_USER'],
    ['a System Administrator', 'SYSTEM_ADMINISTRATOR'],
  ] as const)('%s is refused (ACL-015) and the room stays ACTIVE with no period', async (_, role) => {
    const who = await seedUser(db, 'X', role);

    const press = service.toggle({ userId: who }, roomA.roomId);

    await expect(press).rejects.toBeInstanceOf(NotRoomAdministrator);
    await expect(press).rejects.toThrow('เฉพาะผู้ดูแลห้องเท่านั้นที่ปิดปรับปรุงหรือเปิดใช้งานห้องได้');
    expect(await roomStatus()).toBe('ACTIVE');
    expect(await periods()).toEqual([]);
  });

  it('a room that does not exist, or was archived, is ไม่พบห้อง and nothing changes (ACL-015 condition)', async () => {
    await expect(service.toggle({ userId: ra1 }, '99999999-9999-9999-9999-999999999999')).rejects.toBeInstanceOf(RoomInfoNotFound);
    await db.updateTable('meeting_rooms').set({ status: 'ARCHIVED' }).where('id', '=', roomA.roomId).execute();

    await expect(service.toggle({ userId: ra1 }, roomA.roomId)).rejects.toBeInstanceOf(RoomInfoNotFound);
    expect(await roomStatus()).toBe('ARCHIVED');
    expect(await periods()).toEqual([]);
  });
});
