import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kysely, sql } from 'kysely';
import request from 'supertest';
import { KYSELY } from '../../src/common/database/database.module';
import { Database } from '../../src/common/database/schema';
import { RoomsModule } from '../../src/modules/rooms/rooms.module';
import { seedBooking, seedRoom, seedUser, startDatabase } from '../support/postgres';

jest.setTimeout(120_000);

const NOT_ADMIN = 'เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้';
const NOT_FOUND_ID = '00000000-0000-4000-8000-000000000000';

describe('FE-mrr-043 POST /rooms/:id/archive (API-025 · UC-mrr-015)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let app: INestApplication;
  let u1: string;
  let ra: string;
  let sysadmin: string;

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    u1 = await seedUser(db, 'U1');
    ra = await seedUser(db, 'RA', 'ROOM_ADMINISTRATOR');
    sysadmin = await seedUser(db, 'Sys', 'SYSTEM_ADMINISTRATOR');

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

  beforeEach(async () => {
    await sql`TRUNCATE booking_attendees, bookings, room_version_facilities, facilities, meeting_room_versions, meeting_rooms, room_maintenance_periods CASCADE`.execute(db);
  });

  const archive = (id: string, user: string | null = ra) => {
    const r = request(app.getHttpServer()).post(`/rooms/${id}/archive`);
    return user ? r.set('x-test-user', user) : r;
  };
  const statusOf = async (roomId: string) =>
    (await db.selectFrom('meeting_rooms').select('status').where('id', '=', roomId).executeTakeFirstOrThrow()).status;

  describe('AC-mrr-109 · a Room Administrator deletes a room', () => {
    it('answers ลบห้องแล้ว and the room becomes ARCHIVED', async () => {
      const a = await seedRoom(db, 'ห้อง A', ra);

      const res = await archive(a.roomId).expect(200);

      expect(res.body).toEqual({ message: 'ลบห้องแล้ว' });
      expect(await statusOf(a.roomId)).toBe('ARCHIVED');
    });

    it('is gone from search, from the room list and from the room read (STM-mrr-003)', async () => {
      const a = await seedRoom(db, 'ห้อง A', ra);
      await archive(a.roomId).expect(200);

      const found = await request(app.getHttpServer())
        .get('/rooms/available?date=2099-10-18&start=13:00&end=14:00').set('x-test-user', u1).expect(200);
      const listed = await request(app.getHttpServer()).get('/rooms').set('x-test-user', ra).expect(200);

      expect(found.body).toEqual([]);
      expect(listed.body.items).toEqual([]);
      await request(app.getHttpServer()).get(`/rooms/${a.roomId}`).set('x-test-user', u1).expect(404);
    });

    it('a room under maintenance can be deleted too', async () => {
      const m = await seedRoom(db, 'ห้อง M', ra, { status: 'UNDER_MAINTENANCE' });

      await archive(m.roomId).expect(200);

      expect(await statusOf(m.roomId)).toBe('ARCHIVED');
    });

    it('keeps the room\'s data and its bookings as they were (DQ-mrr-003)', async () => {
      const a = await seedRoom(db, 'ห้อง A', ra);
      const booking = await seedBooking(db, {
        room: a, bookedBy: u1, title: 'ประชุมทีม', startAt: new Date('2099-10-18T13:00:00+07:00'), endAt: new Date('2099-10-18T14:00:00+07:00'),
      });

      await archive(a.roomId).expect(200);

      const kept = await db.selectFrom('bookings').select(['status', 'title']).where('id', '=', booking).executeTakeFirstOrThrow();
      expect(kept).toEqual({ status: 'CONFIRMED', title: 'ประชุมทีม' });
      const version = await db.selectFrom('meeting_room_versions').select('name').where('id', '=', a.versionId).executeTakeFirst();
      expect(version?.name).toBe('ห้อง A');
    });

    it('cannot be undone: the room cannot be opened, edited or deleted again', async () => {
      const a = await seedRoom(db, 'ห้อง A', ra);
      await archive(a.roomId).expect(200);

      await request(app.getHttpServer()).post(`/rooms/${a.roomId}/maintenance`).set('x-test-user', ra).expect(404);
      await archive(a.roomId).expect(404);
      expect(await statusOf(a.roomId)).toBe('ARCHIVED');
    });
  });

  describe('AC-mrr-110 · anyone but a Room Administrator is refused (BR-mrr-005)', () => {
    it.each([['a general user', () => u1], ['a system administrator', () => sysadmin]])('refuses %s and leaves the room as it was', async (_who, user) => {
      const a = await seedRoom(db, 'ห้อง A', ra);

      const res = await archive(a.roomId, user()).expect(403);

      expect(res.body.message).toBe(NOT_ADMIN);
      expect(await statusOf(a.roomId)).toBe('ACTIVE');
    });
  });

  describe('a room that is not there', () => {
    it('answers 404 ไม่พบห้อง for an id nobody has', async () => {
      const res = await archive(NOT_FOUND_ID).expect(404);

      expect(res.body.message).toBe('ไม่พบห้อง');
    });

    it('answers 404 for something that is not an id', async () => {
      await request(app.getHttpServer()).post('/rooms/abc/archive').set('x-test-user', ra).expect(404);
    });

    it('answers 401 when nobody is signed in', async () => {
      const a = await seedRoom(db, 'ห้อง A', ra);

      await archive(a.roomId, null).expect(401);
      expect(await statusOf(a.roomId)).toBe('ACTIVE');
    });
  });
});
