import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kysely } from 'kysely';
import request from 'supertest';
import { KYSELY } from '../../src/common/database/database.module';
import { Database } from '../../src/common/database/schema';
import { BookingModule } from '../../src/modules/booking/booking.module';
import { MAIL_TRANSPORT } from '../../src/modules/notification/mail-transport';
import { seedBooking, seedRoom, seedUser, startDatabase, truncateAll } from '../support/postgres';

jest.setTimeout(120_000);

/** 2026-10-<day>T<hh:mm> in Bangkok. */
const at = (day: number, hhmm: string) => new Date(`2026-10-${day}T${hhmm}:00+07:00`);

describe('FE-mrr-027 GET /me/bookings (UC-mrr-006)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let app: INestApplication;
  let u1: string;
  let u2: string;
  let roomA: { roomId: string; versionId: string };
  let roomB: { roomId: string; versionId: string };

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    const moduleRef = await Test.createTestingModule({ imports: [BookingModule] })
      .overrideProvider(KYSELY).useValue(db)
      .overrideProvider(MAIL_TRANSPORT).useValue({ send: async () => undefined })
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
    roomA = await seedRoom(db, 'ห้อง A', u1);
    roomB = await seedRoom(db, 'ห้อง B', u1);
  });

  const get = (user?: string, query = '') => {
    const r = request(app.getHttpServer()).get(`/me/bookings${query}`);
    return user ? r.set('x-test-user', user) : r;
  };

  it('AC-mrr-011 lists only what the caller booked — not a booking they merely attend', async () => {
    const mine = await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ของ U1', startAt: at(18, '10:00'), endAt: at(18, '11:00') });
    await seedBooking(db, { room: roomB, bookedBy: u2, title: 'ของ U2', startAt: at(18, '13:00'), endAt: at(18, '14:00'), attendees: [u1] });

    const res = await get(u1).expect(200);

    expect(res.body).toEqual({
      items: [{
        id: mine, roomId: roomA.roomId, roomName: 'ห้อง A',
        startAt: at(18, '10:00').toISOString(), endAt: at(18, '11:00').toISOString(),
        title: 'ของ U1', status: 'CONFIRMED',
      }],
      page: 1,
      pageSize: 20,
      total: 1,
    });
  });

  it('keeps the history — cancelled and rejected bookings are listed with their status', async () => {
    await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ยกเลิก', startAt: at(15, '10:00'), endAt: at(15, '11:00'), status: 'CANCELLED' });
    await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ปฏิเสธ', startAt: at(16, '10:00'), endAt: at(16, '11:00'), status: 'REJECTED' });

    const res = await get(u1).expect(200);

    expect(res.body.items.map((b: { status: string }) => b.status)).toEqual(['REJECTED', 'CANCELLED']);
  });

  it('empty: a caller with no booking gets an empty page', async () => {
    const res = await get(u2).expect(200);

    expect(res.body).toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it('overflow: 20 to a page, the latest start first', async () => {
    for (let d = 1; d <= 25; d++) {
      const day = new Date(Date.UTC(2026, 10, d, 3));
      await seedBooking(db, { room: roomA, bookedBy: u1, title: `วันที่ ${d}`, startAt: day, endAt: new Date(day.getTime() + 3_600_000) });
    }

    const first = await get(u1).expect(200);
    const second = await get(u1, '?page=2').expect(200);

    expect(first.body.items).toHaveLength(20);
    expect(first.body.items[0].title).toBe('วันที่ 25');
    expect(first.body.total).toBe(25);
    expect(second.body.items.map((b: { title: string }) => b.title)).toEqual(['วันที่ 5', 'วันที่ 4', 'วันที่ 3', 'วันที่ 2', 'วันที่ 1']);
  });

  it.each(['?page=0', '?page=abc', '?page=1.5'])('answers 400 for %s', async (query) => {
    await get(u1, query).expect(400);
  });

  it('answers 401 when nobody is signed in', async () => {
    await get().expect(401);
  });
});
