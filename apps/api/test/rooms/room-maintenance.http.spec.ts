import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kysely } from 'kysely';
import request from 'supertest';
import { CLOCK } from '../../src/common/clock';
import { KYSELY } from '../../src/common/database/database.module';
import { Database } from '../../src/common/database/schema';
import { BookingModule } from '../../src/modules/booking/booking.module';
import { MAIL_TRANSPORT, MailMessage } from '../../src/modules/notification/mail-transport';
import { RoomsModule } from '../../src/modules/rooms/rooms.module';
import { seedBooking, seedRoom, seedUser, startDatabase, truncateAll } from '../support/postgres';

jest.setTimeout(120_000);

const at = (day: number, hhmm: string) => new Date(`2026-10-${day}T${hhmm}:00+07:00`);

describe('FE-mrr-035 POST /rooms/:id/maintenance (API-024)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let app: INestApplication;
  let now: Date;
  let u1: string;
  let u2: string;
  let u3: string;
  let ra1: string;
  let roomA: { roomId: string; versionId: string };

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    // BookingModule too: AC-mrr-081 is proved by U2 booking the room once it is open again.
    const moduleRef = await Test.createTestingModule({ imports: [RoomsModule, BookingModule] })
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
    u3 = await seedUser(db, 'U3');
    ra1 = await seedUser(db, 'RA1', 'ROOM_ADMINISTRATOR');
    roomA = await seedRoom(db, 'ห้อง A', ra1);
    now = at(17, '09:00');
  });

  const toggle = (user: string, id = roomA.roomId) =>
    request(app.getHttpServer()).post(`/rooms/${id}/maintenance`).set('x-test-user', user).send();
  /** U2 books ห้อง A 18/10 13:00–14:00 'ประชุมทีม' with U3. */
  const book = () =>
    request(app.getHttpServer()).post('/bookings').set('x-test-user', u2).send({
      roomId: roomA.roomId, startAt: '2026-10-18T13:00:00+07:00', endAt: '2026-10-18T14:00:00+07:00', title: 'ประชุมทีม', attendeeIds: [u3],
    });

  it('AC-mrr-016 200 ตั้งห้องเป็นปิดปรับปรุงแล้ว การจองที่มีอยู่คงเดิม — tomorrow\'s booking stays, and a new one is refused', async () => {
    const kept = await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ประชุมลูกค้า', startAt: at(18, '10:00'), endAt: at(18, '11:00') });

    const res = await toggle(ra1);

    expect([res.status, res.body]).toEqual([200, { message: 'ตั้งห้องเป็นปิดปรับปรุงแล้ว การจองที่มีอยู่คงเดิม', status: 'UNDER_MAINTENANCE' }]);
    expect((await db.selectFrom('bookings').select('status').where('id', '=', kept).executeTakeFirstOrThrow()).status).toBe('CONFIRMED');
    expect((await book()).body.message).toBe('ห้องนี้ปิดปรับปรุง ไม่สามารถจองได้');
  });

  it('AC-mrr-081 200 เปิดห้องใช้งานแล้ว — then U2 books ห้อง A 18/10 13:00–14:00 and it is จองห้องสำเร็จ at once', async () => {
    await toggle(ra1);
    now = at(17, '12:00');

    const res = await toggle(ra1);
    const booked = await book();

    expect([res.status, res.body]).toEqual([200, { message: 'เปิดห้องใช้งานแล้ว', status: 'ACTIVE' }]);
    expect([booked.status, booked.body.status, booked.body.message]).toEqual([201, 'CONFIRMED', 'จองห้องสำเร็จ']);
  });

  it.each([
    ['a General User', 'GENERAL_USER'],
    ['a System Administrator', 'SYSTEM_ADMINISTRATOR'],
  ] as const)('403 for %s, in ACL-015\'s words, and the room stays open', async (_, role) => {
    const who = await seedUser(db, 'X', role);

    const res = await toggle(who);

    expect([res.status, res.body.message]).toEqual([403, 'เฉพาะผู้ดูแลห้องเท่านั้นที่ปิดปรับปรุงหรือเปิดใช้งานห้องได้']);
    expect((await db.selectFrom('meeting_rooms').select('status').where('id', '=', roomA.roomId).executeTakeFirstOrThrow()).status).toBe('ACTIVE');
  });

  it('404 ไม่พบห้อง for an unknown, archived or malformed id', async () => {
    expect((await toggle(ra1, '00000000-0000-0000-0000-000000000000')).body).toMatchObject({ statusCode: 404, message: 'ไม่พบห้อง' });
    await db.updateTable('meeting_rooms').set({ status: 'ARCHIVED' }).where('id', '=', roomA.roomId).execute();
    expect((await toggle(ra1)).status).toBe(404);
    expect((await toggle(ra1, 'nope')).status).toBe(404);
  });
});
