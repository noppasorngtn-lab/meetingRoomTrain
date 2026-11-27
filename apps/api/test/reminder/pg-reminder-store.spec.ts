import { Kysely } from 'kysely';
import { BookingService } from '../../src/modules/booking/booking.service';
import { BookingNotifier } from '../../src/modules/notification/booking-notifier';
import { MailMessage, MailTransport } from '../../src/modules/notification/mail-transport';
import { PgReminderStore } from '../../src/modules/reminder/pg-reminder-store';
import { ReminderJob } from '../../src/modules/reminder/reminder-job';
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

/** UC-mrr-018 · BR-mrr-008 · BR-mrr-020 · BR-mrr-023 with the real store: the job reads and writes the bookings table. */
describe('PgReminderStore + ReminderJob', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let mail: FakeMail;
  let job: ReminderJob;
  let u1: string, u2: string, u3: string;
  let roomOpen: Awaited<ReturnType<typeof seedRoom>>;
  const T = (hhmm: string) => new Date(`2026-10-17T${hhmm}:00+07:00`);

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    const admin = await seedUser(db, 'Admin', 'ROOM_ADMINISTRATOR');
    u1 = await seedUser(db, 'U1');
    u2 = await seedUser(db, 'U2');
    u3 = await seedUser(db, 'U3');
    roomOpen = await seedRoom(db, 'Room A', admin);
  });
  afterAll(async () => stop());
  beforeEach(async () => {
    await db.deleteFrom('booking_attendees').execute();
    await db.deleteFrom('bookings').execute();
    mail = new FakeMail();
    job = new ReminderJob(new PgReminderStore(db), new BookingNotifier(mail));
  });

  const seed = (title: string, start = '10:00', status: Database['bookings']['status'] = 'CONFIRMED') =>
    seedBooking(db, { room: roomOpen, bookedBy: u1, title, startAt: T(start), endAt: T('11:00'), status, attendees: [u2, u3] });
  const reminded = () => mail.sent.filter((m) => m.subject.includes('ใกล้ถึงเวลาประชุม'));
  const rowOf = (id: string) => db.selectFrom('bookings').select(['reminder_status', 'reminder_at']).where('id', '=', id).executeTakeFirstOrThrow();

  it('AC EX-mrr-020/075: at 09:45 the booker and every attendee get one reminder, and the booking is marked SENT', async () => {
    const id = await seed('ประชุมทีม');
    await job.run(T('09:45'));
    expect(reminded()).toHaveLength(1);
    expect(reminded()[0].to.sort()).toEqual(['u1@example.test', 'u2@example.test', 'u3@example.test']);
    expect(reminded()[0].subject).toBe('[จองห้องประชุม] ใกล้ถึงเวลาประชุม: ประชุมทีม · Room A 17/10 10:00–11:00');
    const row = await rowOf(id);
    expect(row.reminder_status).toBe('SENT');
    expect(row.reminder_at?.getTime()).toBe(T('09:45').getTime());
  });

  it('DEF-06 the reminder leaves out an attendee masked under ADR-017, and the booking is still marked SENT (Q-ADR017-3)', async () => {
    const u4 = await seedUser(db, 'U4');
    await maskUser(db, u4);
    const id = await seedBooking(db, { room: roomOpen, bookedBy: u1, title: 'ประชุมทีม', startAt: T('10:00'), endAt: T('11:00'), attendees: [u2, u4] });

    await job.run(T('09:45'));

    expect(reminded().map((m) => m.to.sort())).toEqual([['u1@example.test', 'u2@example.test']]);
    expect((await rowOf(id)).reminder_status).toBe('SENT');
  });

  it('F5 the reminder leaves out a booker masked under ADR-017, and the booking is still marked SENT', async () => {
    const booker = await seedUser(db, 'U5');
    await maskUser(db, booker);
    const id = await seedBooking(db, { room: roomOpen, bookedBy: booker, title: 'ประชุมทีม', startAt: T('10:00'), endAt: T('11:00'), attendees: [u2] });

    await job.run(T('09:45'));

    expect(reminded().map((m) => m.to)).toEqual([['u2@example.test']]);
    expect((await rowOf(id)).reminder_status).toBe('SENT');
  });

  it('F5 a booker masked under ADR-017 and no attendee: nobody is mailed, and the booking is still marked SENT', async () => {
    const booker = await seedUser(db, 'U6');
    await maskUser(db, booker);
    const id = await seedBooking(db, { room: roomOpen, bookedBy: booker, title: 'ประชุมทีม', startAt: T('10:00'), endAt: T('11:00') });

    await job.run(T('09:45'));

    expect(reminded()).toEqual([]);
    expect((await rowOf(id)).reminder_status).toBe('SENT');
  });

  it('TC-NTF-JOB-118 EX-mrr-147 AC-mrr-150 BR-mrr-008 booked at 09:45 for 10:00: no reminder at once, the 09:45 pass sends it, once', async () => {
    // The real create path and the job share one mailbox, so a reminder from either of them is counted.
    const service = new BookingService(db, { now: () => T('09:45') }, new BookingNotifier(mail));
    const { id } = await service.create({ userId: u1 }, {
      roomId: roomOpen.roomId, startAt: T('10:00'), endAt: T('11:00'), title: 'ประชุมด่วน', attendeeIds: [u2], equipmentIds: [],
    });
    expect(reminded()).toHaveLength(0);
    expect(mail.sent.map((m) => [m.subject, m.to])).toEqual([
      ['[จองห้องประชุม] จองสำเร็จ: ประชุมด่วน · Room A 17/10 10:00–11:00', ['u1@example.test']],
    ]);
    expect((await rowOf(id)).reminder_status).toBe('NOT_SENT');

    await job.run(T('09:45'));
    expect(reminded()).toHaveLength(1);
    expect(reminded()[0].to.sort()).toEqual(['u1@example.test', 'u2@example.test']);
    expect(reminded()[0].subject).toBe('[จองห้องประชุม] ใกล้ถึงเวลาประชุม: ประชุมด่วน · Room A 17/10 10:00–11:00');
    const row = await rowOf(id);
    expect(row.reminder_status).toBe('SENT');
    expect(row.reminder_at?.getTime()).toBe(T('09:45').getTime());

    await job.run(T('09:50'));
    expect(reminded()).toHaveLength(1);
  });

  it('EX-mrr-023: at 09:44 (16 minutes before) nobody is reminded and the row is untouched', async () => {
    const id = await seed('ประชุมทีม');
    await job.run(T('09:44'));
    expect(reminded()).toHaveLength(0);
    expect((await rowOf(id)).reminder_status).toBe('NOT_SENT');
  });

  it('EX-mrr-076: a later pass does not send it again', async () => {
    await seed('ประชุมทีม');
    await job.run(T('09:45'));
    await job.run(T('09:50'));
    expect(reminded()).toHaveLength(1);
  });

  it('EX-mrr-025: a booking still waiting for approval is not reminded', async () => {
    const id = await seed('ประชุมลูกค้า', '10:00', 'PENDING_APPROVAL');
    await job.run(T('09:45'));
    expect(reminded()).toHaveLength(0);
    expect((await rowOf(id)).reminder_status).toBe('NOT_SENT');
  });

  it('EX-mrr-066/067: a failed send is recorded FAILED and never retried', async () => {
    const id = await seed('ประชุมทีม');
    mail.down = true;
    await job.run(T('09:45'));
    expect((await rowOf(id)).reminder_status).toBe('FAILED');
    mail.down = false;
    await job.run(T('09:50'));
    expect(reminded()).toHaveLength(0);
    expect((await rowOf(id)).reminder_status).toBe('FAILED');
  });

  it('a booking that has already started is not listed', async () => {
    await seed('เริ่มไปแล้ว', '09:00');
    await job.run(T('09:45'));
    expect(reminded()).toHaveLength(0);
  });
});
