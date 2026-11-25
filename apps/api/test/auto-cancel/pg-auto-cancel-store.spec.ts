import { Kysely } from 'kysely';
import { AutoCancelJob } from '../../src/modules/auto-cancel/auto-cancel-job';
import { PgAutoCancelStore } from '../../src/modules/auto-cancel/pg-auto-cancel-store';
import { BookingNotifier } from '../../src/modules/notification/booking-notifier';
import { MailMessage, MailTransport } from '../../src/modules/notification/mail-transport';
import { Database } from '../../src/common/database/schema';
import { maskUser, seedBooking, seedRoom, seedUser, startDatabase } from '../support/postgres';

jest.setTimeout(120_000);

class FakeMail implements MailTransport {
  sent: MailMessage[] = [];
  down = false;
  async send(m: MailMessage): Promise<void> {
    if (this.down) throw new Error('mail server is down');
    this.sent.push(m);
  }
}

/** UC-mrr-019 · BR-mrr-016 with the real store: a pending booking is cancelled at its start, the slot is released. */
describe('PgAutoCancelStore + AutoCancelJob', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let mail: FakeMail;
  let store: PgAutoCancelStore;
  let job: AutoCancelJob;
  let u1: string;
  let room: Awaited<ReturnType<typeof seedRoom>>;
  const T = (hhmm: string) => new Date(`2026-10-18T${hhmm}:00+07:00`);

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    const admin = await seedUser(db, 'Admin', 'ROOM_ADMINISTRATOR');
    u1 = await seedUser(db, 'U1');
    room = await seedRoom(db, 'Room B', admin, { requiresApproval: true });
  });
  afterAll(async () => stop());
  beforeEach(async () => {
    await db.deleteFrom('booking_attendees').execute();
    await db.deleteFrom('bookings').execute();
    mail = new FakeMail();
    store = new PgAutoCancelStore(db);
    job = new AutoCancelJob(store, new BookingNotifier(mail));
  });

  const seed = (status: Database['bookings']['status'] = 'PENDING_APPROVAL') =>
    seedBooking(db, { room, bookedBy: u1, title: 'ประชุมลูกค้า', startAt: T('10:00'), endAt: T('11:00'), status });
  const statusOf = async (id: string) => (await db.selectFrom('bookings').select('status').where('id', '=', id).executeTakeFirstOrThrow()).status;

  it('EX-mrr-050: at 09:59 the pending booking is untouched and nobody is mailed', async () => {
    const id = await seed();
    await job.run(T('09:59'));
    expect(await statusOf(id)).toBe('PENDING_APPROVAL');
    expect(mail.sent).toHaveLength(0);
  });

  it('EX-mrr-051: at 10:00 it is CANCELLED, the slot is released, and the booker gets the auto-cancel mail', async () => {
    const id = await seed();
    await job.run(T('10:00'));
    expect(await statusOf(id)).toBe('CANCELLED');
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].to).toEqual(['u1@example.test']);
    expect(mail.sent[0].subject).toBe('[จองห้องประชุม] ยกเลิกอัตโนมัติ: ประชุมลูกค้า · Room B 18/10 10:00–11:00');
  });

  it('F5 a booker masked under ADR-017: at 10:00 it is CANCELLED and nobody is mailed (nobody left to mail)', async () => {
    const booker = await seedUser(db, 'U9');
    await maskUser(db, booker);
    const id = await seedBooking(db, { room, bookedBy: booker, title: 'ประชุมลูกค้า', startAt: T('10:00'), endAt: T('11:00'), status: 'PENDING_APPROVAL' });

    await job.run(T('10:00'));

    expect(await statusOf(id)).toBe('CANCELLED');
    expect(mail.sent).toEqual([]);
  });

  it('EX-mrr-052: when the mail fails it stays pending, and the next pass tries again', async () => {
    const id = await seed();
    mail.down = true;
    await job.run(T('10:00'));
    expect(await statusOf(id)).toBe('PENDING_APPROVAL');
    mail.down = false;
    await job.run(T('10:01'));
    expect(await statusOf(id)).toBe('CANCELLED');
  });

  it('EX-mrr-053: a booking approved before the pass is left alone', async () => {
    const id = await seed('APPROVED');
    await job.run(T('10:05'));
    expect(await statusOf(id)).toBe('APPROVED');
    expect(mail.sent).toHaveLength(0);
  });

  it('cancelIfPending changes nothing once the booking is no longer pending', async () => {
    const id = await seed('APPROVED');
    expect(await store.cancelIfPending(id)).toBe(false);
    expect(await statusOf(id)).toBe('APPROVED');
    const pending = await seedBooking(db, { room, bookedBy: u1, title: 'อีกรายการ', startAt: T('12:00'), endAt: T('13:00'), status: 'PENDING_APPROVAL' });
    expect(await store.cancelIfPending(pending)).toBe(true);
  });
});
