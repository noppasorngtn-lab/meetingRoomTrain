import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kysely } from 'kysely';
import request from 'supertest';
import { Clock, CLOCK } from '../../src/common/clock';
import { KYSELY } from '../../src/common/database/database.module';
import { Database } from '../../src/common/database/schema';
import { BookingEditService, BookingLocked, BookingNotFound, NotTheBooker } from '../../src/modules/booking/booking-edit.service';
import { BookingModule } from '../../src/modules/booking/booking.module';
import { BookingService } from '../../src/modules/booking/booking.service';
import { BookingNotifier, EmailDeliveryFailed } from '../../src/modules/notification/booking-notifier';
import { MAIL_TRANSPORT, MailMessage, MailTransport } from '../../src/modules/notification/mail-transport';
import { seedBooking, seedRoom, seedUser, startDatabase, truncateAll } from '../support/postgres';

jest.setTimeout(120_000);

/** 2026-10-<day>T<hh:mm> in Bangkok — the examples' "17/10 10:00". */
const at = (day: number, hhmm: string) => new Date(`2026-10-${day}T${hhmm}:00+07:00`);

class FakeTransport implements MailTransport {
  sent: MailMessage[] = [];
  down = false;
  async send(message: MailMessage): Promise<void> {
    if (this.down) throw new Error('ECONNREFUSED');
    this.sent.push(message);
  }
}

describe('FE-mrr-026 cancel own booking (UC-mrr-005)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let mail: FakeTransport;
  let now: Date;
  let service: BookingEditService;
  let create: BookingService;
  let u1: string;
  let u2: string;
  let u3: string;
  let room: { roomId: string; versionId: string };
  let booking: string;
  let app: INestApplication;

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    const moduleRef = await Test.createTestingModule({ imports: [BookingModule] })
      .overrideProvider(KYSELY).useValue(db)
      .overrideProvider(CLOCK).useValue({ now: () => now })
      .overrideProvider(MAIL_TRANSPORT).useValue({ send: (m: MailMessage) => mail.send(m) })
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
    const admin = await seedUser(db, 'Admin', 'ROOM_ADMINISTRATOR');
    room = await seedRoom(db, 'ห้อง A', admin);
    // U1's booking: ห้อง A 18/10 10:00–11:00 'ประชุมทีม', attendees U2 and U3.
    booking = await seedBooking(db, {
      room, bookedBy: u1, title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:00'), attendees: [u2, u3],
    });
    mail = new FakeTransport();
    now = at(17, '09:00');
    const clock: Clock = { now: () => now };
    const notifier = new BookingNotifier(mail);
    service = new BookingEditService(db, clock, notifier);
    create = new BookingService(db, clock, notifier);
  });

  const cancel = (by = u1, id = booking) => service.cancel({ userId: by }, id);
  const status = async () =>
    (await db.selectFrom('bookings').select('status').where('id', '=', booking).executeTakeFirstOrThrow()).status;

  it('AC-mrr-009 cancels and answers ยกเลิกการจองสำเร็จ', async () => {
    const res = await cancel();

    expect(res).toEqual({ message: 'ยกเลิกการจองสำเร็จ' });
    expect(await status()).toBe('CANCELLED');
  });

  it('mails the booker and every attendee (BR-mrr-007 (3))', async () => {
    await cancel();

    expect(mail.sent).toEqual([{
      to: ['u1@example.test', 'u2@example.test', 'u3@example.test'],
      subject: '[จองห้องประชุม] ยกเลิก: ประชุมทีม · ห้อง A 18/10 10:00–11:00',
      text: '[จองห้องประชุม] ยกเลิก: ประชุมทีม · ห้อง A 18/10 10:00–11:00',
    }]);
  });

  it('gives the slot back — someone else can book it at once', async () => {
    await cancel();

    await expect(create.create({ userId: u2 }, {
      roomId: room.roomId, startAt: at(18, '10:00'), endAt: at(18, '11:00'), title: 'ใช้ต่อ', attendeeIds: [u3], equipmentIds: [],
    })).resolves.toMatchObject({ status: 'CONFIRMED' });
  });

  it('a booking still waiting for approval is cancelled and its slot freed the same way', async () => {
    await db.updateTable('bookings').set({ status: 'PENDING_APPROVAL' }).where('id', '=', booking).execute();

    await cancel();

    expect(await status()).toBe('CANCELLED');
  });

  it('AC-mrr-010 an attendee who is not the booker is refused, and the booking stays', async () => {
    const attempt = cancel(u2);

    await expect(attempt).rejects.toThrow(NotTheBooker);
    await expect(attempt).rejects.toThrow('เฉพาะผู้จองเท่านั้นที่แก้ไขหรือยกเลิกได้');
    expect(await status()).toBe('CONFIRMED');
    expect(mail.sent).toEqual([]);
  });

  it('AC-mrr-026 at 09:59 for a 10:00 meeting it is still allowed', async () => {
    now = at(18, '09:59');

    await expect(cancel()).resolves.toEqual({ message: 'ยกเลิกการจองสำเร็จ' });
  });

  it('AC-mrr-027 at 10:00 the meeting has started — the booking stays', async () => {
    now = at(18, '10:00');

    const attempt = cancel();

    await expect(attempt).rejects.toThrow(BookingLocked);
    await expect(attempt).rejects.toThrow('การประชุมเริ่มแล้ว กรุณาติดต่อผู้ดูแลห้องเพื่อแก้ไขหรือยกเลิก');
    expect(await status()).toBe('CONFIRMED');
  });

  it('the mail failing cancels nothing (BR-mrr-019)', async () => {
    mail.down = true;

    await expect(cancel()).rejects.toThrow(EmailDeliveryFailed);
    expect(await status()).toBe('CONFIRMED');
  });

  it('a booking already cancelled cannot be cancelled again', async () => {
    await cancel();

    await expect(cancel()).rejects.toThrow(BookingLocked);
    expect(mail.sent).toHaveLength(1);
  });

  it('a booking that does not exist is not found', async () => {
    await expect(cancel(u1, '00000000-0000-4000-8000-000000000000')).rejects.toThrow(BookingNotFound);
  });

  describe('POST /bookings/:id/cancel (API-009)', () => {
    const post = (user?: string, id = booking) => {
      const r = request(app.getHttpServer()).post(`/bookings/${id}/cancel`);
      return user ? r.set('x-test-user', user) : r;
    };

    it('answers 200 with ยกเลิกการจองสำเร็จ', async () => {
      const res = await post(u1).expect(200);

      expect(res.body).toEqual({ message: 'ยกเลิกการจองสำเร็จ' });
    });

    it('answers 403 with the design\'s words to someone who is not the booker', async () => {
      const res = await post(u2).expect(403);

      expect(res.body.message).toBe('เฉพาะผู้จองเท่านั้นที่แก้ไขหรือยกเลิกได้');
    });

    it('answers 409 once the meeting has started', async () => {
      now = at(18, '10:00');

      const res = await post(u1).expect(409);

      expect(res.body.message).toBe('การประชุมเริ่มแล้ว กรุณาติดต่อผู้ดูแลห้องเพื่อแก้ไขหรือยกเลิก');
    });

    it('answers 503 asking to press again when the mail does not go out', async () => {
      mail.down = true;

      const res = await post(u1).expect(503);

      expect(res.body.message).toBe('ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง');
    });

    it('answers 404 for a booking that does not exist, and 401 to nobody', async () => {
      await post(u1, '00000000-0000-4000-8000-000000000000').expect(404);
      await post().expect(401);
    });
  });
});
