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

describe('FE-mrr-028 GET /bookings?status=PENDING_APPROVAL · POST /bookings/:id/approve · /reject', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let app: INestApplication;
  let u1: string;
  let ra1: string;
  let ra2: string;
  let roomB: { roomId: string; versionId: string };
  let booking: string;
  const mail = { down: false, sent: [] as MailMessage[] };

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    const moduleRef = await Test.createTestingModule({ imports: [BookingModule] })
      .overrideProvider(KYSELY).useValue(db)
      .overrideProvider(CLOCK).useValue({ now: () => at(16, '14:05') })
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
    u1 = await seedUser(db, 'U1');
    ra1 = await seedUser(db, 'RA1', 'ROOM_ADMINISTRATOR');
    ra2 = await seedUser(db, 'RA2', 'ROOM_ADMINISTRATOR');
    roomB = await seedRoom(db, 'ห้อง B', ra1, { requiresApproval: true });
    await db.updateTable('meeting_room_versions').set({ approver_id: ra1 }).where('id', '=', roomB.versionId).execute();
    booking = await seedBooking(db, {
      room: roomB, bookedBy: u1, title: 'ประชุมลูกค้า', startAt: at(18, '10:00'), endAt: at(18, '11:00'), status: 'PENDING_APPROVAL',
    });
  });

  const decide = (verb: 'approve' | 'reject', user?: string, id = booking) => {
    const r = request(app.getHttpServer()).post(`/bookings/${id}/${verb}`);
    return user ? r.set('x-test-user', user) : r;
  };
  const list = (query: string, user?: string) => {
    const r = request(app.getHttpServer()).get(`/bookings${query}`);
    return user ? r.set('x-test-user', user) : r;
  };
  const status = async () =>
    (await db.selectFrom('bookings').select('status').where('id', '=', booking).executeTakeFirstOrThrow()).status;

  it('AC-mrr-037 200 อนุมัติการจองสำเร็จ', async () => {
    const res = await decide('approve', ra1);

    expect([res.status, res.body]).toEqual([200, { message: 'อนุมัติการจองสำเร็จ' }]);
    expect(await status()).toBe('APPROVED');
  });

  it('AC-mrr-014 403 เฉพาะผู้ดูแลห้องเท่านั้นที่อนุมัติได้ for a General User', async () => {
    const res = await decide('approve', u1);

    expect([res.status, res.body.message]).toEqual([403, 'เฉพาะผู้ดูแลห้องเท่านั้นที่อนุมัติได้']);
    expect(await status()).toBe('PENDING_APPROVAL');
  });

  it('AC-mrr-038 403 เฉพาะผู้อนุมัติประจำห้องนี้เท่านั้นที่อนุมัติได้ for another Room Administrator', async () => {
    const res = await decide('approve', ra2);

    expect([res.status, res.body.message]).toEqual([403, 'เฉพาะผู้อนุมัติประจำห้องนี้เท่านั้นที่อนุมัติได้']);
    expect(await status()).toBe('PENDING_APPROVAL');
  });

  it('AC-mrr-062 503 ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง, still pending', async () => {
    mail.down = true;

    const res = await decide('approve', ra1);

    expect([res.status, res.body.message]).toEqual([503, 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง']);
    expect(await status()).toBe('PENDING_APPROVAL');
  });

  it('409 การจองนี้ไม่ได้รออนุมัติแล้ว once it has been decided', async () => {
    await decide('approve', ra1);

    const res = await decide('reject', ra1);

    expect([res.status, res.body.message]).toEqual([409, 'การจองนี้ไม่ได้รออนุมัติแล้ว']);
  });

  it('200 ปฏิเสธการจองสำเร็จ', async () => {
    const res = await decide('reject', ra1);

    expect([res.status, res.body]).toEqual([200, { message: 'ปฏิเสธการจองสำเร็จ' }]);
    expect(await status()).toBe('REJECTED');
  });

  it('403 เฉพาะผู้ดูแลห้องเท่านั้นที่ปฏิเสธได้ for a General User', async () => {
    const res = await decide('reject', u1);

    expect([res.status, res.body.message]).toEqual([403, 'เฉพาะผู้ดูแลห้องเท่านั้นที่ปฏิเสธได้']);
  });

  it('404 for a booking that does not exist, or an id that is not one', async () => {
    expect((await decide('approve', ra1, '99999999-9999-9999-9999-999999999999')).status).toBe(404);
    expect((await decide('reject', ra1, 'not-a-uuid')).status).toBe(404);
  });

  it('401 with nobody signed in', async () => {
    expect((await decide('approve')).status).toBe(401);
    expect((await decide('reject')).status).toBe(401);
    expect((await list('?status=PENDING_APPROVAL')).status).toBe(401);
  });

  it('API-010 200 the pending page', async () => {
    const res = await list('?status=PENDING_APPROVAL&page=1', ra2);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 1 });
    expect(res.body.items).toEqual([expect.objectContaining({
      id: booking, roomName: 'ห้อง B', title: 'ประชุมลูกค้า',
      bookedBy: { id: u1, fullName: 'U1' }, approver: { id: ra1, fullName: 'RA1' }, canDecide: false,
    })]);
  });

  it('API-010 page defaults to 1', async () => {
    const res = await list('?status=PENDING_APPROVAL', ra1);

    expect([res.status, res.body.page]).toEqual([200, 1]);
  });

  it('API-010 403 คุณไม่มีสิทธิ์เข้าหน้านี้ for a General User', async () => {
    const res = await list('?status=PENDING_APPROVAL', u1);

    expect([res.status, res.body.message]).toEqual([403, 'คุณไม่มีสิทธิ์เข้าหน้านี้']);
  });

  it('API-010 400 for any other status or a page that is not a whole number from 1', async () => {
    expect((await list('', ra1)).status).toBe(400);
    expect((await list('?status=APPROVED', ra1)).status).toBe(400);
    expect((await list('?status=PENDING_APPROVAL&page=0', ra1)).status).toBe(400);
    expect((await list('?status=PENDING_APPROVAL&page=abc', ra1)).status).toBe(400);
  });
});
