import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kysely, sql } from 'kysely';
import request from 'supertest';
import { KYSELY } from '../../src/common/database/database.module';
import { Database } from '../../src/common/database/schema';
import { RoomsModule } from '../../src/modules/rooms/rooms.module';
import { seedBooking, seedRoom, seedUser, startDatabase } from '../support/postgres';

jest.setTimeout(120_000);

/** 18/10/2026 in Bangkok (+07:00) — the day the examples use. */
const at = (hhmm: string) => new Date(`2026-10-18T${hhmm}:00+07:00`);
const QUERY = '/rooms/available?date=2026-10-18&start=13:00&end=14:00';

describe('FE-mrr-041 GET /rooms/available (API-001 · UC-mrr-001)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let app: INestApplication;
  let u1: string;
  let admin: string;

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    u1 = await seedUser(db, 'U1');
    admin = await seedUser(db, 'Admin', 'ROOM_ADMINISTRATOR');

    const moduleRef = await Test.createTestingModule({ imports: [RoomsModule] })
      .overrideProvider(KYSELY).useValue(db)
      .compile();
    app = moduleRef.createNestApplication();
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

  // Every example starts from an empty room list, so one example never sees another's rooms.
  beforeEach(async () => {
    await sql`TRUNCATE booking_attendees, bookings, room_version_facilities, facilities, meeting_room_versions, meeting_rooms CASCADE`.execute(db);
  });

  const search = (qs: string, user: string | null = u1) => {
    const r = request(app.getHttpServer()).get(qs);
    return user ? r.set('x-test-user', user) : r;
  };

  describe('AC-mrr-106 · a free room with enough seats is listed, a small one is not', () => {
    it('lists room A (capacity 10) and leaves out room B (capacity 4) for 6 attendees', async () => {
      await seedRoom(db, 'ห้อง A', admin, { capacity: 10 });
      await seedRoom(db, 'ห้อง B', admin, { capacity: 4 });

      const res = await search(`${QUERY}&attendees=6`).expect(200);

      expect(res.body).toEqual([expect.objectContaining({ name: 'ห้อง A', capacity: 10 })]);
      expect(res.body).toHaveLength(1);
    });

    it('carries what the screen needs to go on to book: id, name, capacity', async () => {
      const a = await seedRoom(db, 'ห้อง A', admin, { capacity: 10, requiresApproval: true });

      const res = await search(`${QUERY}&attendees=6`).expect(200);

      expect(res.body).toEqual([{ id: a.roomId, name: 'ห้อง A', capacity: 10, requiresApproval: true }]);
    });

    it('lists every free room when attendees is left out', async () => {
      await seedRoom(db, 'ห้อง A', admin, { capacity: 10 });
      await seedRoom(db, 'ห้อง B', admin, { capacity: 4 });

      const res = await search(QUERY).expect(200);

      expect(res.body.map((r: { name: string }) => r.name)).toEqual(['ห้อง A', 'ห้อง B']);
    });

    it('a room with exactly as many seats as attendees is enough', async () => {
      await seedRoom(db, 'ห้อง B', admin, { capacity: 6 });

      const res = await search(`${QUERY}&attendees=6`).expect(200);

      expect(res.body).toHaveLength(1);
    });
  });

  describe('AC-mrr-107 · no room fits — an empty list, not an error', () => {
    it('answers 200 and [] when every room is booked over the slot or under maintenance', async () => {
      const a = await seedRoom(db, 'ห้อง A', admin);
      await seedRoom(db, 'ห้อง M', admin, { status: 'UNDER_MAINTENANCE' });
      await seedBooking(db, { room: a, bookedBy: u1, title: 'ประชุมทีม', startAt: at('13:00'), endAt: at('14:00') });

      const res = await search(QUERY).expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('AC-mrr-108 · a pending booking holds the slot, a closed room is not offered (BR-mrr-001 · BR-mrr-012)', () => {
    it('leaves out a room with a PENDING_APPROVAL booking over the slot', async () => {
      const b = await seedRoom(db, 'ห้อง B', admin, { requiresApproval: true });
      await seedRoom(db, 'ห้อง A', admin);
      await seedBooking(db, { room: b, bookedBy: u1, title: 'รออนุมัติ', startAt: at('13:00'), endAt: at('14:00'), status: 'PENDING_APPROVAL' });

      const res = await search(QUERY).expect(200);

      expect(res.body.map((r: { name: string }) => r.name)).toEqual(['ห้อง A']);
    });

    it('leaves out a room under maintenance and an archived one', async () => {
      await seedRoom(db, 'ห้อง C', admin, { status: 'UNDER_MAINTENANCE' });
      await seedRoom(db, 'ห้อง Z', admin, { status: 'ARCHIVED' });
      await seedRoom(db, 'ห้อง A', admin);

      const res = await search(QUERY).expect(200);

      expect(res.body.map((r: { name: string }) => r.name)).toEqual(['ห้อง A']);
    });

    it.each([['CONFIRMED'], ['APPROVED']] as const)('a %s booking over the slot holds it too', async (status) => {
      const a = await seedRoom(db, 'ห้อง A', admin);
      await seedBooking(db, { room: a, bookedBy: u1, title: 't', startAt: at('13:30'), endAt: at('14:30'), status });

      expect((await search(QUERY).expect(200)).body).toEqual([]);
    });

    it.each([['CANCELLED'], ['REJECTED']] as const)('a %s booking does not hold the slot', async (status) => {
      const a = await seedRoom(db, 'ห้อง A', admin);
      await seedBooking(db, { room: a, bookedBy: u1, title: 't', startAt: at('13:00'), endAt: at('14:00'), status });

      expect((await search(QUERY).expect(200)).body).toHaveLength(1);
    });

    it('[start, end) — a booking that ends at 13:00 or starts at 14:00 does not overlap 13:00–14:00', async () => {
      const a = await seedRoom(db, 'ห้อง A', admin);
      await seedBooking(db, { room: a, bookedBy: u1, title: 'ก่อน', startAt: at('12:00'), endAt: at('13:00') });
      await seedBooking(db, { room: a, bookedBy: u1, title: 'หลัง', startAt: at('14:00'), endAt: at('15:00') });

      expect((await search(QUERY).expect(200)).body).toHaveLength(1);
    });

    it('a booking that overlaps by one minute holds the slot', async () => {
      const a = await seedRoom(db, 'ห้อง A', admin);
      await seedBooking(db, { room: a, bookedBy: u1, title: 'ทับ', startAt: at('12:00'), endAt: at('13:01') });

      expect((await search(QUERY).expect(200)).body).toEqual([]);
    });

    it('a booking on another room does not hold this one', async () => {
      const a = await seedRoom(db, 'ห้อง A', admin);
      const other = await seedRoom(db, 'ห้อง B', admin);
      await seedBooking(db, { room: other, bookedBy: u1, title: 'อื่น', startAt: at('13:00'), endAt: at('14:00') });

      const res = await search(QUERY).expect(200);

      expect(res.body).toEqual([expect.objectContaining({ id: a.roomId })]);
    });
  });

  describe('facilities filter', () => {
    const facility = async (name: string) =>
      (await db.insertInto('facilities').values({ name }).returning('id').executeTakeFirstOrThrow()).id;
    const give = (versionId: string, ids: string[]) =>
      db.insertInto('room_version_facilities').values(ids.map((facility_id) => ({ room_version_id: versionId, facility_id }))).execute();

    it('keeps only rooms that have every facility asked for', async () => {
      const projector = await facility('โปรเจกเตอร์');
      const board = await facility('ไวต์บอร์ด');
      const a = await seedRoom(db, 'ห้อง A', admin);
      const b = await seedRoom(db, 'ห้อง B', admin);
      await give(a.versionId, [projector, board]);
      await give(b.versionId, [projector]);

      const both = await search(`${QUERY}&facilities=${projector},${board}`).expect(200);
      const one = await search(`${QUERY}&facilities=${projector}`).expect(200);

      expect(both.body.map((r: { name: string }) => r.name)).toEqual(['ห้อง A']);
      expect(one.body.map((r: { name: string }) => r.name)).toEqual(['ห้อง A', 'ห้อง B']);
    });

    it('reads the room\'s current version, not an older one', async () => {
      const projector = await facility('โปรเจกเตอร์');
      const a = await seedRoom(db, 'ห้อง A', admin);
      await give(a.versionId, [projector]);
      const v2 = await db
        .insertInto('meeting_room_versions')
        .values({ room_id: a.roomId, version_no: 2, name: 'ห้อง A', capacity: 10, requires_approval: false, approver_id: null, created_by: admin })
        .returning('id')
        .executeTakeFirstOrThrow();
      await db.updateTable('meeting_rooms').set({ current_version_id: v2.id }).where('id', '=', a.roomId).execute();

      expect((await search(`${QUERY}&facilities=${projector}`).expect(200)).body).toEqual([]);
    });
  });

  describe('the request is checked before anything is looked up', () => {
    it('answers 400 when the end is not after the start', async () => {
      const equal = await search('/rooms/available?date=2026-10-18&start=14:00&end=14:00').expect(400);
      const before = await search('/rooms/available?date=2026-10-18&start=14:00&end=13:00').expect(400);

      expect(equal.body.message).toBe('เวลาสิ้นสุดต้องหลังเวลาเริ่ม');
      expect(before.body.message).toBe('เวลาสิ้นสุดต้องหลังเวลาเริ่ม');
    });

    it.each([
      ['no date', '/rooms/available?start=13:00&end=14:00'],
      ['a date that is not a day', '/rooms/available?date=2026-02-30&start=13:00&end=14:00'],
      ['no start', '/rooms/available?date=2026-10-18&end=14:00'],
      ['a start that is not a time', '/rooms/available?date=2026-10-18&start=25:00&end=26:00'],
      ['an end that is not a time', '/rooms/available?date=2026-10-18&start=13:00&end=1400'],
      ['attendees of zero', `${QUERY}&attendees=0`],
      ['attendees that is not a whole number', `${QUERY}&attendees=2.5`],
      ['a facility that is not an id', `${QUERY}&facilities=abc`],
    ])('answers 400 for %s', async (_what, qs) => {
      await search(qs).expect(400);
    });

    it('answers 401 when nobody is signed in', async () => {
      await search(QUERY, null).expect(401);
    });
  });

  it('is not shadowed by GET /rooms/:id — "available" is a search, not a room id', async () => {
    const res = await search(`${QUERY}`).expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });
});
