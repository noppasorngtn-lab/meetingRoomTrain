import { Inject, Injectable } from '@nestjs/common';
import { MAIL_TRANSPORT, MailTransport } from './mail-transport';

/** What a notification needs to know about a booking — nothing more. */
export interface BookingSnapshot {
  title: string;
  roomName: string;
  startAt: Date;
  endAt: Date;
  bookerEmail: string;
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
   * A booking made less than 15 minutes before it starts gets its reminder now, because the
   * scheduled one has already passed (BR-mrr-008). `reminderSent` lets the caller record that.
   */
  async bookingCreated(booking: BookingSnapshot, now: Date): Promise<{ reminderSent: boolean }> {
    const s = subject('จองสำเร็จ', booking);
    await this.transport.send({ to: [booking.bookerEmail], subject: s, text: s });

    if (booking.startAt.getTime() - now.getTime() >= REMINDER_LEAD_MS) return { reminderSent: false };
    const r = subject('ใกล้ถึงเวลาประชุม', booking);
    await this.transport.send({ to: [booking.bookerEmail, ...booking.attendeeEmails], subject: r, text: r });
    return { reminderSent: true };
  }

  /** Only a change of time is announced; a title or attendee change saves silently (UC-mrr-017 alt flow). */
  async bookingEdited(before: BookingSnapshot, after: BookingSnapshot): Promise<void> {
    const timeChanged =
      before.startAt.getTime() !== after.startAt.getTime() || before.endAt.getTime() !== after.endAt.getTime();
    if (!timeChanged) return;
    const s = subject('เปลี่ยนเวลา', after);
    await this.transport.send({ to: [after.bookerEmail, ...after.attendeeEmails], subject: s, text: s });
  }
}
