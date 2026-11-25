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

  // GAP-mrr-026 · the BR-mrr-007@v2 / BR-mrr-019@v1 criteria whose mail this notifier writes. Whether a
  // pending booking mails at all (AC-mrr-117) is the booking service's call, not this class's — it is
  // proved where the service decides it (FE-mrr-024).
  const B = { title: 'ประชุมลูกค้า', roomName: 'ห้อง B', attendeeEmails: [U2] };

  it('AC-mrr-116 U1 books ห้อง A 13:00–14:00 — U1 gets จองสำเร็จ and no retry message is raised', async () => {
    await expect(notifier.bookingCreated(meeting({ startAt: at('13:00'), endAt: at('14:00'), attendeeEmails: [U2] }), at('08:00'))).resolves.toEqual({ reminderSent: false });

    expect(transport.subjectsFor(U1)).toEqual(['[จองห้องประชุม] จองสำเร็จ: ประชุมทีม · ห้อง A 17/10 13:00–14:00']);
    expect(transport.subjectsFor(U2)).toEqual([]);
  });

  it('AC-mrr-118 approving ห้อง B mails อนุมัติแล้ว to U1 only — U2 gets nothing', async () => {
    await notifier.bookingApproved(meeting(B));

    expect(transport.subjectsFor(U1)).toEqual(['[จองห้องประชุม] อนุมัติแล้ว: ประชุมลูกค้า · ห้อง B 17/10 10:00–11:00']);
    expect(transport.subjectsFor(U2)).toEqual([]);
  });

  it('AC-mrr-119 · AC-mrr-120 a cancellation — by U1 or by a Room Administrator on U1\'s behalf — mails ยกเลิกการจอง to U1, U2 and U3', async () => {
    await notifier.bookingCancelled(meeting());

    for (const u of [U1, U2, U3]) expect(transport.subjectsFor(u)).toEqual(['[จองห้องประชุม] ยกเลิกการจอง: ประชุมทีม · ห้อง A 17/10 10:00–11:00']);
    expect(transport.sent).toHaveLength(1);
  });

  it('AC-mrr-121 · AC-mrr-127 a rejection — of a pending booking or by changing an approval — mails ปฏิเสธการจอง to U1 and U2', async () => {
    await notifier.bookingRejected(meeting(B));

    for (const u of [U1, U2]) expect(transport.subjectsFor(u)).toEqual(['[จองห้องประชุม] ปฏิเสธการจอง: ประชุมลูกค้า · ห้อง B 17/10 10:00–11:00']);
    expect(transport.sent).toHaveLength(1);
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

  // ADR-017 · T5 F5: a booker masked (inactive) has no bookerEmail, and is left out like a masked attendee.
  // Nobody left to mail → the mail is skipped and the action carries on (the user's answer, 2026-11-25).
  describe('F5 a booker masked under ADR-017', () => {
    const masked = (over: Partial<BookingSnapshot> = {}) => meeting({ bookerEmail: null, ...over });

    it.each([
      ['bookingCancelled', 'ยกเลิกการจอง'],
      ['bookingRejected', 'ปฏิเสธการจอง'],
      ['reminderDue', 'ใกล้ถึงเวลาประชุม'],
    ] as const)('%s mails the attendees only', async (method, event) => {
      await notifier[method](masked());

      expect(transport.sent.map((m) => [m.to, m.subject])).toEqual([
        [[U2, U3], `[จองห้องประชุม] ${event}: ประชุมทีม · ห้อง A 17/10 10:00–11:00`],
      ]);
    });

    it('a new time mails the attendees only', async () => {
      await notifier.bookingEdited(masked(), masked({ startAt: at('14:00'), endAt: at('15:00') }));

      expect(transport.sent.map((m) => m.to)).toEqual([[U2, U3]]);
    });

    it.each(['bookingApproved', 'bookingAutoCancelled', 'bookingCancelled', 'bookingRejected', 'reminderDue'] as const)(
      '%s with nobody left to mail sends nothing and does not fail',
      async (method) => {
        await expect(notifier[method](masked({ attendeeEmails: [] }))).resolves.toBeUndefined();
        expect(transport.sent).toEqual([]);
      },
    );

    it('a new time with nobody left to mail sends nothing', async () => {
      const before = masked({ attendeeEmails: [] });
      await notifier.bookingEdited(before, masked({ attendeeEmails: [], startAt: at('14:00'), endAt: at('15:00') }));

      expect(transport.sent).toEqual([]);
    });

    it('a booking made usable 5 minutes before its start: nobody to mail, yet its reminder counts as sent', async () => {
      await expect(notifier.bookingCreated(masked({ attendeeEmails: [] }), at('09:55'))).resolves.toEqual({ reminderSent: true });
      expect(transport.sent).toEqual([]);
    });

    it('a booking made usable 5 minutes before its start: the reminder still reaches the attendees', async () => {
      await notifier.bookingCreated(masked(), at('09:55'));

      expect(transport.sent.map((m) => [m.to, m.subject])).toEqual([
        [[U2, U3], '[จองห้องประชุม] ใกล้ถึงเวลาประชุม: ประชุมทีม · ห้อง A 17/10 10:00–11:00'],
      ]);
    });
  });
});
