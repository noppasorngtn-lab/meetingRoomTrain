import { AutoCancelJob } from '../../src/modules/auto-cancel/auto-cancel-job';
import { AutoCancelCandidate, AutoCancelStore } from '../../src/modules/auto-cancel/auto-cancel-store';
import { BookingNotifier } from '../../src/modules/notification/booking-notifier';
import { MailMessage, MailTransport } from '../../src/modules/notification/mail-transport';

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

class InMemoryStore implements AutoCancelStore {
  constructor(public bookings: AutoCancelCandidate[]) {}
  async listPendingStartedBy(now: Date): Promise<AutoCancelCandidate[]> {
    return this.bookings.filter((b) => b.status === 'PENDING_APPROVAL' && b.startAt <= now).map((b) => ({ ...b }));
  }
  async cancelIfPending(id: string): Promise<boolean> {
    const b = this.bookings.find((x) => x.id === id)!;
    if (b.status !== 'PENDING_APPROVAL') return false;
    b.status = 'CANCELLED';
    return true;
  }
  get(id: string): AutoCancelCandidate {
    return this.bookings.find((x) => x.id === id)!;
  }
}

const U1 = 'u1@example.test';
const U2 = 'u2@example.test';
const at = (hhmm: string) => new Date(`2026-10-18T${hhmm}:00+07:00`);

const pending = (over: Partial<AutoCancelCandidate> = {}): AutoCancelCandidate => ({
  id: 'b1',
  title: 'ประชุมลูกค้า',
  roomName: 'ห้อง B',
  startAt: at('10:00'),
  endAt: at('11:00'),
  bookerEmail: U1,
  attendeeEmails: [U2],
  status: 'PENDING_APPROVAL',
  ...over,
});

describe('FE-mrr-019 AutoCancelJob', () => {
  let transport: SwitchableTransport;
  let store: InMemoryStore;
  let job: AutoCancelJob;

  const setup = (...bookings: AutoCancelCandidate[]) => {
    transport = new SwitchableTransport();
    store = new InMemoryStore(bookings);
    job = new AutoCancelJob(store, new BookingNotifier(transport));
  };

  it('AC-mrr-049 at the start time a still-pending booking is cancelled after the booker is told', async () => {
    setup(pending());

    await job.run(at('10:00'));

    expect(transport.subjectsFor(U1)).toEqual(['[จองห้องประชุม] ยกเลิกอัตโนมัติ: ประชุมลูกค้า · ห้อง B 18/10 10:00–11:00']);
    expect(transport.subjectsFor(U2)).toEqual([]);
    expect(store.get('b1').status).toBe('CANCELLED');
  });

  it('AC-mrr-048 at 09:59 the booking is left pending and nobody is mailed', async () => {
    setup(pending());

    await job.run(at('09:59'));

    expect(transport.sent).toEqual([]);
    expect(store.get('b1').status).toBe('PENDING_APPROVAL');
  });

  it('AC-mrr-050 if the mail fails the booking stays pending, and the next pass tries again', async () => {
    setup(pending());
    transport.down = true;

    await expect(job.run(at('10:00'))).resolves.toBeUndefined();
    expect(store.get('b1').status).toBe('PENDING_APPROVAL');

    transport.down = false;
    await job.run(at('10:01'));

    expect(transport.subjectsFor(U1)).toEqual(['[จองห้องประชุม] ยกเลิกอัตโนมัติ: ประชุมลูกค้า · ห้อง B 18/10 10:00–11:00']);
    expect(store.get('b1').status).toBe('CANCELLED');
  });
});
