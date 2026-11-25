import { Inject, Injectable } from '@nestjs/common';
import { MAIL_TRANSPORT, MailTransport } from './mail-transport';

/** What a notification needs to know about a booking — nothing more. */
export interface BookingSnapshot {
  title: string;
  roomName: string;
  startAt: Date;
  endAt: Date;
  /** null when the booker's account is masked under ADR-017 (inactive): nothing is mailed to it (T5 F5). */
  bookerEmail: string | null;
  attendeeEmails: string[];
}

const TIME_ZONE = 'Asia/Bangkok';
const REMINDER_LEAD_MS = 15 * 60 * 1000;

const part = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, ...opts }).format(d);

const dayMonth = (d: Date) => part(d, { day: '2-digit', month: '2-digit' });
const hourMinute = (d: Date) => part(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** `[จองห้องประชุม] <event>: <title> · <room> <dd/mm> <hh:mm>–<hh:mm>` (UC-mrr-017 main flow). */
const subject = (event: string, b: BookingSnapshot) =>
  `[จองห้องประชุม] ${event}: ${b.title} · ${b.roomName} ${dayMonth(b.startAt)} ${hourMinute(b.startAt)}–${hourMinute(b.endAt)}`;

/**
 * The action that wanted this mail must fail with it: nothing is saved and nothing is queued for a
 * retry — the user presses again (BR-mrr-019 · INT-001 failure).
 */
export class EmailDeliveryFailed extends Error {
  constructor(readonly cause: unknown) {
    super('ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง');
    this.name = 'EmailDeliveryFailed';
  }
}

@Injectable()
export class BookingNotifier {
  private readonly transport: MailTransport;

  constructor(@Inject(MAIL_TRANSPORT) transport: MailTransport) {
    this.transport = {
      send: async (message) => {
        try {
          await transport.send(message);
        } catch (err) {
          throw new EmailDeliveryFailed(err);
        }
      },
    };
  }

  /**
   * Sends one mail to whoever of `to` can receive it. A masked booker (null) is left out; with nobody
   * left the mail is skipped and the action carries on (ADR-017 · T5 F5). Every other failure still
   * fails the action (BR-mrr-019).
   */
  private async deliver(event: string, booking: BookingSnapshot, to: (string | null)[]): Promise<void> {
    const recipients = to.filter((email): email is string => !!email);
    if (!recipients.length) return;
    const s = subject(event, booking);
    await this.transport.send({ to: recipients, subject: s, text: s });
  }

  /**
   * A booking made less than 15 minutes before it starts gets its reminder now, because the
   * scheduled one has already passed (BR-mrr-008). `reminderSent` lets the caller record that.
   */
  async bookingCreated(booking: BookingSnapshot, now: Date): Promise<{ reminderSent: boolean }> {
    await this.deliver('จองสำเร็จ', booking, [booking.bookerEmail]);

    if (booking.startAt.getTime() - now.getTime() >= REMINDER_LEAD_MS) return { reminderSent: false };
    await this.reminderDue(booking);
    return { reminderSent: true };
  }

  /** A Room Administrator approved it — the booker only (BR-mrr-007 (1) · UC-mrr-007). */
  async bookingApproved(booking: BookingSnapshot): Promise<void> {
    await this.deliver('อนุมัติแล้ว', booking, [booking.bookerEmail]);
  }

  /** The booker cancelled before the start — the booker and every attendee (BR-mrr-007 (3) · UC-mrr-005). */
  async bookingCancelled(booking: BookingSnapshot): Promise<void> {
    await this.deliver('ยกเลิกการจอง', booking, [booking.bookerEmail, ...booking.attendeeEmails]);
  }

  /** A Room Administrator rejected it — the booker and every attendee (BR-mrr-007@v2 (3) · EX-mrr-118). */
  async bookingRejected(booking: BookingSnapshot): Promise<void> {
    await this.deliver('ปฏิเสธการจอง', booking, [booking.bookerEmail, ...booking.attendeeEmails]);
  }

  /** A pending booking cancelled at its start time — the booker only (UC-mrr-019). */
  async bookingAutoCancelled(booking: BookingSnapshot): Promise<void> {
    await this.deliver('ยกเลิกอัตโนมัติ', booking, [booking.bookerEmail]);
  }

  /** The 15-minute reminder, to the booker and every attendee (UC-mrr-018). */
  async reminderDue(booking: BookingSnapshot): Promise<void> {
    await this.deliver('ใกล้ถึงเวลาประชุม', booking, [booking.bookerEmail, ...booking.attendeeEmails]);
  }

  /** Only a change of time is announced; a title or attendee change saves silently (UC-mrr-017 alt flow). */
  async bookingEdited(before: BookingSnapshot, after: BookingSnapshot): Promise<void> {
    const timeChanged =
      before.startAt.getTime() !== after.startAt.getTime() || before.endAt.getTime() !== after.endAt.getTime();
    if (!timeChanged) return;
    await this.deliver('เปลี่ยนเวลา', after, [after.bookerEmail, ...after.attendeeEmails]);
  }
}
