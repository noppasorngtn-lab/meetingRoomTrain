import { Kysely } from 'kysely';
import { Clock } from '../../src/common/clock';
import { Database } from '../../src/common/database/schema';
import { BookingEditService, BookingLocked, BookingNotFound } from '../../src/modules/booking/booking-edit.service';
import { NotRoomAdministrator } from '../../src/modules/booking/room-admin';
import { BookingInvalid, SlotTaken } from '../../src/modules/booking/booking.service';
import { BookingNotifier, EmailDeliveryFailed } from '../../src/modules/notification/booking-notifier';
import { MailMessage, MailTransport } from '../../src/modules/notification/mail-transport';
import { seedBooking, seedRoom, seedUser, startDatabase, truncateAll } from '../support/postgres';

jest.setTimeout(120_000);

/** 2026-10-<day>T<hh:mm> in Bangkok — the examples' "18/10 10:00". */
const at = (day: number, hhmm: string) => new Date(`2026-10-${day}T${hhmm}:00+07:00`);

class FakeTransport implements MailTransport {
  sent: MailMessage[] = [];
  down = false;
  async send(message: MailMessage): Promise<void> {
    if (this.down) throw new Error('ECONNREFUSED');
    this.sent.push(message);
  }
}

describe('FE-mrr-030 edit or cancel on behalf of the booker (UC-mrr-009)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let mail: FakeTransport;
  let now: Date;
  let service: BookingEditService;
  let u1: string;
  let u2: string;
  let ra1: string;
  let roomA: { roomId: string; versionId: string };
  let booking: string;

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
  });

  afterAll(async () => {
    await stop();
  });

  beforeEach(async () => {
    await truncateAll(db);
    u1 = await seedUser(db, 'U1');
    u2 = await seedUser(db, 'U2');
    ra1 = await seedUser(db, 'RA1', 'ROOM_ADMINISTRATOR');
    roomA = await seedRoom(db, 'ห้อง A', ra1);
    // U1's booking: ห้อง A 18/10 10:00–11:00 'ประชุมทีม', attendee U2, under way at 10:30.
    booking = await seedBooking(db, {
      room: roomA, bookedBy: u1, title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:00'), attendees: [u2],
    });
    mail = new FakeTransport();
    now = at(18, '10:30');
    const clock: Clock = { now: () => now };
    service = new BookingEditService(db, clock, new BookingNotifier(mail));
  });

  const trail = () =>
    db.selectFrom('booking_audit_entries').select(['actor_id', 'action', 'reason', 'detail', 'at']).where('booking_id', '=', booking).execute();
  const row = (id = booking) =>
    db.selectFrom('bookings').select(['status', 'title', 'start_at', 'end_at', 'cancel_reason']).where('id', '=', id).executeTakeFirstOrThrow();

  describe('edit on behalf (API-014)', () => {
    const edit = (input: object, reason = 'ผู้จองพิมพ์หัวข้อผิด', by = ra1) => service.adminEdit({ userId: by }, booking, input, reason);

    it('AC-mrr-042 18/10 10:59, a minute before the end — the title becomes ประชุมวางแผน at once, บันทึกการแก้ไขสำเร็จ', async () => {
      now = at(18, '10:59');

      expect(await edit({ title: 'ประชุมวางแผน' })).toEqual({ message: 'บันทึกการแก้ไขสำเร็จ' });
      expect(await row()).toMatchObject({ title: 'ประชุมวางแผน', status: 'CONFIRMED' });
    });

    it('BR-mrr-017 one trail entry: RA1 · 10:30 · แก้แทนผู้จอง · the reason · what changed, before and after', async () => {
      await edit({ title: 'ประชุมวางแผน' });

      expect(await trail()).toEqual([{
        actor_id: ra1, action: 'EDIT_ON_BEHALF', reason: 'ผู้จองพิมพ์หัวข้อผิด',
        detail: { before: { title: 'ประชุมทีม' }, after: { title: 'ประชุมวางแผน' } }, at: at(18, '10:30'),
      }]);
    });

    it('a title change saves without mail (BR-mrr-007)', async () => {
      await edit({ title: 'ประชุมวางแผน' });

      expect(mail.sent).toEqual([]);
    });

    it('extending the meeting to 11:30 mails the booker and every attendee of the new time', async () => {
      await edit({ endAt: at(18, '11:30') }, 'ประชุมยังไม่เสร็จ');

      expect(await row()).toMatchObject({ end_at: at(18, '11:30') });
      expect(mail.sent).toEqual([{
        to: ['u1@example.test', 'u2@example.test'],
        subject: '[จองห้องประชุม] เปลี่ยนเวลา: ประชุมทีม · ห้อง A 18/10 10:00–11:30',
        text: '[จองห้องประชุม] เปลี่ยนเวลา: ประชุมทีม · ห้อง A 18/10 10:00–11:30',
      }]);
      expect((await trail())[0].detail).toEqual({ before: { endAt: at(18, '11:00').toISOString() }, after: { endAt: at(18, '11:30').toISOString() } });
    });

    it('BR-mrr-019 a new time whose mail does not go saves nothing and records nothing', async () => {
      mail.down = true;

      await expect(edit({ endAt: at(18, '11:30') }, 'ประชุมยังไม่เสร็จ')).rejects.toBeInstanceOf(EmailDeliveryFailed);
      expect(await row()).toMatchObject({ end_at: at(18, '11:00') });
      expect(await trail()).toEqual([]);
    });

    it.each(['', '  '])('no reason (%j) — nothing changes, กรุณาระบุเหตุผล, no trail', async (reason) => {
      await expect(edit({ title: 'ประชุมวางแผน' }, reason)).rejects.toThrow(new BookingInvalid('reason', 'กรุณาระบุเหตุผล'));
      expect(await row()).toMatchObject({ title: 'ประชุมทีม' });
      expect(await trail()).toEqual([]);
    });

    it('at 11:00, the end, a direct edit is over — refused here (after the end it becomes a request, UC-mrr-010)', async () => {
      now = at(18, '11:00');

      const refused = edit({ title: 'ประชุมวางแผน' });
      await expect(refused).rejects.toBeInstanceOf(BookingLocked);
      await expect(refused).rejects.toThrow('การประชุมจบแล้ว การแก้ไขต้องส่งเป็นคำขอแก้ไข');
      expect(await row()).toMatchObject({ title: 'ประชุมทีม' });
    });

    it('at 09:59, before the start, it is the booker\'s to edit — refused', async () => {
      now = at(18, '09:59');

      await expect(edit({ title: 'ประชุมวางแผน' })).rejects.toThrow('ยังไม่ถึงเวลาเริ่มประชุม ผู้จองแก้ไขหรือยกเลิกเองได้');
    });

    it('a meeting under way cannot be given an end that has already passed', async () => {
      await expect(edit({ endAt: at(18, '10:15') }, 'จบก่อน')).rejects.toThrow(new BookingInvalid('end', 'เวลาสิ้นสุดต้องเป็นเวลาในอนาคต'));
    });

    it('the end still has to come after the start', async () => {
      await expect(edit({ startAt: at(18, '11:30'), endAt: at(18, '11:15') }, 'เลื่อน')).rejects.toThrow(
        new BookingInvalid('end', 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม'),
      );
    });

    it('extending into a slot someone else holds is refused as room not free', async () => {
      await seedBooking(db, { room: roomA, bookedBy: u2, title: 'ต่อคิว', startAt: at(18, '11:00'), endAt: at(18, '12:00') });

      await expect(edit({ endAt: at(18, '11:30') }, 'ประชุมยังไม่เสร็จ')).rejects.toBeInstanceOf(SlotTaken);
      expect(await row()).toMatchObject({ end_at: at(18, '11:00') });
    });

    it('a General User cannot edit for the booker', async () => {
      await expect(edit({ title: 'ประชุมวางแผน' }, 'x', u1)).rejects.toThrow(
        new NotRoomAdministrator('เฉพาะผู้ดูแลห้องเท่านั้นที่แก้แทนผู้จองได้'),
      );
    });
  });

  describe('cancel on behalf (API-015)', () => {
    it('AC-mrr-028 RA1 cancels U1\'s booking under way with ห้องต้องใช้จัดงานด่วน — ยกเลิกการจองสำเร็จ', async () => {
      const res = await service.adminCancel({ userId: ra1 }, booking, 'ห้องต้องใช้จัดงานด่วน');

      expect(res).toEqual({ message: 'ยกเลิกการจองสำเร็จ' });
      expect(await row()).toMatchObject({ status: 'CANCELLED', cancel_reason: 'ห้องต้องใช้จัดงานด่วน' });
    });

    it.each(['', '  '])('AC-mrr-029 · AC-mrr-055 no reason (%j) — the booking stays, กรุณาระบุเหตุผล, and no trail', async (reason) => {
      await expect(service.adminCancel({ userId: ra1 }, booking, reason)).rejects.toThrow(new BookingInvalid('reason', 'กรุณาระบุเหตุผล'));
      expect(await row()).toMatchObject({ status: 'CONFIRMED', cancel_reason: null });
      expect(await trail()).toEqual([]);
      expect(mail.sent).toEqual([]);
    });

    it('AC-mrr-053 one trail entry: RA1 · 18/10 10:30 · ยกเลิกแทนผู้จอง · ห้องต้องใช้จัดงานด่วน', async () => {
      await service.adminCancel({ userId: ra1 }, booking, ' ห้องต้องใช้จัดงานด่วน ');

      expect(await trail()).toEqual([
        { actor_id: ra1, action: 'CANCEL_ON_BEHALF', reason: 'ห้องต้องใช้จัดงานด่วน', detail: null, at: at(18, '10:30') },
      ]);
    });

    it('mails the booker and every attendee (BR-mrr-007 (3) · API-015)', async () => {
      await service.adminCancel({ userId: ra1 }, booking, 'ห้องต้องใช้จัดงานด่วน');

      expect(mail.sent).toEqual([{
        to: ['u1@example.test', 'u2@example.test'],
        subject: '[จองห้องประชุม] ยกเลิก: ประชุมทีม · ห้อง A 18/10 10:00–11:00',
        text: '[จองห้องประชุม] ยกเลิก: ประชุมทีม · ห้อง A 18/10 10:00–11:00',
      }]);
    });

    it.each(['GENERAL_USER', 'SYSTEM_ADMINISTRATOR'] as const)('a %s cannot cancel for the booker (ACL-010 is ROLE-002 only)', async (role) => {
      const someone = await seedUser(db, 'Someone', role);

      await expect(service.adminCancel({ userId: someone }, booking, 'ห้องต้องใช้จัดงานด่วน')).rejects.toThrow(
        new NotRoomAdministrator('เฉพาะผู้ดูแลห้องเท่านั้นที่ยกเลิกแทนผู้จองได้'),
      );
      expect(await row()).toMatchObject({ status: 'CONFIRMED' });
    });

    it('the booker themself cannot use it either — they are a General User', async () => {
      await expect(service.adminCancel({ userId: u1 }, booking, 'ไม่ไปแล้ว')).rejects.toBeInstanceOf(NotRoomAdministrator);
    });

    it('BR-mrr-009 at 10:00, the start, a Room Administrator may act', async () => {
      now = at(18, '10:00');

      expect(await service.adminCancel({ userId: ra1 }, booking, 'ห้องต้องใช้จัดงานด่วน')).toEqual({ message: 'ยกเลิกการจองสำเร็จ' });
    });

    it('ACL-010 at 09:59, before the start, it is the booker\'s to cancel — refused', async () => {
      now = at(18, '09:59');

      const refused = service.adminCancel({ userId: ra1 }, booking, 'ห้องต้องใช้จัดงานด่วน');
      await expect(refused).rejects.toBeInstanceOf(BookingLocked);
      await expect(refused).rejects.toThrow('ยังไม่ถึงเวลาเริ่มประชุม ผู้จองแก้ไขหรือยกเลิกเองได้');
      expect(await row()).toMatchObject({ status: 'CONFIRMED' });
    });

    it('ACL-010 at 11:00, the end, the meeting is over — refused', async () => {
      now = at(18, '11:00');

      const refused = service.adminCancel({ userId: ra1 }, booking, 'ห้องต้องใช้จัดงานด่วน');
      await expect(refused).rejects.toBeInstanceOf(BookingLocked);
      await expect(refused).rejects.toThrow('การประชุมจบแล้ว ยกเลิกไม่ได้');
      expect(await trail()).toEqual([]);
    });

    it('an APPROVED booking can be cancelled for the booker too', async () => {
      await db.updateTable('bookings').set({ status: 'APPROVED' }).where('id', '=', booking).execute();

      expect(await service.adminCancel({ userId: ra1 }, booking, 'ห้องต้องใช้จัดงานด่วน')).toEqual({ message: 'ยกเลิกการจองสำเร็จ' });
    });

    it.each(['PENDING_APPROVAL', 'REJECTED', 'CANCELLED'] as const)('a %s booking holds no meeting to cancel — refused', async (state) => {
      await db.updateTable('bookings').set({ status: state }).where('id', '=', booking).execute();

      const refused = service.adminCancel({ userId: ra1 }, booking, 'ห้องต้องใช้จัดงานด่วน');
      await expect(refused).rejects.toBeInstanceOf(BookingLocked);
      await expect(refused).rejects.toThrow('การจองนี้ไม่ได้ใช้ห้องอยู่ แก้ไขหรือยกเลิกแทนไม่ได้');
      expect(await row()).toMatchObject({ status: state });
    });

    it('a booking that does not exist is not found', async () => {
      await expect(service.adminCancel({ userId: ra1 }, '99999999-9999-9999-9999-999999999999', 'x')).rejects.toBeInstanceOf(BookingNotFound);
    });

    it('BR-mrr-019 the mail does not go — nothing is cancelled and nothing is recorded', async () => {
      mail.down = true;

      await expect(service.adminCancel({ userId: ra1 }, booking, 'ห้องต้องใช้จัดงานด่วน')).rejects.toBeInstanceOf(EmailDeliveryFailed);
      expect(await row()).toMatchObject({ status: 'CONFIRMED', cancel_reason: null });
      expect(await trail()).toEqual([]);
    });
  });
});
