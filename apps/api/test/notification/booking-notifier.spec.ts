import { BookingNotifier, BookingSnapshot, EmailDeliveryFailed } from '../../src/modules/notification/booking-notifier';
import { MailMessage, MailTransport } from '../../src/modules/notification/mail-transport';

class InMemoryTransport implements MailTransport {
  sent: MailMessage[] = [];
  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
  subjectsFor(email: string): string[] {
    return this.sent.filter((m) => m.to.includes(email)).map((m) => m.subject);
  }
}

const U1 = 'u1@example.test';
const U2 = 'u2@example.test';
const U3 = 'u3@example.test';

// 17/10 is read in Asia/Bangkok, the timezone the subjects are written in.
const at = (hhmm: string) => new Date(`2026-10-17T${hhmm}:00+07:00`);

const meeting = (over: Partial<BookingSnapshot> = {}): BookingSnapshot => ({
  title: 'ประชุมทีม',
  roomName: 'ห้อง A',
  startAt: at('10:00'),
  endAt: at('11:00'),
  bookerEmail: U1,
  attendeeEmails: [U2, U3],
  ...over,
});

describe('FE-mrr-017 BookingNotifier', () => {
  let transport: InMemoryTransport;
  let notifier: BookingNotifier;

  beforeEach(() => {
    transport = new InMemoryTransport();
    notifier = new BookingNotifier(transport);
  });

  it('AC-mrr-019 a new booking mails the booker only', async () => {
    await notifier.bookingCreated(meeting(), at('08:00'));

    expect(transport.subjectsFor(U1)).toEqual([
      '[จองห้องประชุม] จองสำเร็จ: ประชุมทีม · ห้อง A 17/10 10:00–11:00',
    ]);
    expect(transport.subjectsFor(U2)).toEqual([]);
    expect(transport.subjectsFor(U3)).toEqual([]);
  });

  it('AC-mrr-021 moving the time mails the booker and every attendee', async () => {
    const before = meeting();
    const after = meeting({ startAt: at('14:00'), endAt: at('15:00') });

    await notifier.bookingEdited(before, after);

    const expected = ['[จองห้องประชุม] เปลี่ยนเวลา: ประชุมทีม · ห้อง A 17/10 14:00–15:00'];
    expect(transport.subjectsFor(U1)).toEqual(expected);
    expect(transport.subjectsFor(U2)).toEqual(expected);
    expect(transport.subjectsFor(U3)).toEqual(expected);
  });

  it('AC-mrr-022 changing only the title or attendees mails nobody', async () => {
    await notifier.bookingEdited(meeting(), meeting({ title: 'ประชุมวางแผน', attendeeEmails: [U2] }));

    expect(transport.sent).toEqual([]);
  });

  it('AC-mrr-024 a booking made 10 minutes before start also sends the reminder at once', async () => {
    const urgent = meeting({ title: 'ประชุมด่วน', attendeeEmails: [U2] });

    const result = await notifier.bookingCreated(urgent, at('09:50'));

    expect(transport.subjectsFor(U1)).toEqual([
      '[จองห้องประชุม] จองสำเร็จ: ประชุมด่วน · ห้อง A 17/10 10:00–11:00',
      '[จองห้องประชุม] ใกล้ถึงเวลาประชุม: ประชุมด่วน · ห้อง A 17/10 10:00–11:00',
    ]);
    expect(transport.subjectsFor(U2)).toEqual([
      '[จองห้องประชุม] ใกล้ถึงเวลาประชุม: ประชุมด่วน · ห้อง A 17/10 10:00–11:00',
    ]);
    // The caller records this so the scheduled reminder never sends a second one (AC-mrr-075).
    expect(result).toEqual({ reminderSent: true });
  });

  describe('when the mail server is down', () => {
    class DownTransport implements MailTransport {
      attempts = 0;
      async send(): Promise<void> {
        this.attempts++;
        throw new Error('ECONNREFUSED');
      }
    }
    let down: DownTransport;
    const FAILED = 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง';

    beforeEach(() => {
      down = new DownTransport();
      notifier = new BookingNotifier(down);
    });

    it('AC-mrr-060 a new booking fails with the retry message, tried once, no queue', async () => {
      await expect(notifier.bookingCreated(meeting({ startAt: at('13:00'), endAt: at('14:00') }), at('08:00')))
        .rejects.toThrow(EmailDeliveryFailed);
      await expect(notifier.bookingCreated(meeting(), at('08:00'))).rejects.toThrow(FAILED);
      expect(down.attempts).toBe(2);
    });

    it('AC-mrr-061 a time change fails with the retry message', async () => {
      const after = meeting({ startAt: at('14:00'), endAt: at('15:00') });
      await expect(notifier.bookingEdited(meeting(), after)).rejects.toThrow(FAILED);
    });

    it('AC-mrr-063 a title-only change does not touch the mail server, so it cannot fail', async () => {
      await expect(notifier.bookingEdited(meeting(), meeting({ title: 'ประชุมวางแผน' }))).resolves.toBeUndefined();
      expect(down.attempts).toBe(0);
    });
  });
});
