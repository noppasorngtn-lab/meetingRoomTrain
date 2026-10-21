import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kysely } from 'kysely';
import request from 'supertest';
import { KYSELY } from '../../src/common/database/database.module';
import { Database } from '../../src/common/database/schema';
import { UsersModule } from '../../src/modules/users/users.module';
import { seedUser, startDatabase } from '../support/postgres';

jest.setTimeout(120_000);

describe('FE-mrr-038 GET /auth/me (API-035)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let app: INestApplication;
  let sa1: string;

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    sa1 = await seedUser(db, 'SA1', 'SYSTEM_ADMINISTRATOR');

    const moduleRef = await Test.createTestingModule({ imports: [UsersModule] })
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

  const me = (user?: string, path = '/auth/me') => {
    const r = request(app.getHttpServer()).get(path);
    return user ? r.set('x-test-user', user) : r;
  };

  it('SCN-mrr-095 answers a signed-in System Administrator with their own name and role', async () => {
    const res = await me(sa1).expect(200);

    expect(res.body).toEqual({ fullName: 'SA1', role: 'SYSTEM_ADMINISTRATOR' });
  });

  it('answers with the caller only, whoever the query string names', async () => {
    const u1 = await seedUser(db, 'U1');

    const res = await me(sa1, `/auth/me?userId=${u1}&id=${u1}`).expect(200);

    expect(res.body).toEqual({ fullName: 'SA1', role: 'SYSTEM_ADMINISTRATOR' });
  });

  it('SCN-mrr-096 answers 401 with no name or role when nobody is signed in', async () => {
    const res = await me().expect(401);

    expect(res.body.fullName).toBeUndefined();
    expect(res.body.role).toBeUndefined();
  });

  it('answers 401 for a session whose user has been deactivated', async () => {
    const gone = await seedUser(db, 'Gone', 'ROOM_ADMINISTRATOR');
    await db.updateTable('users').set({ active: false }).where('id', '=', gone).execute();

    await me(gone).expect(401);
  });
});
