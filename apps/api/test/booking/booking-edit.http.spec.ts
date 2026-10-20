import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kysely } from 'kysely';
import request from 'supertest';
import { CLOCK } from '../../src/common/clock';
import { KYSELY } from '../../src/common/database/database.module';
import { Database } from '../../src/common/database/schema';
import { BookingModule } from '../../src/modules/booking/booking.module';
import { MAIL_TRANSPORT, MailMessage } from '../../src/modules/notification/mail-transport';
import { seedBooking, seedRoom, seedUser, startDatabase } from '../support/postgres';

jest.setTimeout(120_000);

describe('FE-mrr-025 GET · PATCH /bookings/:id', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let app: INestApplication;
  let u1: string;
  let u2: string;
  let booking: string;
  const mail = { down: false, sent: [] as MailMessage[] };

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    u1 = await seedUser(db, 'U1');
    u2 = await seedUser(db, 'U2');
    const room = await seedRoom(db, 'ห้อง A', u1);
    booking = await seedBooking(db, {
      room, bookedBy: u1, title: 'ประชุมทีม',
      startAt: new Date('2026-10-17T10:00:00+07:00'), endAt: new Date('2026-10-17T11:00:00+07:00'), attendees: [u2],
    });

    const moduleRef = await Test.createTestingModule({ imports: [BookingModule] })
      .overrideProvider(KYSELY).useValue(db)
      .overrideProvider(CLOCK).useValue({ now: () => new Date('2026-10-16T15:00:00+07:00') })
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

  const patch = (body: object, user?: string, id = booking) => {
    const r = request(app.getHttpServer()).patch(`/bookings/${id}`).send(body);
    return user ? r.set('x-test-user', user) : r;
  };
  const get = (user?: string, id = booking) => {
    const r = request(app.getHttpServer()).get(`/bookings/${id}`);
    return user ? r.set('x-test-user', user) : r;
  };

  it('GET answers the booker with the booking', async () => {
    const res = await get(u1).expect(200);

    expect(res.body).toMatchObject({ id: booking, title: 'ประชุมทีม', roomName: 'ห้อง A', attendees: [{ id: u2, fullName: 'U2' }] });
  });

  it('GET answers 404 to anyone else, and 401 to nobody', async () => {
    await get(u2).expect(404);
    await get().expect(401);
  });

  it('PATCH answers 200 with บันทึกการแก้ไขสำเร็จ, leaving out what was not sent', async () => {
    const res = await patch({ title: 'ประชุมวางแผน' }, u1).expect(200);

    expect(res.body).toEqual({ message: 'บันทึกการแก้ไขสำเร็จ' });
    const after = await get(u1).expect(200);
    expect(after.body).toMatchObject({ title: 'ประชุมวางแผน', attendees: [{ id: u2, fullName: 'U2' }] });
  });

  it('PATCH answers 403 to someone who is not the booker', async () => {
    const res = await patch({ title: 'แอบแก้' }, u2).expect(403);

    expect(res.body.message).toBe('แก้ไขได้เฉพาะการจองที่คุณเป็นผู้จอง');
  });

  it('PATCH answers 400 naming the field', async () => {
    const res = await patch({ title: '' }, u1).expect(400);

    expect(res.body).toMatchObject({ field: 'title', message: 'กรุณาระบุหัวข้อการประชุม' });
  });

  it('PATCH answers 503 and keeps the old time when the mail does not go out', async () => {
    mail.down = true;
    try {
      const res = await patch({ startAt: '2026-10-17T14:00:00+07:00', endAt: '2026-10-17T15:00:00+07:00' }, u1).expect(503);

      expect(res.body.message).toBe('ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง');
    } finally {
      mail.down = false;
    }
    expect((await get(u1)).body.startAt).toBe(new Date('2026-10-17T10:00:00+07:00').toISOString());
  });

  it('PATCH answers 404 for a booking that does not exist, and 401 to nobody', async () => {
    await patch({ title: 'x' }, u1, '00000000-0000-4000-8000-000000000000').expect(404);
    await patch({ title: 'x' }).expect(401);
  });
});
