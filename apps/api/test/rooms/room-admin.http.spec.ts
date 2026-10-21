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
const SAVED = 'บันทึกข้อมูลห้องสำเร็จ';
const REFUSAL = 'เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้';

describe('FE-mrr-034 /rooms · /facilities (API-020 · API-021 · API-023 · API-026 · API-027)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let app: INestApplication;
  let now: Date;
  let mailDown: boolean;
  let u1: string;
  let u2: string;
  let u3: string;
  let ra1: string;
  let roomA: { roomId: string; versionId: string };

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    // BookingModule too: AC-mrr-030 · 031 · 032 · 076 · 077 are proved by booking and by the pending queue.
    const moduleRef = await Test.createTestingModule({ imports: [RoomsModule, BookingModule] })
      .overrideProvider(KYSELY).useValue(db)
      .overrideProvider(CLOCK).useValue({ now: () => now })
      .overrideProvider(MAIL_TRANSPORT).useValue({
        send: async (_: MailMessage) => {
          if (mailDown) throw new Error('ECONNREFUSED');
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
    mailDown = false;
    u1 = await seedUser(db, 'U1');
    u2 = await seedUser(db, 'U2');
    u3 = await seedUser(db, 'U3');
    ra1 = await seedUser(db, 'RA1', 'ROOM_ADMINISTRATOR');
    roomA = await seedRoom(db, 'ห้อง A', ra1, { capacity: 10 });
    now = at(16, '10:00');
  });

  const http = () => request(app.getHttpServer());
  const version = (over: object = {}) => ({ name: 'ห้อง A', capacity: 10, photos: [], facilityIds: [], requiresApproval: false, approverId: null, ...over });
  const save = (user: string, body: object, id = roomA.roomId) => http().post(`/rooms/${id}/versions`).set('x-test-user', user).send(body);
  /** U2 books ห้อง A 18/10 <start>–<end>. */
  const book = (title: string, start: string, end: string, attendeeIds = [u3]) =>
    http().post('/bookings').set('x-test-user', u2).send({
      roomId: roomA.roomId, startAt: `2026-10-18T${start}:00+07:00`, endAt: `2026-10-18T${end}:00+07:00`, title, attendeeIds,
    });
  const pending = async () =>
    (await http().get('/bookings?status=PENDING_APPROVAL&page=1').set('x-test-user', ra1)).body.items.map((b: { id: string }) => b.id);

  it('AC-mrr-015 POST /rooms adds ห้อง C, capacity 10 — 201 บันทึกข้อมูลห้องสำเร็จ', async () => {
    const res = await http().post('/rooms').set('x-test-user', ra1).send({ code: 'C', ...version({ name: 'ห้อง C' }) });

    expect([res.status, res.body.message]).toEqual([201, SAVED]);
    expect((await http().get(`/rooms/${res.body.id}`).set('x-test-user', u1)).body).toMatchObject({ name: 'ห้อง C', capacity: 10, status: 'ACTIVE' });
  });

  it.each([
    ['AC-mrr-017 a General User', 'GENERAL_USER'],
    ['AC-mrr-018 a System Administrator', 'SYSTEM_ADMINISTRATOR'],
  ] as const)('%s gets 403 เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้ and ห้อง A stays at its capacity', async (_, role) => {
    const who = await seedUser(db, 'X', role);

    const res = await save(who, version({ capacity: 12 }));

    expect([res.status, res.body.message]).toEqual([403, REFUSAL]);
    expect((await http().get(`/rooms/${roomA.roomId}`).set('x-test-user', who)).body.capacity).toBe(10);
    expect((await http().get('/rooms').set('x-test-user', who)).status).toBe(403);
    expect((await http().post('/facilities').set('x-test-user', who).send({ name: 'ไมค์' })).status).toBe(403);
  });

  it('AC-mrr-030 · AC-mrr-031 ห้อง A made to need approval at 10:00 — U2\'s booking confirmed after it waits for approval', async () => {
    expect((await save(ra1, version({ requiresApproval: true }))).body).toEqual({ message: SAVED });
    now = at(16, '10:01');

    const res = await book('ประชุมย่อย', '15:00', '16:00');

    expect([res.status, res.body.status, res.body.message]).toEqual([201, 'PENDING_APPROVAL', 'ส่งคำขอจองแล้ว รอการอนุมัติ']);
  });

  it('AC-mrr-032 capacity cut to 4 — U2 still books 6 people, and U1\'s booking of 8 stays', async () => {
    const people = await Promise.all(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'].map((n) => seedUser(db, n)));
    const u1s = await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:00'), attendees: people });
    await save(ra1, version({ capacity: 4 }));
    now = at(16, '11:00');

    const res = await book('ประชุมใหญ่', '13:00', '14:00', people.slice(0, 6));

    expect([res.status, res.body.message]).toEqual([201, 'จองห้องสำเร็จ']);
    expect((await db.selectFrom('bookings').select('status').where('id', '=', u1s).executeTakeFirstOrThrow()).status).toBe('CONFIRMED');
  });

  it('AC-mrr-076 ห้อง A made to need approval: U1\'s booking 18/10 10:00–11:00 is now in the pending queue', async () => {
    const u1s = await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:00') });

    expect((await save(ra1, version({ requiresApproval: true }))).body.message).toBe(SAVED);

    expect(await pending()).toEqual([u1s]);
  });

  it('AC-mrr-077 ห้อง A no longer needs approval: U1\'s waiting booking leaves the pending queue', async () => {
    await db.updateTable('meeting_room_versions').set({ requires_approval: true }).where('id', '=', roomA.versionId).execute();
    await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:00'), status: 'PENDING_APPROVAL' });

    expect((await save(ra1, version({ requiresApproval: false }))).body.message).toBe(SAVED);

    expect(await pending()).toEqual([]);
  });

  it('503 when the จองสำเร็จ mail does not go — ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง, and the booking still waits', async () => {
    await db.updateTable('meeting_room_versions').set({ requires_approval: true }).where('id', '=', roomA.versionId).execute();
    const waiting = await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:00'), status: 'PENDING_APPROVAL' });
    mailDown = true;

    const res = await save(ra1, version({ requiresApproval: false }));

    expect([res.status, res.body.message]).toEqual([503, 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง']);
    expect(await pending()).toEqual([waiting]);
  });

  it('400 at the field: a capacity of 0, an empty name, a code another room has, a type that is not one', async () => {
    expect((await save(ra1, version({ capacity: 0 }))).body).toMatchObject({ statusCode: 400, field: 'capacity', message: 'ความจุต้องเป็นจำนวนเต็มตั้งแต่ 1' });
    expect((await save(ra1, version({ name: '' }))).body).toMatchObject({ statusCode: 400, field: 'name', message: 'กรุณาระบุชื่อห้อง' });
    expect((await http().post('/rooms').set('x-test-user', ra1).send({ code: 'ห้อง-A', ...version() })).body).toMatchObject({
      statusCode: 400, field: 'code', message: 'รหัสห้องนี้มีอยู่แล้ว',
    });
    expect((await save(ra1, version({ capacity: '10' }))).body).toMatchObject({ statusCode: 400, field: 'capacity' });
    expect((await save(ra1, version({ requiresApproval: 'yes' }))).body).toMatchObject({ statusCode: 400, field: 'requiresApproval' });
    expect((await save(ra1, version({ facilityIds: ['x'] }))).body).toMatchObject({ statusCode: 400, field: 'facilityIds' });
  });

  it('404 ไม่พบห้อง for an unknown, archived or malformed room', async () => {
    expect((await save(ra1, version(), '00000000-0000-0000-0000-000000000000')).body).toMatchObject({ statusCode: 404, message: 'ไม่พบห้อง' });
    expect((await save(ra1, version(), 'nope')).status).toBe(404);
    await db.updateTable('meeting_rooms').set({ status: 'ARCHIVED' }).where('id', '=', roomA.roomId).execute();
    expect((await save(ra1, version())).status).toBe(404);
  });

  it('API-020 GET /rooms?status=&query=&page= — the page, 400 for a status or page that is not one', async () => {
    const res = await http().get('/rooms?query=A').set('x-test-user', ra1);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 1, items: [{ id: roomA.roomId, name: 'ห้อง A', status: 'ACTIVE', versionNo: 1 }] });
    expect((await http().get('/rooms?status=GONE').set('x-test-user', ra1)).status).toBe(400);
    expect((await http().get('/rooms?page=0').set('x-test-user', ra1)).status).toBe(400);
    expect((await http().get('/rooms?status=ARCHIVED').set('x-test-user', ra1)).body.total).toBe(0);
  });

  it('API-026 · API-027 POST /facilities adds one, PATCH renames it or takes it out of use, 409-free 400 for a taken name, 404 for none', async () => {
    const added = await http().post('/facilities').set('x-test-user', ra1).send({ name: 'โปรเจคเตอร์' });
    expect([added.status, added.body.facility.name, added.body.facility.active]).toEqual([201, 'โปรเจคเตอร์', true]);
    const id = added.body.facility.id;

    const off = await http().patch(`/facilities/${id}`).set('x-test-user', ra1).send({ active: false });
    expect([off.status, off.body.facility.active]).toEqual([200, false]);
    expect((await http().get('/facilities?active=true').set('x-test-user', u1)).body).toEqual([]);

    await http().post('/facilities').set('x-test-user', ra1).send({ name: 'ไมค์' });
    expect((await http().patch(`/facilities/${id}`).set('x-test-user', ra1).send({ name: 'ไมค์' })).body).toMatchObject({
      statusCode: 400, field: 'name', message: 'มีสิ่งอำนวยความสะดวกชื่อนี้แล้ว',
    });
    expect((await http().patch(`/facilities/${id}`).set('x-test-user', ra1).send({ active: 'no' })).status).toBe(400);
    expect((await http().patch('/facilities/00000000-0000-0000-0000-000000000000').set('x-test-user', ra1).send({ active: true })).status).toBe(404);
  });
});
