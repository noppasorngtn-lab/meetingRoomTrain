import { Kysely } from 'kysely';
import { Clock } from '../../src/common/clock';
import { Database } from '../../src/common/database/schema';
import { BookingApprovalService, DecisionLocked, NotRoomAdministrator } from '../../src/modules/booking/booking-approval.service';
import { BookingNotFound } from '../../src/modules/booking/booking-edit.service';
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

describe('FE-mrr-029 change an approval decision (UC-mrr-008)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let mail: FakeTransport;
  let now: Date;
  let service: BookingApprovalService;
  let u1: string;
  let ra: string;
  let roomB: { roomId: string; versionId: string };
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
    ra = await seedUser(db, 'RA', 'ROOM_ADMINISTRATOR');
    roomB = await seedRoom(db, 'ห้อง B', ra, { requiresApproval: true });
    // U1's booking: ห้อง B 18/10 10:00–11:00 'ประชุมลูกค้า', approved.
    booking = await seedBooking(db, {
      room: roomB, bookedBy: u1, title: 'ประชุมลูกค้า', startAt: at(18, '10:00'), endAt: at(18, '11:00'), status: 'APPROVED',
    });
    mail = new FakeTransport();
    now = at(16, '15:00');
    const clock: Clock = { now: () => now };
    service = new BookingApprovalService(db, clock, new BookingNotifier(mail));
  });

  const status = async (id = booking) =>
    (await db.selectFrom('bookings').select('status').where('id', '=', id).executeTakeFirstOrThrow()).status;

  it('AC-mrr-033 approved → rejected with the reason อนุมัติผิดห้อง — ปฏิเสธแล้ว and เปลี่ยนผลการอนุมัติสำเร็จ', async () => {
    const res = await service.changeDecision({ userId: ra }, booking, { decision: 'REJECTED', reason: 'อนุมัติผิดห้อง' });

    expect(res).toEqual({ message: 'เปลี่ยนผลการอนุมัติสำเร็จ' });
    expect(await status()).toBe('REJECTED');
  });

  it.each(['', '   '])('AC-mrr-034 no reason (%j) — still อนุมัติแล้ว and กรุณาระบุเหตุผล', async (reason) => {
    await expect(service.changeDecision({ userId: ra }, booking, { decision: 'REJECTED', reason })).rejects.toThrow(
      new BookingInvalid('reason', 'กรุณาระบุเหตุผล'),
    );
    expect(await status()).toBe('APPROVED');
  });

  it('AC-mrr-035 18/10 09:59, a minute before the start — rejected → approved with ปฏิเสธผิดคน goes through', async () => {
    await db.updateTable('bookings').set({ status: 'REJECTED' }).where('id', '=', booking).execute();
    now = at(18, '09:59');

    expect(await service.changeDecision({ userId: ra }, booking, { decision: 'APPROVED', reason: 'ปฏิเสธผิดคน' })).toEqual({
      message: 'เปลี่ยนผลการอนุมัติสำเร็จ',
    });
    expect(await status()).toBe('APPROVED');
  });

  const trail = () =>
    db.selectFrom('booking_audit_entries').select(['actor_id', 'action', 'reason', 'detail', 'at']).where('booking_id', '=', booking).execute();
  const rejected = () => db.updateTable('bookings').set({ status: 'REJECTED' }).where('id', '=', booking).execute();

  it('BR-mrr-017 one trail entry: RA · 16/10 15:00 · CHANGE_DECISION · the reason as typed · from and to', async () => {
    await service.changeDecision({ userId: ra }, booking, { decision: 'REJECTED', reason: '  อนุมัติผิดห้อง ' });

    expect(await trail()).toEqual([{
      actor_id: ra, action: 'CHANGE_DECISION', reason: 'อนุมัติผิดห้อง', detail: { from: 'APPROVED', to: 'REJECTED' }, at: at(16, '15:00'),
    }]);
  });

  it('approved → rejected sends no mail — BR-mrr-007 names none for a rejection', async () => {
    await service.changeDecision({ userId: ra }, booking, { decision: 'REJECTED', reason: 'อนุมัติผิดห้อง' });

    expect(mail.sent).toEqual([]);
  });

  it('rejected → approved mails the booker that it was approved (BR-mrr-007 (1))', async () => {
    await rejected();

    await service.changeDecision({ userId: ra }, booking, { decision: 'APPROVED', reason: 'ปฏิเสธผิดคน' });

    expect(mail.sent).toEqual([{
      to: ['u1@example.test'],
      subject: '[จองห้องประชุม] อนุมัติ: ประชุมลูกค้า · ห้อง B 18/10 10:00–11:00',
      text: '[จองห้องประชุม] อนุมัติ: ประชุมลูกค้า · ห้อง B 18/10 10:00–11:00',
    }]);
  });

  it('BR-mrr-019 rejected → approved whose mail does not go — still ปฏิเสธแล้ว, no trail, press again', async () => {
    await rejected();
    mail.down = true;

    const refused = service.changeDecision({ userId: ra }, booking, { decision: 'APPROVED', reason: 'ปฏิเสธผิดคน' });
    await expect(refused).rejects.toBeInstanceOf(EmailDeliveryFailed);
    await expect(refused).rejects.toThrow('ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง');
    expect(await status()).toBe('REJECTED');
    expect(await trail()).toEqual([]);
  });

  it('UC-mrr-008 alt flow — rejected → approved when the slot was booked meanwhile: refused as room not free', async () => {
    await rejected();
    const u2 = await seedUser(db, 'U2');
    await seedBooking(db, { room: roomB, bookedBy: u2, title: 'ประชุมอื่น', startAt: at(18, '10:30'), endAt: at(18, '11:30'), status: 'PENDING_APPROVAL' });

    const refused = service.changeDecision({ userId: ra }, booking, { decision: 'APPROVED', reason: 'ปฏิเสธผิดคน' });
    await expect(refused).rejects.toBeInstanceOf(SlotTaken);
    await expect(refused).rejects.toThrow('ห้องนี้ไม่ว่างในช่วงเวลาที่เลือก กรุณาเลือกเวลาอื่น');
    expect(await status()).toBe('REJECTED');
    expect(mail.sent).toEqual([]);
    expect(await trail()).toEqual([]);
  });

  it.each(['GENERAL_USER', 'SYSTEM_ADMINISTRATOR'] as const)('a %s cannot change a decision (ACL-009 is ROLE-002 only)', async (role) => {
    const someone = await seedUser(db, 'Someone', role);

    await expect(service.changeDecision({ userId: someone }, booking, { decision: 'REJECTED', reason: 'อนุมัติผิดห้อง' })).rejects.toThrow(
      new NotRoomAdministrator('เฉพาะผู้ดูแลห้องเท่านั้นที่เปลี่ยนผลการอนุมัติได้'),
    );
    expect(await status()).toBe('APPROVED');
  });

  it('ACL-009 any Room Administrator may change it, even where the room names another approver', async () => {
    await db.updateTable('meeting_room_versions').set({ approver_id: ra }).where('id', '=', roomB.versionId).execute();
    const ra2 = await seedUser(db, 'RA2', 'ROOM_ADMINISTRATOR');

    expect(await service.changeDecision({ userId: ra2 }, booking, { decision: 'REJECTED', reason: 'อนุมัติผิดห้อง' })).toEqual({
      message: 'เปลี่ยนผลการอนุมัติสำเร็จ',
    });
  });

  it.each(['PENDING_APPROVAL', 'CONFIRMED', 'CANCELLED'] as const)(
    'a booking that is %s has no decision to change — refused and left as it is',
    async (state) => {
      await db.updateTable('bookings').set({ status: state }).where('id', '=', booking).execute();

      const refused = service.changeDecision({ userId: ra }, booking, { decision: 'APPROVED', reason: 'ปฏิเสธผิดคน' });
      await expect(refused).rejects.toBeInstanceOf(DecisionLocked);
      await expect(refused).rejects.toThrow('เปลี่ยนผลได้เฉพาะการจองที่อนุมัติแล้วหรือปฏิเสธแล้ว');
      expect(await status()).toBe(state);
      expect(await trail()).toEqual([]);
    },
  );

  it('asking for the decision it already has is refused, so no empty change lands in the trail', async () => {
    const refused = service.changeDecision({ userId: ra }, booking, { decision: 'APPROVED', reason: 'ยืนยัน' });
    await expect(refused).rejects.toBeInstanceOf(DecisionLocked);
    await expect(refused).rejects.toThrow('การจองนี้อนุมัติแล้วอยู่แล้ว');
    expect(await trail()).toEqual([]);
  });

  it('a booking that does not exist is not found', async () => {
    await expect(
      service.changeDecision({ userId: ra }, '99999999-9999-9999-9999-999999999999', { decision: 'REJECTED', reason: 'อนุมัติผิดห้อง' }),
    ).rejects.toThrow(BookingNotFound);
  });

  it('AC-mrr-036 18/10 10:00, the meeting has started — still อนุมัติแล้ว and the page is told why', async () => {
    now = at(18, '10:00');

    const refused = service.changeDecision({ userId: ra }, booking, { decision: 'REJECTED', reason: 'อนุมัติผิดห้อง' });
    await expect(refused).rejects.toBeInstanceOf(DecisionLocked);
    await expect(refused).rejects.toThrow('การประชุมเริ่มแล้ว ไม่สามารถเปลี่ยนผลการอนุมัติได้');
    expect(await status()).toBe('APPROVED');
  });
});
