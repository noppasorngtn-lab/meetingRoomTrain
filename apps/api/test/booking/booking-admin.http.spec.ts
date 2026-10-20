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

describe('FE-mrr-030 POST /bookings/:id/admin-edit · /admin-cancel', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let app: INestApplication;
  let now: Date;
  let u1: string;
  let ra1: string;
  let booking: string;
  const mail = { down: false, sent: [] as MailMessage[] };

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    const moduleRef = await Test.createTestingModule({ imports: [BookingModule] })
      .overrideProvider(KYSELY).useValue(db)
      .overrideProvider(CLOCK).useValue({ now: () => now })
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

  beforeEach(async () => {
    await truncateAll(db);
    mail.down = false;
    mail.sent = [];
    now = at(18, '10:30');
    u1 = await seedUser(db, 'U1');
    ra1 = await seedUser(db, 'RA1', 'ROOM_ADMINISTRATOR');
    const roomA = await seedRoom(db, 'ห้อง A', ra1);
    booking = await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:00') });
  });

  const post = (verb: 'admin-edit' | 'admin-cancel', body: object, user?: string, id = booking) => {
    const r = request(app.getHttpServer()).post(`/bookings/${id}/${verb}`).send(body);
    return user ? r.set('x-test-user', user) : r;
  };
  const row = () => db.selectFrom('bookings').select(['status', 'title', 'end_at']).where('id', '=', booking).executeTakeFirstOrThrow();

  describe('admin-cancel (API-015)', () => {
    it('AC-mrr-028 200 ยกเลิกการจองสำเร็จ', async () => {
      const res = await post('admin-cancel', { reason: 'ห้องต้องใช้จัดงานด่วน' }, ra1);

      expect([res.status, res.body]).toEqual([200, { message: 'ยกเลิกการจองสำเร็จ' }]);
      expect((await row()).status).toBe('CANCELLED');
    });

    it('AC-mrr-029 400 กรุณาระบุเหตุผล on the reason field, the booking stays', async () => {
      const res = await post('admin-cancel', { reason: '' }, ra1);

      expect([res.status, res.body.field, res.body.message]).toEqual([400, 'reason', 'กรุณาระบุเหตุผล']);
      expect((await row()).status).toBe('CONFIRMED');
    });

    it('a reason left out is the same as an empty one', async () => {
      expect((await post('admin-cancel', {}, ra1)).body.field).toBe('reason');
    });

    it('409 before the start and at the end', async () => {
      now = at(18, '09:59');
      expect((await post('admin-cancel', { reason: 'x' }, ra1)).body).toMatchObject({ statusCode: 409, message: 'ยังไม่ถึงเวลาเริ่มประชุม ผู้จองแก้ไขหรือยกเลิกเองได้' });
      now = at(18, '11:00');
      expect((await post('admin-cancel', { reason: 'x' }, ra1)).body).toMatchObject({ statusCode: 409, message: 'การประชุมจบแล้ว ยกเลิกไม่ได้' });
    });

    it('503 when the mail does not go, the booking stays', async () => {
      mail.down = true;

      const res = await post('admin-cancel', { reason: 'ห้องต้องใช้จัดงานด่วน' }, ra1);

      expect([res.status, res.body.message]).toEqual([503, 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง']);
      expect((await row()).status).toBe('CONFIRMED');
    });

    it('403 for a General User, even the booker', async () => {
      const res = await post('admin-cancel', { reason: 'x' }, u1);

      expect([res.status, res.body.message]).toEqual([403, 'เฉพาะผู้ดูแลห้องเท่านั้นที่ยกเลิกแทนผู้จองได้']);
    });
  });

  describe('admin-edit (API-014)', () => {
    it('AC-mrr-042 200 บันทึกการแก้ไขสำเร็จ at 10:59, the title changed at once', async () => {
      now = at(18, '10:59');

      const res = await post('admin-edit', { title: 'ประชุมวางแผน', reason: 'ผู้จองพิมพ์หัวข้อผิด' }, ra1);

      expect([res.status, res.body]).toEqual([200, { message: 'บันทึกการแก้ไขสำเร็จ' }]);
      expect((await row()).title).toBe('ประชุมวางแผน');
    });

    it('a new end as an ISO instant with offset', async () => {
      const res = await post('admin-edit', { endAt: '2026-10-18T11:30:00+07:00', reason: 'ประชุมยังไม่เสร็จ' }, ra1);

      expect(res.status).toBe(200);
      expect((await row()).end_at).toEqual(at(18, '11:30'));
    });

    it('400 กรุณาระบุเหตุผล on the reason field', async () => {
      const res = await post('admin-edit', { title: 'ประชุมวางแผน', reason: ' ' }, ra1);

      expect([res.status, res.body.field, res.body.message]).toEqual([400, 'reason', 'กรุณาระบุเหตุผล']);
      expect((await row()).title).toBe('ประชุมทีม');
    });

    it('400 on endAt for a time without its offset', async () => {
      const res = await post('admin-edit', { endAt: '2026-10-18T11:30', reason: 'x' }, ra1);

      expect([res.status, res.body.field]).toEqual([400, 'endAt']);
    });

    it('at the end a direct edit is over — the title stays and the edit is sent as a request', async () => {
      now = at(18, '11:00');

      const res = await post('admin-edit', { title: 'ประชุมวางแผน', reason: 'x' }, ra1);

      expect([res.status, res.body.message]).toEqual([200, 'ส่งคำขอแก้ไขแล้ว รอผู้ดูแลห้องคนอื่นอนุมัติ']);
      expect((await row()).title).toBe('ประชุมทีม');
    });

    it('403 for a General User', async () => {
      const res = await post('admin-edit', { title: 'ประชุมวางแผน', reason: 'x' }, u1);

      expect([res.status, res.body.message]).toEqual([403, 'เฉพาะผู้ดูแลห้องเท่านั้นที่แก้แทนผู้จองได้']);
    });
  });

  it('API-007 a Room Administrator reads U1\'s booking to act on it', async () => {
    const res = await request(app.getHttpServer()).get(`/bookings/${booking}`).set('x-test-user', ra1);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: booking, title: 'ประชุมทีม', status: 'CONFIRMED', bookedBy: { id: u1, fullName: 'U1' } });
  });

  it('404 for a booking that does not exist, or an id that is not one', async () => {
    expect((await post('admin-cancel', { reason: 'x' }, ra1, '99999999-9999-9999-9999-999999999999')).status).toBe(404);
    expect((await post('admin-edit', { reason: 'x' }, ra1, 'not-a-uuid')).status).toBe(404);
  });

  it('401 with nobody signed in', async () => {
    expect((await post('admin-cancel', { reason: 'x' })).status).toBe(401);
    expect((await post('admin-edit', { reason: 'x' })).status).toBe(401);
  });
});
