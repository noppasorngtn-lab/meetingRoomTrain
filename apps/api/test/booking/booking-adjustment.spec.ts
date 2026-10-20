import { Kysely } from 'kysely';
import { Clock } from '../../src/common/clock';
import { Database } from '../../src/common/database/schema';
import { BookingEditService, BookingLocked } from '../../src/modules/booking/booking-edit.service';
import { BookingInvalid } from '../../src/modules/booking/booking.service';
import { NotRoomAdministrator } from '../../src/modules/booking/room-admin';
import { BookingNotifier } from '../../src/modules/notification/booking-notifier';
import { MailMessage, MailTransport } from '../../src/modules/notification/mail-transport';
import { seedBooking, seedRoom, seedUser, startDatabase, truncateAll } from '../support/postgres';

jest.setTimeout(120_000);

/** 2026-10-<day>T<hh:mm> in Bangkok — the examples' "18/10 11:00". */
const at = (day: number, hhmm: string) => new Date(`2026-10-${day}T${hhmm}:00+07:00`);

class FakeTransport implements MailTransport {
  sent: MailMessage[] = [];
  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
}

describe('FE-mrr-031 an edit after the meeting ends becomes a request (UC-mrr-010)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let mail: FakeTransport;
  let now: Date;
  let service: BookingEditService;
  let u1: string;
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
    ra1 = await seedUser(db, 'RA1', 'ROOM_ADMINISTRATOR');
    roomA = await seedRoom(db, 'ห้อง A', ra1);
    // U1's booking: ห้อง A 18/10 10:00–11:00 'ประชุมทีม' — at 11:00 the meeting has ended.
    booking = await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:00') });
    mail = new FakeTransport();
    now = at(18, '11:00');
    const clock: Clock = { now: () => now };
    service = new BookingEditService(db, clock, new BookingNotifier(mail));
  });

  const title = async () => (await db.selectFrom('bookings').select('title').where('id', '=', booking).executeTakeFirstOrThrow()).title;
  const requests = () =>
    db
      .selectFrom('booking_adjustment_requests')
      .select(['booking_id', 'requested_by', 'proposed_changes', 'reason', 'status', 'decided_by', 'decided_at', 'created_at'])
      .execute();

  it('AC-mrr-041 18/10 11:00, the end — RA1\'s new title becomes a request; the booking keeps ประชุมทีม', async () => {
    const res = await service.adminEdit({ userId: ra1 }, booking, { title: 'ประชุมวางแผน' }, 'ผู้จองพิมพ์หัวข้อผิด');

    expect(res).toEqual({ message: 'ส่งคำขอแก้ไขแล้ว รอผู้ดูแลห้องคนอื่นอนุมัติ' });
    expect(await title()).toBe('ประชุมทีม');
    expect(await requests()).toEqual([{
      booking_id: booking, requested_by: ra1, proposed_changes: { title: 'ประชุมวางแผน' }, reason: 'ผู้จองพิมพ์หัวข้อผิด',
      status: 'PENDING', decided_by: null, decided_at: null, created_at: at(18, '11:00'),
    }]);
  });

  const edit = (input: object, reason = 'บันทึกเวลาจริง', by = ra1) => service.adminEdit({ userId: by }, booking, input, reason);
  const trail = () =>
    db.selectFrom('booking_audit_entries').select(['actor_id', 'action', 'reason', 'detail', 'at']).where('booking_id', '=', booking).execute();

  it('a later time, attendees and equipment are asked for too — only what differs, in the api\'s own names', async () => {
    const u2 = await seedUser(db, 'U2');
    const { id: mic } = await db.insertInto('facilities').values({ name: 'ไมโครโฟน' }).returning('id').executeTakeFirstOrThrow();

    await edit({ title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:30'), attendeeIds: [u2], equipmentIds: [mic] });

    expect((await requests())[0].proposed_changes).toEqual({ endAt: at(18, '11:30').toISOString(), attendeeIds: [u2], equipmentIds: [mic] });
    const row = await db.selectFrom('bookings').select('end_at').where('id', '=', booking).executeTakeFirstOrThrow();
    expect(row.end_at).toEqual(at(18, '11:00'));
    expect(await db.selectFrom('booking_attendees').selectAll().where('booking_id', '=', booking).execute()).toEqual([]);
  });

  it('nothing that differs is no request at all — ENT-011 needs at least one field', async () => {
    await expect(edit({ title: 'ประชุมทีม' })).rejects.toThrow(new BookingInvalid('changes', 'ไม่มีค่าที่ขอแก้ไข'));
    expect(await requests()).toEqual([]);
  });

  it('BR-mrr-017 one trail entry: RA1 · 11:00 · สร้างคำขอแก้ไข · the reason · what was asked', async () => {
    await edit({ title: 'ประชุมวางแผน' }, 'ผู้จองพิมพ์หัวข้อผิด');

    expect(await trail()).toEqual([{
      actor_id: ra1, action: 'CREATE_ADJUSTMENT', reason: 'ผู้จองพิมพ์หัวข้อผิด',
      detail: { before: { title: 'ประชุมทีม' }, after: { title: 'ประชุมวางแผน' } }, at: at(18, '11:00'),
    }]);
  });

  it('sends no mail — nothing has changed yet', async () => {
    await edit({ endAt: at(18, '11:30') });

    expect(mail.sent).toEqual([]);
  });

  it.each(['', '  '])('UC-mrr-010 no reason (%j) — no request, กรุณาระบุเหตุผล', async (reason) => {
    await expect(edit({ title: 'ประชุมวางแผน' }, reason)).rejects.toThrow(new BookingInvalid('reason', 'กรุณาระบุเหตุผล'));
    expect(await requests()).toEqual([]);
    expect(await trail()).toEqual([]);
  });

  it('a title the booking itself could not have is refused here too (BR-mrr-002)', async () => {
    await expect(edit({ title: '   ' })).rejects.toBeInstanceOf(BookingInvalid);
    expect(await requests()).toEqual([]);
  });

  it('the asked-for end still has to come after the start — but may lie in the past, the meeting is over', async () => {
    await expect(edit({ endAt: at(18, '09:30') })).rejects.toThrow(new BookingInvalid('end', 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม'));
    now = at(19, '09:00');

    expect(await edit({ endAt: at(18, '10:45') })).toEqual({ message: 'ส่งคำขอแก้ไขแล้ว รอผู้ดูแลห้องคนอื่นอนุมัติ' });
  });

  it('attendees and equipment that do not exist are refused before anything is asked', async () => {
    await expect(edit({ attendeeIds: ['99999999-9999-9999-9999-999999999999'] })).rejects.toBeInstanceOf(BookingInvalid);
    await expect(edit({ equipmentIds: ['99999999-9999-9999-9999-999999999999'] })).rejects.toBeInstanceOf(BookingInvalid);
    expect(await requests()).toEqual([]);
  });

  it('ACL-011 a General User cannot ask', async () => {
    await expect(edit({ title: 'ประชุมวางแผน' }, 'x', u1)).rejects.toBeInstanceOf(NotRoomAdministrator);
  });

  it.each(['PENDING_APPROVAL', 'REJECTED', 'CANCELLED'] as const)('ACL-011 a %s booking held no meeting — no request', async (state) => {
    await db.updateTable('bookings').set({ status: state }).where('id', '=', booking).execute();

    await expect(edit({ title: 'ประชุมวางแผน' })).rejects.toBeInstanceOf(BookingLocked);
    expect(await requests()).toEqual([]);
  });

  it('at 10:59, before the end, the same edit is still made directly (UC-mrr-010 alt flow)', async () => {
    now = at(18, '10:59');

    expect(await edit({ title: 'ประชุมวางแผน' })).toEqual({ message: 'บันทึกการแก้ไขสำเร็จ' });
    expect(await title()).toBe('ประชุมวางแผน');
    expect(await requests()).toEqual([]);
  });
});
