import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kysely } from 'kysely';
import request from 'supertest';
import { CLOCK } from '../../src/common/clock';
import { KYSELY } from '../../src/common/database/database.module';
import { Database } from '../../src/common/database/schema';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { SessionsService } from '../../src/modules/auth/sessions.service';
import { MAIL_TRANSPORT } from '../../src/modules/notification/mail-transport';
import { UsersModule } from '../../src/modules/users/users.module';
import { seedUser, startDatabase } from '../support/postgres';

jest.setTimeout(120_000);

describe('FE-mrr-045 POST /auth/logout (API-034 · UC-mrr-021)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let app: INestApplication;
  let sessions: SessionsService;
  let u1: string;
  const now = new Date('2026-10-22T10:00:00+07:00');

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    u1 = await seedUser(db, 'U1');
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule, UsersModule] })
      .overrideProvider(KYSELY).useValue(db)
      .overrideProvider(MAIL_TRANSPORT).useValue({ send: async () => undefined })
      .overrideProvider(CLOCK).useValue({ now: () => now })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    sessions = app.get(SessionsService);
  });

  afterAll(async () => {
    await app.close();
    await stop();
  });

  afterEach(() => jest.restoreAllMocks());

  const http = () => request(app.getHttpServer());
  const cookieOf = (token: string) => `mrr_session=${token}`;
  const logout = (cookie?: string) => {
    const r = http().post('/auth/logout');
    return cookie ? r.set('Cookie', cookie) : r;
  };
  const me = (cookie: string) => http().get('/auth/me').set('Cookie', cookie);
  const setCookies = (res: request.Response) => ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const sessionCount = async () => Number((await db.selectFrom('sessions').select(db.fn.countAll().as('n')).executeTakeFirstOrThrow()).n);

  describe('AC-mrr-111 · a signed-in user signs out', () => {
    it('ends the session: the same cookie no longer opens anything', async () => {
      const cookie = cookieOf(await sessions.open(u1));
      await me(cookie).expect(200);

      await logout(cookie).expect(200);

      await me(cookie).expect(401);
    });

    it('removes the session and tells the browser to forget the cookie', async () => {
      const token = await sessions.open(u1);
      const before = await sessionCount();

      const res = await logout(cookieOf(token)).expect(200);

      expect(await sessionCount()).toBe(before - 1);
      const cleared = setCookies(res).find((c) => c.startsWith('mrr_session='))!;
      expect(cleared).toMatch(/^mrr_session=;/);
      expect(cleared).toMatch(/Max-Age=0/i);
      expect(cleared).toMatch(/Path=\//);
      expect(cleared).toMatch(/HttpOnly/);
    });

    it('ends only this session — the same user on another device stays signed in (ACL-036)', async () => {
      const mine = cookieOf(await sessions.open(u1));
      const other = cookieOf(await sessions.open(u1));

      await logout(mine).expect(200);

      await me(other).expect(200);
    });
  });

  describe('AC-mrr-113 · someone who is not signed in gets the same answer', () => {
    it.each([
      ['no cookie at all', () => undefined],
      ['a cookie nobody issued', () => cookieOf('not-a-real-token')],
    ])('answers 200 with %s, and clears the cookie all the same', async (_what, cookie) => {
      const before = await sessionCount();

      const res = await logout(cookie()).expect(200);

      expect(res.body).toEqual({});
      expect(setCookies(res).some((c) => c.startsWith('mrr_session=;'))).toBe(true);
      expect(await sessionCount()).toBe(before);
    });

    it('answers the same for a session that has already been signed out', async () => {
      const cookie = cookieOf(await sessions.open(u1));
      await logout(cookie).expect(200);

      const again = await logout(cookie).expect(200);

      expect(again.body).toEqual({});
    });
  });

  describe('AC-mrr-112 · the session cannot be ended', () => {
    it('answers 500 and leaves the session and the cookie as they were', async () => {
      const cookie = cookieOf(await sessions.open(u1));
      jest.spyOn(sessions, 'close').mockRejectedValueOnce(new Error('the session store is down'));

      const res = await logout(cookie).expect(500);

      expect(setCookies(res).some((c) => c.startsWith('mrr_session='))).toBe(false);
      await me(cookie).expect(200);
    });
  });
});
