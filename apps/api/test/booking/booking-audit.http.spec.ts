import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kysely } from 'kysely';
import request from 'supertest';
import { CLOCK } from '../../src/common/clock';
import { KYSELY } from '../../src/common/database/database.module';
import { Database } from '../../src/common/database/schema';
import { BookingModule } from '../../src/modules/booking/booking.module';
import { MAIL_TRANSPORT, MailMessage } from '../../src/modules/notification/mail-transport';
import { seedBooking, seedRoom, seedUser, startDatabase, truncateAll } from '../support/postgres';

jest.setTimeout(120_000);

const at = (day: number, hhmm: string) => new Date(`2026-10-${day}T${hhmm}:00+07:00`);

const REFUSAL = 'เฉพาะผู้ดูแลห้องและผู้ดูแลระบบเท่านั้นที่ดูร่องรอยได้';

describe('FE-mrr-033 GET /bookings/:id/audit (API-016)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let app: INestApplication;
  let now: Date;
  let u1: string;
  let u2: string;
  let ra1: string;
  let ra2: string;
  let roomA: { roomId: string; versionId: string };

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    const moduleRef = await Test.createTestingModule({ imports: [BookingModule] })
      .overrideProvider(KYSELY).useValue(db)
      .overrideProvider(CLOCK).useValue({ now: () => now })
      .overrideProvider(MAIL_TRANSPORT).useValue({ send: async (_: MailMessage) => undefined })
      .compile();
    app = moduleRef.createNestApplication();
    // Stands in for the sign-in guard that does not exist yet (GAP-mrr-003): x-test-user → request.user.
    app.use((req: any, _res: unknown, next: () => void) => {
      const id = req.headers['x-test-user'];
      if (id) req.user = { userId: id };
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await stop();
  });

  beforeEach(async () => {
    await truncateAll(db);
    u1 = await seedUser(db, 'U1');
    u2 = await seedUser(db, 'U2');
    ra1 = await seedUser(db, 'RA1', 'ROOM_ADMINISTRATOR');
    ra2 = await seedUser(db, 'RA2', 'ROOM_ADMINISTRATOR');
    roomA = await seedRoom(db, 'ห้อง A', ra1);
  });

  const audit = (id: string, user: string) => request(app.getHttpServer()).get(`/bookings/${id}/audit`).set('x-test-user', user);
  const post = (path: string, user: string, body: object = {}) => request(app.getHttpServer()).post(path).set('x-test-user', user).send(body);
  /** ห้อง A 18/10 10:00–11:00 of U1 with U2. */
  const meeting = (status: Database['bookings']['status'] = 'CONFIRMED') =>
    seedBooking(db, { room: roomA, bookedBy: u1, title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:00'), status, attendees: [u2] });

  it('AC-mrr-052 16/10 14:05 RA1 approves — one new entry: RA1 · 16/10 14:05 · APPROVE · no reason', async () => {
    const roomB = await seedRoom(db, 'ห้อง B', ra1, { requiresApproval: true });
    const booking = await seedBooking(db, {
      room: roomB, bookedBy: u1, title: 'ประชุมลูกค้า', startAt: at(18, '10:00'), endAt: at(18, '11:00'), status: 'PENDING_APPROVAL',
    });
    now = at(16, '14:05');

    expect((await post(`/bookings/${booking}/approve`, ra1)).body).toEqual({ message: 'อนุมัติการจองสำเร็จ' });
    const res = await audit(booking, ra1);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: expect.any(String), actor: { id: ra1, fullName: 'RA1' }, action: 'APPROVE', reason: null, detail: null, at: at(16, '14:05').toISOString() },
    ]);
  });

  it('AC-mrr-053 18/10 10:30 RA1 cancels for U1 with ห้องต้องใช้จัดงานด่วน — one new entry, CANCEL_ON_BEHALF with the reason', async () => {
    const booking = await meeting();
    now = at(18, '10:30');

    expect((await post(`/bookings/${booking}/admin-cancel`, ra1, { reason: 'ห้องต้องใช้จัดงานด่วน' })).body).toEqual({ message: 'ยกเลิกการจองสำเร็จ' });
    const res = await audit(booking, ra1);

    expect(res.body.map((e: any) => [e.actor.fullName, e.action, e.reason, e.at])).toEqual([
      ['RA1', 'CANCEL_ON_BEHALF', 'ห้องต้องใช้จัดงานด่วน', at(18, '10:30').toISOString()],
    ]);
  });

  it('AC-mrr-054 U1 cancels their own booking at 17/10 09:00 — the trail has no new entry', async () => {
    const booking = await meeting();
    now = at(17, '09:00');

    expect((await post(`/bookings/${booking}/cancel`, u1)).body).toEqual({ message: 'ยกเลิกการจองสำเร็จ' });
    const res = await audit(booking, ra1);

    expect([res.status, res.body]).toEqual([200, []]);
  });

  it('AC-mrr-055 RA1 cancels for U1 with the reason left empty — กรุณาระบุเหตุผล, and the trail has no new entry', async () => {
    const booking = await meeting();
    now = at(18, '10:30');

    expect((await post(`/bookings/${booking}/admin-cancel`, ra1, { reason: '' })).body.message).toBe('กรุณาระบุเหตุผล');
    const res = await audit(booking, ra1);

    expect([res.status, res.body]).toEqual([200, []]);
  });

  describe('after RA1 cancelled for U1 at 18/10 10:30 with ห้องต้องใช้จัดงานด่วน', () => {
    let booking: string;

    beforeEach(async () => {
      booking = await meeting();
      now = at(18, '10:30');
      await post(`/bookings/${booking}/admin-cancel`, ra1, { reason: 'ห้องต้องใช้จัดงานด่วน' });
    });

    const expected = () => [['RA1', 'CANCEL_ON_BEHALF', 'ห้องต้องใช้จัดงานด่วน', at(18, '10:30').toISOString()]];
    const rows = (body: any[]) => body.map((e) => [e.actor.fullName, e.action, e.reason, e.at]);

    it('AC-mrr-056 RA2 sees the one entry', async () => {
      const res = await audit(booking, ra2);

      expect([res.status, rows(res.body)]).toEqual([200, expected()]);
    });

    it('AC-mrr-057 a System Administrator sees the same entry', async () => {
      const sa = await seedUser(db, 'SA', 'SYSTEM_ADMINISTRATOR');
      const res = await audit(booking, sa);

      expect([res.status, rows(res.body)]).toEqual([200, expected()]);
    });

    it.each([
      ['AC-mrr-058 U1, the booker', () => u1],
      ['AC-mrr-059 U2, an attendee', () => u2],
    ])('%s, gets 403 เฉพาะผู้ดูแลห้องและผู้ดูแลระบบเท่านั้นที่ดูร่องรอยได้ and no trail', async (_, who) => {
      const res = await audit(booking, who());

      expect([res.status, res.body.message]).toEqual([403, REFUSAL]);
      expect(res.body).not.toHaveProperty('length');
    });
  });

  it('404 ไม่พบการจอง for an unknown or malformed id', async () => {
    expect((await audit('00000000-0000-0000-0000-000000000000', ra1)).body).toMatchObject({ statusCode: 404, message: 'ไม่พบการจอง' });
    expect((await audit('nope', ra1)).status).toBe(404);
  });
});
