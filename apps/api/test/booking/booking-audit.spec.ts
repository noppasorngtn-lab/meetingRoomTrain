import { Kysely } from 'kysely';
import { Database } from '../../src/common/database/schema';
import { BookingAuditService, NotAuditReader } from '../../src/modules/booking/booking-audit.service';
import { BookingNotFound } from '../../src/modules/booking/booking-edit.service';
import { seedBooking, seedRoom, seedUser, startDatabase, truncateAll } from '../support/postgres';

jest.setTimeout(120_000);

/** 2026-10-<day>T<hh:mm> in Bangkok — the examples' "18/10 10:30". */
const at = (day: number, hhmm: string) => new Date(`2026-10-${day}T${hhmm}:00+07:00`);

describe('FE-mrr-033 a Room or System Administrator reads a booking\'s trail (UC-mrr-012)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let service: BookingAuditService;
  let u1: string;
  let u2: string;
  let ra1: string;
  let ra2: string;
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
    u2 = await seedUser(db, 'U2');
    ra1 = await seedUser(db, 'RA1', 'ROOM_ADMINISTRATOR');
    ra2 = await seedUser(db, 'RA2', 'ROOM_ADMINISTRATOR');
    const roomA = await seedRoom(db, 'ห้อง A', ra1);
    // ห้อง A 18/10 10:00–11:00 of U1 with U2, cancelled by RA1 at 10:30 for 'ห้องต้องใช้จัดงานด่วน'.
    booking = await seedBooking(db, {
      room: roomA, bookedBy: u1, title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:00'), status: 'CANCELLED', attendees: [u2],
    });
    await entry({ actor: ra1, action: 'CANCEL_ON_BEHALF', reason: 'ห้องต้องใช้จัดงานด่วน', at: at(18, '10:30') });
    service = new BookingAuditService(db);
  });

  const entry = (e: { actor: string; action: Database['booking_audit_entries']['action']; reason?: string | null; at: Date; detail?: unknown }) =>
    db
      .insertInto('booking_audit_entries')
      .values({
        booking_id: booking, actor_id: e.actor, action: e.action, reason: e.reason ?? null,
        detail: e.detail === undefined ? null : JSON.stringify(e.detail), at: e.at,
      })
      .execute();

  it('AC-mrr-056 RA2, who did not do it, sees RA1 · 18/10 10:30 · CANCEL_ON_BEHALF · ห้องต้องใช้จัดงานด่วน', async () => {
    const trail = await service.list({ userId: ra2 }, booking);

    expect(trail).toEqual([
      {
        id: expect.any(String),
        actor: { id: ra1, fullName: 'RA1' },
        action: 'CANCEL_ON_BEHALF',
        reason: 'ห้องต้องใช้จัดงานด่วน',
        detail: null,
        at: at(18, '10:30').toISOString(),
      },
    ]);
  });

  it('AC-mrr-057 a System Administrator sees the same trail (ACL-018)', async () => {
    const sa = await seedUser(db, 'SA', 'SYSTEM_ADMINISTRATOR');

    const trail = await service.list({ userId: sa }, booking);

    expect(trail.map((e) => [e.actor.fullName, e.action, e.reason, e.at])).toEqual([
      ['RA1', 'CANCEL_ON_BEHALF', 'ห้องต้องใช้จัดงานด่วน', at(18, '10:30').toISOString()],
    ]);
  });

  it('lists the entries oldest first, an action without a reason carrying null, with the values it changed', async () => {
    await entry({ actor: ra2, action: 'APPROVE', at: at(16, '14:05') });
    await entry({ actor: ra1, action: 'EDIT_ON_BEHALF', reason: 'ผู้จองขอ', at: at(18, '10:15'), detail: { before: { title: 'ประชุม' }, after: { title: 'ประชุมทีม' } } });

    const trail = await service.list({ userId: ra2 }, booking);

    expect(trail.map((e) => [e.actor.fullName, e.action, e.reason, e.at])).toEqual([
      ['RA2', 'APPROVE', null, at(16, '14:05').toISOString()],
      ['RA1', 'EDIT_ON_BEHALF', 'ผู้จองขอ', at(18, '10:15').toISOString()],
      ['RA1', 'CANCEL_ON_BEHALF', 'ห้องต้องใช้จัดงานด่วน', at(18, '10:30').toISOString()],
    ]);
    expect(trail[1].detail).toEqual({ before: { title: 'ประชุม' }, after: { title: 'ประชุมทีม' } });
  });

  it('a booking with nothing done to it has an empty trail', async () => {
    const other = await seedBooking(db, {
      room: await seedRoom(db, 'ห้อง B', ra1), bookedBy: u1, title: 'ประชุมลูกค้า', startAt: at(19, '10:00'), endAt: at(19, '11:00'),
    });

    expect(await service.list({ userId: ra2 }, other)).toEqual([]);
  });

  it('a booking that does not exist is ไม่พบการจอง', async () => {
    await expect(service.list({ userId: ra2 }, '99999999-9999-9999-9999-999999999999')).rejects.toBeInstanceOf(BookingNotFound);
  });

  it.each([
    ['AC-mrr-058 U1, the booker', () => u1],
    ['AC-mrr-059 U2, an attendee', () => u2],
  ])('%s, is a General User and is refused: เฉพาะผู้ดูแลห้องและผู้ดูแลระบบเท่านั้นที่ดูร่องรอยได้', async (_, who) => {
    const read = service.list({ userId: who() }, booking);

    await expect(read).rejects.toBeInstanceOf(NotAuditReader);
    await expect(read).rejects.toThrow('เฉพาะผู้ดูแลห้องและผู้ดูแลระบบเท่านั้นที่ดูร่องรอยได้');
  });
});
