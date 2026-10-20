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

describe('FE-mrr-032 /adjustment-requests — list, approve, reject', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let app: INestApplication;
  let u1: string;
  let ra1: string;
  let ra2: string;
  let booking: string;
  let adjustment: string;

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    const moduleRef = await Test.createTestingModule({ imports: [BookingModule] })
      .overrideProvider(KYSELY).useValue(db)
      .overrideProvider(CLOCK).useValue({ now: () => at(18, '13:00') })
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
    ra2 = await seedUser(db, 'RA2', 'ROOM_ADMINISTRATOR');
    const roomA = await seedRoom(db, 'ห้อง A', ra1);
    booking = await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:00') });
    ({ id: adjustment } = await db
      .insertInto('booking_adjustment_requests')
      .values({
        booking_id: booking, requested_by: ra1, proposed_changes: JSON.stringify({ title: 'ประชุมวางแผน' }), reason: 'ผู้จองพิมพ์หัวข้อผิด',
        created_at: at(18, '11:00'),
      })
      .returning('id')
      .executeTakeFirstOrThrow());
  });

  const post = (verb: 'approve' | 'reject', user: string, id = adjustment) =>
    request(app.getHttpServer()).post(`/adjustment-requests/${id}/${verb}`).set('x-test-user', user).send();
  const list = (query: string, user = ra2) => request(app.getHttpServer()).get(`/adjustment-requests${query}`).set('x-test-user', user);
  const title = async () => (await db.selectFrom('bookings').select('title').where('id', '=', booking).executeTakeFirstOrThrow()).title;
  const status = async () =>
    (await db.selectFrom('booking_adjustment_requests').select('status').where('id', '=', adjustment).executeTakeFirstOrThrow()).status;

  it('AC-mrr-043 200 อนุมัติคำขอแก้ไขสำเร็จ — the title becomes ประชุมวางแผน', async () => {
    const res = await post('approve', ra2);

    expect([res.status, res.body]).toEqual([200, { message: 'อนุมัติคำขอแก้ไขสำเร็จ' }]);
    expect(await title()).toBe('ประชุมวางแผน');
  });

  it('AC-mrr-044 403 in BR-mrr-014\'s words when RA1 approves their own — ประชุมทีม and PENDING stay', async () => {
    const res = await post('approve', ra1);

    expect([res.status, res.body.message]).toEqual([403, 'ผู้แก้ไขอนุมัติคำขอของตัวเองไม่ได้ ต้องให้ผู้ดูแลห้องคนอื่นอนุมัติ']);
    expect(await title()).toBe('ประชุมทีม');
    expect(await status()).toBe('PENDING');
  });

  it('200 ปฏิเสธคำขอแก้ไขสำเร็จ — the title stays ประชุมทีม', async () => {
    const res = await post('reject', ra2);

    expect([res.status, res.body]).toEqual([200, { message: 'ปฏิเสธคำขอแก้ไขสำเร็จ' }]);
    expect(await title()).toBe('ประชุมทีม');
    expect(await status()).toBe('REJECTED');
  });

  it('409 once decided', async () => {
    await post('reject', ra2);

    const res = await post('approve', ra2);

    expect([res.status, res.body.message]).toEqual([409, 'คำขอแก้ไขนี้ไม่ได้รออนุมัติแล้ว']);
  });

  it('403 for a General User, 404 for an unknown or malformed id', async () => {
    expect((await post('approve', u1)).status).toBe(403);
    expect((await post('approve', ra2, '00000000-0000-0000-0000-000000000000')).body).toMatchObject({ statusCode: 404, message: 'ไม่พบคำขอแก้ไข' });
    expect((await post('reject', ra2, 'nope')).status).toBe(404);
  });

  it('API-017 GET ?status=PENDING&page=1 — the page, with canDecide for the caller', async () => {
    const res = await list('?status=PENDING&page=1');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 1, items: [{ id: adjustment, canDecide: true, proposedChanges: { title: 'ประชุมวางแผน' } }] });
    expect((await list('?status=PENDING', ra1)).body.items[0].canDecide).toBe(false);
  });

  it('API-017 400 for another status or a page that is not a whole number from 1; 403 for a General User', async () => {
    expect((await list('?status=APPROVED')).status).toBe(400);
    expect((await list('?status=PENDING&page=0')).status).toBe(400);
    expect((await list('?status=PENDING', u1)).status).toBe(403);
  });
});
