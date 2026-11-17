import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kysely } from 'kysely';
import request from 'supertest';
import { Database } from '../../src/common/database/schema';
import { KYSELY } from '../../src/common/database/database.module';
import { TestControlsModule } from '../../src/modules/test-controls/test-controls.module';
import { AutoCancelModule } from '../../src/modules/auto-cancel/auto-cancel.module';
import { PgAutoCancelStore } from '../../src/modules/auto-cancel/pg-auto-cancel-store';
import { MAIL_TRANSPORT, MailMessage } from '../../src/modules/notification/mail-transport';
import { PgReminderStore } from '../../src/modules/reminder/pg-reminder-store';
import { ReminderModule } from '../../src/modules/reminder/reminder.module';
import { seedBooking, seedRoom, seedUser, startDatabase } from '../support/postgres';

jest.setTimeout(120_000);

/** app.close() destroys the database provider; the apps here share one database, so closing must not. */
const keepOpen = (db: Kysely<Database>): Kysely<Database> =>
  new Proxy(db, {
    get: (target, prop) => {
      if (prop === 'destroy') return async () => undefined;
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

/** Dev-only clock handle for the E2E suite (OQ-T1-01): off by default, 404 when off, moves the app clock when on. */
describe('test controls — the movable clock', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
  });
  afterAll(async () => {
    delete process.env.ENABLE_TEST_CONTROLS;
    await stop();
  });

  const appWith = async (flag: string | undefined): Promise<INestApplication> => {
    if (flag === undefined) delete process.env.ENABLE_TEST_CONTROLS;
    else process.env.ENABLE_TEST_CONTROLS = flag;
    // ifEnabled() reads the flag when called — AppModule calls it once, at start-up, so a flag change needs a restart.
    const ref = await Test.createTestingModule({ imports: [...TestControlsModule.ifEnabled()] })
      .overrideProvider(KYSELY).useValue(keepOpen(db))
      .compile();
    const app = ref.createNestApplication();
    await app.init();
    return app;
  };

  it('has no /__test routes unless ENABLE_TEST_CONTROLS=true', async () => {
    for (const flag of [undefined, 'false', '1']) {
      const app = await appWith(flag);
      expect((await request(app.getHttpServer()).get('/__test/clock')).status).toBe(404);
      expect((await request(app.getHttpServer()).post('/__test/clock').send({ now: '2030-01-01T00:00:00Z' })).status).toBe(404);
      await app.close();
    }
  });

  it('moves the app clock to the given instant, lets it tick on, and puts it back with null', async () => {
    const app = await appWith('true');
    const http = () => request(app.getHttpServer());
    const target = '2031-03-05T10:00:00+07:00';

    const set = await http().post('/__test/clock').send({ now: target });
    expect(set.status).toBe(200);
    expect(Math.abs(Date.parse(set.body.now) - Date.parse(target))).toBeLessThan(2000);
    expect(Math.abs(Date.parse((await http().get('/__test/clock')).body.now) - Date.parse(target))).toBeLessThan(2000);

    const back = await http().post('/__test/clock').send({ now: null });
    expect(back.body.offsetMs).toBe(0);
    expect(Math.abs(Date.parse(back.body.now) - Date.now())).toBeLessThan(2000);
    await app.close();
  });

  it('refuses a value that is not a time', async () => {
    const app = await appWith('true');
    expect((await request(app.getHttpServer()).post('/__test/clock').send({ now: 'tomorrow-ish' })).status).toBe(400);
    expect((await request(app.getHttpServer()).post('/__test/clock').send({})).status).toBe(400);
    await app.close();
  });

  it('re-stamps sessions to the new now, so a jump forward does not sign anyone out', async () => {
    const app = await appWith('true');
    const [user] = await db.insertInto('users').values({ email: 'clock@example.test', full_name: 'Clock', role: 'GENERAL_USER' }).returning('id').execute();
    await db.insertInto('sessions').values({ token_hash: 'h-clock', user_id: user.id, created_at: new Date(), last_seen_at: new Date() }).execute();
    const target = '2031-03-05T10:00:00+07:00';
    await request(app.getHttpServer()).post('/__test/clock').send({ now: target });
    const row = await db.selectFrom('sessions').select('last_seen_at').where('token_hash', '=', 'h-clock').executeTakeFirstOrThrow();
    expect(Math.abs(row.last_seen_at.getTime() - Date.parse(target))).toBeLessThan(3000);
    await request(app.getHttpServer()).post('/__test/clock').send({ now: null });
    await app.close();
  });
});

/** OQ-T1-02: the jobs run on demand, over the bookings the caller names and no others. */
describe('test controls — run the scheduled jobs now', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  const sent: MailMessage[] = [];

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
  });
  afterAll(async () => {
    delete process.env.ENABLE_TEST_CONTROLS;
    await stop();
  });

  it('refuses to run without a scope, and cancels / reminds only the matching bookings', async () => {
    process.env.ENABLE_TEST_CONTROLS = 'true';
    const ref = await Test.createTestingModule({
      imports: [ReminderModule.withStore(PgReminderStore), AutoCancelModule.withStore(PgAutoCancelStore), ...TestControlsModule.ifEnabled()],
    })
      .overrideProvider(KYSELY).useValue(keepOpen(db))
      .overrideProvider(MAIL_TRANSPORT).useValue({ send: async (m: MailMessage) => void sent.push(m) })
      .compile();
    const app = ref.createNestApplication();
    await app.init();
    const http = () => request(app.getHttpServer());

    const admin = await seedUser(db, 'Admin', 'ROOM_ADMINISTRATOR');
    const booker = await seedUser(db, 'Booker');
    const room = await seedRoom(db, 'Jobs Room', admin, { requiresApproval: true });
    const start = new Date(Date.now() + 5 * 60_000);
    const slot = (n: number) => ({ startAt: new Date(start.getTime() + n * 3_600_000), endAt: new Date(start.getTime() + (n + 1) * 3_600_000) });
    const mine = await seedBooking(db, { room, bookedBy: booker, title: 'E2E-scope-mine', status: 'PENDING_APPROVAL', ...slot(0) });
    const other = await seedBooking(db, { room, bookedBy: booker, title: 'someone else', status: 'PENDING_APPROVAL', ...slot(2) });
    const reminderMine = await seedBooking(db, { room, bookedBy: booker, title: 'E2E-scope-remind', status: 'CONFIRMED', ...slot(4) });

    expect((await http().post('/__test/jobs/run').send({})).status).toBe(400);
    expect((await http().post('/__test/jobs/run').send({ titleContains: 'ab' })).status).toBe(400);

    // Put the clock at the start of the first booking (the second and third start later).
    await http().post('/__test/clock').send({ now: start.toISOString() });
    const ran = await http().post('/__test/jobs/run').send({ titleContains: 'E2E-scope' });
    await http().post('/__test/clock').send({ now: null });
    expect(ran.status).toBe(200);

    const statusOf = async (id: string) => (await db.selectFrom('bookings').select('status').where('id', '=', id).executeTakeFirstOrThrow()).status;
    expect(await statusOf(mine)).toBe('CANCELLED');
    expect(await statusOf(other)).toBe('PENDING_APPROVAL');
    expect(await statusOf(reminderMine)).toBe('CONFIRMED');
    expect(sent.map((m) => m.subject).some((x) => x.includes('ยกเลิกอัตโนมัติ: E2E-scope-mine'))).toBe(true);
    expect(sent.some((m) => m.subject.includes('someone else'))).toBe(false);
    await app.close();
  });
});
