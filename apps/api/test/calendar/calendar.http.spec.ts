import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kysely } from 'kysely';
import request from 'supertest';
import { KYSELY } from '../../src/common/database/database.module';
import { Database } from '../../src/common/database/schema';
import { CalendarModule } from '../../src/modules/calendar/calendar.module';
import { seedBooking, seedRoom, seedUser, startDatabase } from '../support/postgres';

jest.setTimeout(120_000);

describe('FE-mrr-023 GET /rooms/:id/calendar', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let app: INestApplication;
  let u1: string;
  let roomId: string;

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    u1 = await seedUser(db, 'U1');
    const room = await seedRoom(db, 'ห้อง A', u1);
    roomId = room.roomId;
    await seedBooking(db, {
      room, bookedBy: u1, title: 'ประชุมทีม',
      startAt: new Date('2026-10-17T10:00:00+07:00'), endAt: new Date('2026-10-17T11:00:00+07:00'),
    });

    const moduleRef = await Test.createTestingModule({ imports: [CalendarModule] })
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

  it('answers 200 with the slots for a signed-in caller', async () => {
    const res = await get(`/rooms/${roomId}/calendar?view=day&date=2026-10-17`, u1).expect(200);

    expect(res.body.slots).toHaveLength(1);
    expect(res.body.slots[0].details.title).toBe('ประชุมทีม');
  });

  it('answers 401 when nobody is signed in', async () => {
    await get(`/rooms/${roomId}/calendar?view=day&date=2026-10-17`).expect(401);
  });

  it.each([
    ['an unknown view', 'view=year&date=2026-10-17'],
    ['a missing date', 'view=day'],
    ['an impossible date', 'view=day&date=2026-02-30'],
  ])('answers 400 for %s', async (_what, query) => {
    await get(`/rooms/${roomId}/calendar?${query}`, u1).expect(400);
  });

  it('answers 404 with ไม่พบห้อง for a room that does not exist', async () => {
    const res = await get('/rooms/00000000-0000-0000-0000-000000000001/calendar?view=day&date=2026-10-17', u1).expect(404);

    expect(res.body.message).toBe('ไม่พบห้อง');
  });

  it('answers 404 for a room id that is not an id at all', async () => {
    await get('/rooms/not-a-room/calendar?view=day&date=2026-10-17', u1).expect(404);
  });
});
