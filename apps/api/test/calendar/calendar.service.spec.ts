import { Kysely } from 'kysely';
import { Database } from '../../src/common/database/schema';
import { CalendarService, RoomNotFound } from '../../src/modules/calendar/calendar.service';
import { seedBooking, seedRoom, seedUser, startDatabase, truncateAll } from '../support/postgres';

jest.setTimeout(120_000);

const at = (day: string, hhmm: string) => new Date(`2026-10-${day}T${hhmm}:00+07:00`);

describe('FE-mrr-023 CalendarService', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let calendar: CalendarService;
  let u1: string, u2: string, u3: string, u4: string;
  let roomA: { roomId: string; versionId: string };

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    calendar = new CalendarService(db);
  });
  afterAll(() => stop());

  beforeEach(async () => {
    await truncateAll(db);
    [u1, u2, u3, u4] = [await seedUser(db, 'U1'), await seedUser(db, 'U2'), await seedUser(db, 'U3'), await seedUser(db, 'U4')];
    roomA = await seedRoom(db, 'ห้อง A', u1);
    await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ประชุมทีม', startAt: at('17', '10:00'), endAt: at('17', '11:00'), attendees: [u2, u3] });
  });

  it('AC-mrr-066 the booker sees who booked, the title and the attendees', async () => {
    const cal = await calendar.forRoom({ userId: u1 }, roomA.roomId, 'day', '2026-10-17');

    expect(cal.slots).toEqual([
      {
        startAt: at('17', '10:00').toISOString(),
        endAt: at('17', '11:00').toISOString(),
        busy: true,
        details: { bookedBy: 'U1', title: 'ประชุมทีม', attendees: ['U2', 'U3'] },
      },
    ]);
  });

  it('AC-mrr-067 an attendee sees the same details', async () => {
    const cal = await calendar.forRoom({ userId: u2 }, roomA.roomId, 'day', '2026-10-17');

    expect(cal.slots[0].details).toEqual({ bookedBy: 'U1', title: 'ประชุมทีม', attendees: ['U2', 'U3'] });
  });

  it('AC-mrr-068 someone not involved sees only that the slot is taken', async () => {
    const cal = await calendar.forRoom({ userId: u4 }, roomA.roomId, 'day', '2026-10-17');

    expect(cal.slots).toEqual([{ startAt: at('17', '10:00').toISOString(), endAt: at('17', '11:00').toISOString(), busy: true }]);
  });

  it('AC-mrr-069 a pending booking shows to an outsider as taken, without its status', async () => {
    const roomB = await seedRoom(db, 'ห้อง B', u1, { requiresApproval: true });
    await seedBooking(db, { room: roomB, bookedBy: u1, title: 'ประชุมลูกค้า', startAt: at('17', '10:00'), endAt: at('17', '11:00'), status: 'PENDING_APPROVAL', attendees: [u2] });

    const cal = await calendar.forRoom({ userId: u4 }, roomB.roomId, 'day', '2026-10-17');

    expect(cal.slots).toEqual([{ startAt: at('17', '10:00').toISOString(), endAt: at('17', '11:00').toISOString(), busy: true }]);
  });

  it('cancelled and rejected bookings no longer hold the slot', async () => {
    await seedBooking(db, { room: roomA, bookedBy: u4, title: 'x', startAt: at('17', '13:00'), endAt: at('17', '14:00'), status: 'CANCELLED' });
    await seedBooking(db, { room: roomA, bookedBy: u4, title: 'y', startAt: at('17', '15:00'), endAt: at('17', '16:00'), status: 'REJECTED' });

    const cal = await calendar.forRoom({ userId: u4 }, roomA.roomId, 'day', '2026-10-17');

    expect(cal.slots.map((s) => s.startAt)).toEqual([at('17', '10:00').toISOString()]);
  });

  // 2026-10-17 is a Saturday: its week runs Monday 12/10 to Sunday 18/10, its month 1/10 to 31/10.
  it('the week view of 17/10 covers Monday 12/10 to the end of Sunday 18/10, Bangkok time', async () => {
    await seedBooking(db, { room: roomA, bookedBy: u1, title: 'จันทร์', startAt: at('12', '00:00'), endAt: at('12', '01:00') });
    await seedBooking(db, { room: roomA, bookedBy: u1, title: 'อาทิตย์ก่อน', startAt: at('11', '23:00'), endAt: at('12', '00:00') });
    await seedBooking(db, { room: roomA, bookedBy: u1, title: 'จันทร์หน้า', startAt: at('19', '00:00'), endAt: at('19', '01:00') });

    const cal = await calendar.forRoom({ userId: u1 }, roomA.roomId, 'week', '2026-10-17');

    expect(cal.from).toBe(at('12', '00:00').toISOString());
    expect(cal.to).toBe(at('19', '00:00').toISOString());
    expect(cal.slots.map((s) => s.details?.title)).toEqual(['จันทร์', 'ประชุมทีม']);
  });

  it('the month view of 17/10 covers 1/10 to the end of 31/10, Bangkok time', async () => {
    await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ต้นเดือน', startAt: at('01', '08:00'), endAt: at('01', '09:00') });
    await seedBooking(db, { room: roomA, bookedBy: u1, title: 'สิ้นเดือน', startAt: at('31', '23:00'), endAt: new Date('2026-11-01T00:00:00+07:00') });
    await seedBooking(db, { room: roomA, bookedBy: u1, title: 'พฤศจิกา', startAt: new Date('2026-11-01T00:00:00+07:00'), endAt: new Date('2026-11-01T01:00:00+07:00') });

    const cal = await calendar.forRoom({ userId: u1 }, roomA.roomId, 'month', '2026-10-17');

    expect(cal.from).toBe(at('01', '00:00').toISOString());
    expect(cal.to).toBe(new Date('2026-11-01T00:00:00+07:00').toISOString());
    expect(cal.slots.map((s) => s.details?.title)).toEqual(['ต้นเดือน', 'ประชุมทีม', 'สิ้นเดือน']);
  });

  it('a room that does not exist is reported as not found', async () => {
    await expect(calendar.forRoom({ userId: u1 }, '00000000-0000-0000-0000-000000000001', 'day', '2026-10-17')).rejects.toThrow(RoomNotFound);
  });

  it('a deleted (archived) room is reported as not found', async () => {
    const gone = await seedRoom(db, 'ห้อง C', u1, { status: 'ARCHIVED' });

    await expect(calendar.forRoom({ userId: u1 }, gone.roomId, 'day', '2026-10-17')).rejects.toThrow(RoomNotFound);
  });

  it('a room under maintenance still shows its calendar', async () => {
    const closed = await seedRoom(db, 'ห้อง D', u1, { status: 'UNDER_MAINTENANCE' });

    await expect(calendar.forRoom({ userId: u1 }, closed.roomId, 'day', '2026-10-17')).resolves.toMatchObject({ slots: [] });
  });
});
