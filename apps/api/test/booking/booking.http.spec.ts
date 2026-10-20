import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kysely } from 'kysely';
import request from 'supertest';
import { CLOCK } from '../../src/common/clock';
import { KYSELY } from '../../src/common/database/database.module';
import { Database } from '../../src/common/database/schema';
import { BookingModule } from '../../src/modules/booking/booking.module';
import { MAIL_TRANSPORT, MailMessage } from '../../src/modules/notification/mail-transport';
import { UsersModule } from '../../src/modules/users/users.module';
import { seedRoom, seedUser, startDatabase } from '../support/postgres';

jest.setTimeout(120_000);

describe('FE-mrr-024 POST /bookings · GET /users', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let app: INestApplication;
  let u1: string;
  let u2: string;
  let roomA: string;
  let closedRoom: string;
  const mail = { down: false, sent: [] as MailMessage[] };

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    u1 = await seedUser(db, 'U1');
    u2 = await seedUser(db, 'U2');
    await seedUser(db, 'Somchai');
    const gone = await seedUser(db, 'Somsri');
    await db.updateTable('users').set({ active: false }).where('id', '=', gone).execute();
    roomA = (await seedRoom(db, 'ห้อง A', u1)).roomId;
    closedRoom = (await seedRoom(db, 'ห้อง X', u1, { status: 'UNDER_MAINTENANCE' })).roomId;

    const moduleRef = await Test.createTestingModule({ imports: [BookingModule, UsersModule] })
      .overrideProvider(KYSELY).useValue(db)
      .overrideProvider(CLOCK).useValue({ now: () => new Date('2026-10-16T11:00:00+07:00') })
      .overrideProvider(MAIL_TRANSPORT).useValue({
        send: async (m: MailMessage) => {
          if (mail.down) throw new Error('ECONNREFUSED');
          mail.sent.push(m);
        },
      })
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

  const post = (body: object, user?: string) => {
    const r = request(app.getHttpServer()).post('/bookings').send(body);
    return user ? r.set('x-test-user', user) : r;
  };

  const booking = (over: object = {}) => ({
    roomId: roomA,
    startAt: '2026-10-18T13:00:00+07:00',
    endAt: '2026-10-18T14:00:00+07:00',
    title: 'ประชุมทีม',
    attendeeIds: [u2],
    ...over,
  });

  describe('POST /bookings (API-004)', () => {
    it('answers 201 with the booking and the message to show', async () => {
      const res = await post(booking(), u1).expect(201);

      expect(res.body).toEqual({ id: expect.any(String), status: 'CONFIRMED', message: 'จองห้องสำเร็จ' });
    });

    it('answers 409 with the overlap message for a slot already taken', async () => {
      const res = await post(booking({ startAt: '2026-10-18T13:30:00+07:00', endAt: '2026-10-18T14:30:00+07:00' }), u2).expect(409);

      expect(res.body.message).toBe('ห้องนี้ไม่ว่างในช่วงเวลาที่เลือก กรุณาเลือกเวลาอื่น');
    });

    it('answers 401 when nobody is signed in', async () => {
      await post(booking()).expect(401);
    });

    it('answers 400 naming the missing field', async () => {
      const res = await post(booking({ title: '', startAt: '2026-10-19T09:00:00+07:00', endAt: '2026-10-19T10:00:00+07:00' }), u1).expect(400);

      expect(res.body).toMatchObject({ field: 'title', message: 'กรุณาระบุหัวข้อการประชุม' });
    });

    it.each([
      ['a time without an offset', { startAt: '2026-10-19T09:00:00' }],
      ['attendees that are not ids', { attendeeIds: ['U2'] }],
    ])('answers 400 for %s', async (_what, over) => {
      await post(booking(over), u1).expect(400);
    });

    it('answers 404 for a room that does not exist', async () => {
      await post(booking({ roomId: '00000000-0000-4000-8000-000000000000' }), u1).expect(404);
    });

    it('answers 409 with the maintenance message for a room under maintenance', async () => {
      const res = await post(booking({ roomId: closedRoom }), u1).expect(409);

      expect(res.body.message).toBe('ห้องนี้ปิดปรับปรุง ไม่สามารถจองได้');
    });

    it('answers 503 asking to press again when the mail does not go out', async () => {
      mail.down = true;
      try {
        const res = await post(booking({ startAt: '2026-10-20T09:00:00+07:00', endAt: '2026-10-20T10:00:00+07:00' }), u1).expect(503);

        expect(res.body.message).toBe('ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง');
      } finally {
        mail.down = false;
      }
    });
  });

  describe('GET /users (API-005)', () => {
    const get = (query: string, user?: string) => {
      const r = request(app.getHttpServer()).get(`/users${query}`);
      return user ? r.set('x-test-user', user) : r;
    };

    it('lists active users whose name matches, never an inactive one', async () => {
      const res = await get('?query=som', u1).expect(200);

      expect(res.body).toEqual([{ id: expect.any(String), fullName: 'Somchai', email: 'somchai@example.test' }]);
    });

    it('treats % as a letter, not a wildcard', async () => {
      const res = await get('?query=%25', u1).expect(200);

      expect(res.body).toEqual([]);
    });

    it('answers 400 for an empty query', async () => {
      await get('?query=', u1).expect(400);
    });

    it('answers 401 when nobody is signed in', async () => {
      await get('?query=som').expect(401);
    });
  });
});
