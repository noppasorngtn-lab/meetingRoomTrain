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

describe('FE-mrr-031 POST /bookings/:id/admin-edit after the meeting ends', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let app: INestApplication;
  let u1: string;
  let ra1: string;
  let booking: string;

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    const moduleRef = await Test.createTestingModule({ imports: [BookingModule] })
      .overrideProvider(KYSELY).useValue(db)
      .overrideProvider(CLOCK).useValue({ now: () => at(18, '11:00') })
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
    ra1 = await seedUser(db, 'RA1', 'ROOM_ADMINISTRATOR');
    const roomA = await seedRoom(db, 'ห้อง A', ra1);
    booking = await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:00') });
  });

  const post = (body: object, user = ra1) => request(app.getHttpServer()).post(`/bookings/${booking}/admin-edit`).set('x-test-user', user).send(body);
  const requests = () => db.selectFrom('booking_adjustment_requests').select(['proposed_changes', 'status']).execute();

  it('AC-mrr-041 200 ส่งคำขอแก้ไขแล้ว รอผู้ดูแลห้องคนอื่นอนุมัติ — the title stays ประชุมทีม', async () => {
    const res = await post({ title: 'ประชุมวางแผน', reason: 'ผู้จองพิมพ์หัวข้อผิด' });

    expect([res.status, res.body]).toEqual([200, { message: 'ส่งคำขอแก้ไขแล้ว รอผู้ดูแลห้องคนอื่นอนุมัติ' }]);
    const row = await db.selectFrom('bookings').select('title').where('id', '=', booking).executeTakeFirstOrThrow();
    expect(row.title).toBe('ประชุมทีม');
    expect(await requests()).toEqual([{ proposed_changes: { title: 'ประชุมวางแผน' }, status: 'PENDING' }]);
  });

  it('400 on the changes field when nothing differs', async () => {
    const res = await post({ title: 'ประชุมทีม', reason: 'x' });

    expect([res.status, res.body.field, res.body.message]).toEqual([400, 'changes', 'ไม่มีค่าที่ขอแก้ไข']);
    expect(await requests()).toEqual([]);
  });

  it('400 กรุณาระบุเหตุผล on the reason field — no request', async () => {
    const res = await post({ title: 'ประชุมวางแผน', reason: '' });

    expect([res.status, res.body.field]).toEqual([400, 'reason']);
    expect(await requests()).toEqual([]);
  });

  it('403 for a General User', async () => {
    expect((await post({ title: 'ประชุมวางแผน', reason: 'x' }, u1)).status).toBe(403);
  });
});
