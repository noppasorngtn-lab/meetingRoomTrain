import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kysely } from 'kysely';
import request from 'supertest';
import { KYSELY } from '../../src/common/database/database.module';
import { Database } from '../../src/common/database/schema';
import { RoomsModule } from '../../src/modules/rooms/rooms.module';
import { seedRoom, seedUser, startDatabase } from '../support/postgres';

jest.setTimeout(120_000);

describe('FE-mrr-037 GET /rooms/:id · GET /facilities', () => {
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

  const get = (path: string, user?: string) => {
    const r = request(app.getHttpServer()).get(path);
    return user ? r.set('x-test-user', user) : r;
  };

  describe('GET /rooms/:id (API-022)', () => {
    it('answers a general user with the room\'s name, capacity and approval setting', async () => {
      const room = await seedRoom(db, 'ห้อง B', admin, { requiresApproval: true, capacity: 8 });

      const res = await get(`/rooms/${room.roomId}`, u1).expect(200);

      expect(res.body).toEqual({ id: room.roomId, name: 'ห้อง B', capacity: 8, requiresApproval: true, status: 'ACTIVE' });
    });

    it('AC-mrr-032 reads the current version — the capacity after the edit', async () => {
      const room = await seedRoom(db, 'ห้อง A', admin, { capacity: 10 });
      const { id } = await db
        .insertInto('meeting_room_versions')
        .values({ room_id: room.roomId, version_no: 2, name: 'ห้อง A', capacity: 4, requires_approval: false, approver_id: null, created_by: admin })
        .returning('id')
        .executeTakeFirstOrThrow();
      await db.updateTable('meeting_rooms').set({ current_version_id: id }).where('id', '=', room.roomId).execute();

      const res = await get(`/rooms/${room.roomId}`, u1).expect(200);

      expect(res.body.capacity).toBe(4);
    });

    it('shows a room under maintenance with its status, so the form can say why', async () => {
      const room = await seedRoom(db, 'ห้อง X', admin, { status: 'UNDER_MAINTENANCE' });

      const res = await get(`/rooms/${room.roomId}`, u1).expect(200);

      expect(res.body.status).toBe('UNDER_MAINTENANCE');
    });

    it.each([
      ['an archived room', async () => (await seedRoom(db, 'ห้อง Z', admin, { status: 'ARCHIVED' })).roomId],
      ['a room that does not exist', async () => '00000000-0000-4000-8000-000000000000'],
      ['an id that is not one', async () => 'not-a-room'],
    ])('answers 404 for %s', async (_what, id) => {
      const res = await get(`/rooms/${await id()}`, u1).expect(404);

      expect(res.body.message).toBe('ไม่พบห้อง');
    });

    it('answers 401 when nobody is signed in', async () => {
      const room = await seedRoom(db, 'ห้อง C', admin);

      await get(`/rooms/${room.roomId}`).expect(401);
    });

    it('answers a Room Administrator with the whole current version — the one an edit starts from, a facility since taken out of use included', async () => {
      const room = await seedRoom(db, 'ห้อง D', admin, { requiresApproval: true, capacity: 6 });
      const [projector] = await db.insertInto('facilities').values([{ name: 'จอ D', active: false }]).returning('id').execute();
      const { id } = await db
        .insertInto('meeting_room_versions')
        .values({
          room_id: room.roomId, version_no: 2, name: 'ห้อง D', capacity: 6, photos: JSON.stringify(['photo-1']),
          requires_approval: true, approver_id: admin, created_by: admin,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await db.insertInto('room_version_facilities').values({ room_version_id: id, facility_id: projector.id }).execute();
      await db.updateTable('meeting_rooms').set({ current_version_id: id }).where('id', '=', room.roomId).execute();

      const res = await get(`/rooms/${room.roomId}`, admin).expect(200);

      expect(res.body).toEqual({
        id: room.roomId, code: 'ห้อง-D', name: 'ห้อง D', capacity: 6, status: 'ACTIVE', requiresApproval: true,
        approver: { id: admin, fullName: 'Admin' }, versionNo: 2, photos: ['photo-1'], facilityIds: [projector.id],
      });
    });

    it('answers a Room Administrator 404 for an archived room', async () => {
      const room = await seedRoom(db, 'ห้อง Y', admin, { status: 'ARCHIVED' });

      const res = await get(`/rooms/${room.roomId}`, admin).expect(404);

      expect(res.body.message).toBe('ไม่พบห้อง');
    });
  });

  describe('GET /facilities?active=true (API-002)', () => {
    beforeAll(async () => {
      await db.insertInto('facilities').values([{ name: 'โปรเจคเตอร์' }, { name: 'ไมโครโฟน' }, { name: 'กระดานเก่า', active: false }]).execute();
    });

    it('AC-mrr-005 lists the active facilities to choose from — choosing none is allowed', async () => {
      const res = await get('/facilities?active=true', u1).expect(200);

      expect(res.body.map((f: { name: string }) => f.name)).toEqual(['โปรเจคเตอร์', 'ไมโครโฟน']);
      expect(res.body[0]).toEqual({ id: expect.any(String), name: 'โปรเจคเตอร์' });
    });

    it.each([['no active', ''], ['active=false', '?active=false']])('answers 400 for %s', async (_what, query) => {
      await get(`/facilities${query}`, u1).expect(400);
    });

    it('answers 401 when nobody is signed in', async () => {
      await get('/facilities?active=true').expect(401);
    });
  });
});
