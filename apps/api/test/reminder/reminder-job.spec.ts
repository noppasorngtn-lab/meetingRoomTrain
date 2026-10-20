import { BookingNotifier } from '../../src/modules/notification/booking-notifier';
import { MailMessage, MailTransport } from '../../src/modules/notification/mail-transport';
import { ReminderJob } from '../../src/modules/reminder/reminder-job';
import { ReminderCandidate, ReminderStore } from '../../src/modules/reminder/reminder-store';

class SwitchableTransport implements MailTransport {
  sent: MailMessage[] = [];
  down = false;
  async send(message: MailMessage): Promise<void> {
    if (this.down) throw new Error('ECONNREFUSED');
    this.sent.push(message);
  }
  subjectsFor(email: string): string[] {
    return this.sent.filter((m) => m.to.includes(email)).map((m) => m.subject);
  }
}

class InMemoryStore implements ReminderStore {
  constructor(public bookings: ReminderCandidate[]) {}
  async listUpcoming(now: Date, until: Date): Promise<ReminderCandidate[]> {
    return this.bookings.filter((b) => b.startAt > now && b.startAt <= until).map((b) => ({ ...b }));
  }
  async recordReminder(id: string, status: 'SENT' | 'FAILED', at: Date): Promise<void> {
    const b = this.bookings.find((x) => x.id === id)!;
    b.reminderStatus = status;
    b.reminderAt = at;
  }
  get(id: string): ReminderCandidate {
    return this.bookings.find((x) => x.id === id)!;
  }
}

const U1 = 'u1@example.test';
const U2 = 'u2@example.test';
const U3 = 'u3@example.test';
const at = (hhmm: string) => new Date(`2026-10-17T${hhmm}:00+07:00`);

const booking = (over: Partial<ReminderCandidate> = {}): ReminderCandidate => ({
  id: 'b1',
  title: 'ประชุมทีม',
  roomName: 'ห้อง A',
  startAt: at('10:00'),
  endAt: at('11:00'),
  bookerEmail: U1,
  attendeeEmails: [U2, U3],
  status: 'CONFIRMED',
  reminderStatus: 'NOT_SENT',
  reminderAt: null,
  ...over,
});

const REMINDER = '[จองห้องประชุม] ใกล้ถึงเวลาประชุม: ประชุมทีม · ห้อง A 17/10 10:00–11:00';

describe('FE-mrr-018 ReminderJob', () => {
  let transport: SwitchableTransport;
  let store: InMemoryStore;
  let job: ReminderJob;

  const setup = (...bookings: ReminderCandidate[]) => {
    transport = new SwitchableTransport();
    store = new InMemoryStore(bookings);
    job = new ReminderJob(store, new BookingNotifier(transport));
  };

  it('AC-mrr-020 AC-mrr-073 at 09:45 the booker and every attendee get one reminder, recorded as sent', async () => {
    setup(booking());

    await job.run(at('09:45'));

    expect(transport.subjectsFor(U1)).toEqual([REMINDER]);
    expect(transport.subjectsFor(U2)).toEqual([REMINDER]);
    expect(transport.subjectsFor(U3)).toEqual([REMINDER]);
    expect(store.get('b1')).toMatchObject({ reminderStatus: 'SENT', reminderAt: at('09:45') });
  });

  it('AC-mrr-023 at 09:44 nobody is reminded yet', async () => {
    setup(booking());

    await job.run(at('09:44'));

    expect(transport.sent).toEqual([]);
    expect(store.get('b1').reminderStatus).toBe('NOT_SENT');
  });

  it('AC-mrr-025 a booking still waiting for approval is not reminded', async () => {
    setup(booking({ title: 'ประชุมลูกค้า', roomName: 'ห้อง B', attendeeEmails: [U2], status: 'PENDING_APPROVAL' }));

    await job.run(at('09:45'));

    expect(transport.sent).toEqual([]);
    expect(store.get('b1').reminderStatus).toBe('NOT_SENT');
  });

  it('AC-mrr-074 a second run at 09:50 sends nothing more — still one each', async () => {
    setup(booking());

    await job.run(at('09:45'));
    await job.run(at('09:50'));

    expect(transport.subjectsFor(U1)).toEqual([REMINDER]);
    expect(transport.subjectsFor(U2)).toEqual([REMINDER]);
    expect(transport.subjectsFor(U3)).toEqual([REMINDER]);
  });

  it('AC-mrr-075 the reminder sent at booking time counts as the only one', async () => {
    // Booked at 09:50 for 10:00 — BookingNotifier.bookingCreated sent it then, and the caller recorded SENT.
    setup(booking({ title: 'ประชุมด่วน', attendeeEmails: [U2], reminderStatus: 'SENT', reminderAt: at('09:50') }));

    await job.run(at('09:55'));

    expect(transport.sent).toEqual([]);
  });

  it('AC-mrr-064 with the mail server down the reminder is recorded as failed and the booking stands', async () => {
    setup(booking());
    transport.down = true;

    await expect(job.run(at('09:45'))).resolves.toBeUndefined();

    expect(transport.sent).toEqual([]);
    expect(store.get('b1')).toMatchObject({ reminderStatus: 'FAILED', reminderAt: at('09:45'), status: 'CONFIRMED' });
  });

  it('AC-mrr-065 once failed, the next run does not retry even with the mail server back', async () => {
    setup(booking());
    transport.down = true;
    await job.run(at('09:45'));

    transport.down = false;
    await job.run(at('09:50'));

    expect(transport.sent).toEqual([]);
    expect(store.get('b1').reminderStatus).toBe('FAILED');
  });

  it('one failed reminder does not stop the others in the same run', async () => {
    let calls = 0;
    const flaky: MailTransport = {
      send: async (m) => {
        if (calls++ === 0) throw new Error('ECONNRESET');
        transport.sent.push(m);
      },
    };
    setup(booking({ id: 'b1' }), booking({ id: 'b2', title: 'ประชุมย่อย', startAt: at('10:00'), endAt: at('10:30') }));
    job = new ReminderJob(store, new BookingNotifier(flaky));

    await job.run(at('09:45'));

    expect(store.get('b1').reminderStatus).toBe('FAILED');
    expect(store.get('b2').reminderStatus).toBe('SENT');
  });
});
