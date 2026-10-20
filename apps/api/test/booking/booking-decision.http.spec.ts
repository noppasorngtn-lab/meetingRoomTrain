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

describe('FE-mrr-029 POST /bookings/:id/decision', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let app: INestApplication;
  let now: Date;
  let u1: string;
  let ra: string;
  let roomB: { roomId: string; versionId: string };
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
    now = at(16, '15:00');
    u1 = await seedUser(db, 'U1');
    ra = await seedUser(db, 'RA', 'ROOM_ADMINISTRATOR');
    roomB = await seedRoom(db, 'ห้อง B', ra, { requiresApproval: true });
    booking = await seedBooking(db, {
      room: roomB, bookedBy: u1, title: 'ประชุมลูกค้า', startAt: at(18, '10:00'), endAt: at(18, '11:00'), status: 'APPROVED',
    });
  });

  const decide = (body: object, user?: string, id = booking) => {
    const r = request(app.getHttpServer()).post(`/bookings/${id}/decision`).send(body);
    return user ? r.set('x-test-user', user) : r;
  };
  const status = async () =>
    (await db.selectFrom('bookings').select('status').where('id', '=', booking).executeTakeFirstOrThrow()).status;

  it('AC-mrr-033 200 เปลี่ยนผลการอนุมัติสำเร็จ', async () => {
    const res = await decide({ decision: 'REJECTED', reason: 'อนุมัติผิดห้อง' }, ra);

    expect([res.status, res.body]).toEqual([200, { message: 'เปลี่ยนผลการอนุมัติสำเร็จ' }]);
    expect(await status()).toBe('REJECTED');
  });

  it('AC-mrr-034 400 กรุณาระบุเหตุผล on the reason field, still approved', async () => {
    const res = await decide({ decision: 'REJECTED', reason: '' }, ra);

    expect([res.status, res.body.field, res.body.message]).toEqual([400, 'reason', 'กรุณาระบุเหตุผล']);
    expect(await status()).toBe('APPROVED');
  });

  it('a reason left out entirely is the same as an empty one', async () => {
    const res = await decide({ decision: 'REJECTED' }, ra);

    expect([res.status, res.body.field]).toEqual([400, 'reason']);
  });

  it('400 on the decision field for anything but APPROVED or REJECTED', async () => {
    const res = await decide({ decision: 'CANCELLED', reason: 'อนุมัติผิดห้อง' }, ra);

    expect([res.status, res.body.field]).toEqual([400, 'decision']);
    expect(await status()).toBe('APPROVED');
  });

  it('AC-mrr-036 409 การประชุมเริ่มแล้ว ไม่สามารถเปลี่ยนผลการอนุมัติได้ at 10:00', async () => {
    now = at(18, '10:00');

    const res = await decide({ decision: 'REJECTED', reason: 'อนุมัติผิดห้อง' }, ra);

    expect([res.status, res.body.message]).toEqual([409, 'การประชุมเริ่มแล้ว ไม่สามารถเปลี่ยนผลการอนุมัติได้']);
  });

  it('AC-mrr-035 200 at 09:59 for rejected → approved', async () => {
    await db.updateTable('bookings').set({ status: 'REJECTED' }).where('id', '=', booking).execute();
    now = at(18, '09:59');

    const res = await decide({ decision: 'APPROVED', reason: 'ปฏิเสธผิดคน' }, ra);

    expect([res.status, res.body.message]).toEqual([200, 'เปลี่ยนผลการอนุมัติสำเร็จ']);
    expect(await status()).toBe('APPROVED');
  });

  it('409 ห้องนี้ไม่ว่าง when approving again a slot someone has booked since', async () => {
    await db.updateTable('bookings').set({ status: 'REJECTED' }).where('id', '=', booking).execute();
    await seedBooking(db, { room: roomB, bookedBy: u1, title: 'อื่น', startAt: at(18, '10:00'), endAt: at(18, '11:00'), status: 'CONFIRMED' });

    const res = await decide({ decision: 'APPROVED', reason: 'ปฏิเสธผิดคน' }, ra);

    expect([res.status, res.body.message]).toEqual([409, 'ห้องนี้ไม่ว่างในช่วงเวลาที่เลือก กรุณาเลือกเวลาอื่น']);
  });

  it('503 ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง when approving again and the mail does not go', async () => {
    await db.updateTable('bookings').set({ status: 'REJECTED' }).where('id', '=', booking).execute();
    mail.down = true;

    const res = await decide({ decision: 'APPROVED', reason: 'ปฏิเสธผิดคน' }, ra);

    expect([res.status, res.body.message]).toEqual([503, 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง']);
    expect(await status()).toBe('REJECTED');
  });

  it('403 for a General User', async () => {
    const res = await decide({ decision: 'REJECTED', reason: 'อนุมัติผิดห้อง' }, u1);

    expect([res.status, res.body.message]).toEqual([403, 'เฉพาะผู้ดูแลห้องเท่านั้นที่เปลี่ยนผลการอนุมัติได้']);
  });

  it('404 for a booking that does not exist, or an id that is not one', async () => {
    expect((await decide({ decision: 'REJECTED', reason: 'x' }, ra, '99999999-9999-9999-9999-999999999999')).status).toBe(404);
    expect((await decide({ decision: 'REJECTED', reason: 'x' }, ra, 'not-a-uuid')).status).toBe(404);
  });

  it('401 with nobody signed in', async () => {
    expect((await decide({ decision: 'REJECTED', reason: 'อนุมัติผิดห้อง' })).status).toBe(401);
  });
});
