import { Kysely } from 'kysely';
import { Clock } from '../../src/common/clock';
import { Database } from '../../src/common/database/schema';
import {
  BookingApprovalService, NotPending, NotRoomAdministrator, NotTheApprover,
} from '../../src/modules/booking/booking-approval.service';
import { BookingNotFound } from '../../src/modules/booking/booking-edit.service';
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

describe('FE-mrr-028 approve or reject a booking (UC-mrr-007)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let mail: FakeTransport;
  let now: Date;
  let service: BookingApprovalService;
  let u1: string;
  let ra1: string;
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
    ra1 = await seedUser(db, 'RA1', 'ROOM_ADMINISTRATOR');
    roomB = await seedRoom(db, 'ห้อง B', ra1, { requiresApproval: true });
    // U1's booking: ห้อง B 18/10 10:00–11:00 'ประชุมลูกค้า', waiting for approval.
    booking = await seedBooking(db, {
      room: roomB, bookedBy: u1, title: 'ประชุมลูกค้า', startAt: at(18, '10:00'), endAt: at(18, '11:00'), status: 'PENDING_APPROVAL',
    });
    mail = new FakeTransport();
    now = at(16, '14:05');
    const clock: Clock = { now: () => now };
    service = new BookingApprovalService(db, clock, new BookingNotifier(mail));
  });

  const status = async (id = booking) =>
    (await db.selectFrom('bookings').select('status').where('id', '=', id).executeTakeFirstOrThrow()).status;

  it('AC-mrr-013 a Room Administrator approves — APPROVED and อนุมัติการจองสำเร็จ', async () => {
    const res = await service.approve({ userId: ra1 }, booking);

    expect(res).toEqual({ message: 'อนุมัติการจองสำเร็จ' });
    expect(await status()).toBe('APPROVED');
  });

  /** ห้อง B names its own approver (BR-mrr-013). */
  const approverOfB = (userId: string | null) =>
    db.updateTable('meeting_room_versions').set({ approver_id: userId }).where('id', '=', roomB.versionId).execute();

  it('AC-mrr-014 a General User cannot approve, even their own booking — still รออนุมัติ', async () => {
    await expect(service.approve({ userId: u1 }, booking)).rejects.toThrow(
      new NotRoomAdministrator('เฉพาะผู้ดูแลห้องเท่านั้นที่อนุมัติได้'),
    );
    expect(await status()).toBe('PENDING_APPROVAL');
  });

  it('AC-mrr-037 RA1, the room\'s approver, approves', async () => {
    await approverOfB(ra1);

    expect(await service.approve({ userId: ra1 }, booking)).toEqual({ message: 'อนุมัติการจองสำเร็จ' });
    expect(await status()).toBe('APPROVED');
  });

  it('AC-mrr-038 RA2 is a Room Administrator but not ห้อง B\'s approver — refused, still รออนุมัติ', async () => {
    await approverOfB(ra1);
    const ra2 = await seedUser(db, 'RA2', 'ROOM_ADMINISTRATOR');

    await expect(service.approve({ userId: ra2 }, booking)).rejects.toThrow(
      new NotTheApprover('เฉพาะผู้อนุมัติประจำห้องนี้เท่านั้นที่อนุมัติได้'),
    );
    expect(await status()).toBe('PENDING_APPROVAL');
  });

  it('AC-mrr-039 a room with no approver yet — any Room Administrator approves', async () => {
    const ra2 = await seedUser(db, 'RA2', 'ROOM_ADMINISTRATOR');

    expect(await service.approve({ userId: ra2 }, booking)).toEqual({ message: 'อนุมัติการจองสำเร็จ' });
    expect(await status()).toBe('APPROVED');
  });

  it('the approver named now counts, not the one on the room version the booking was made against', async () => {
    // BR-mrr-013 "กำหนดทีหลังได้": ห้อง B gets an approver in a new version after U1 booked.
    const ra2 = await seedUser(db, 'RA2', 'ROOM_ADMINISTRATOR');
    const v2 = await db
      .insertInto('meeting_room_versions')
      .values({ room_id: roomB.roomId, version_no: 2, name: 'ห้อง B', capacity: 10, requires_approval: true, approver_id: ra1, created_by: ra1 })
      .returning('id')
      .executeTakeFirstOrThrow();
    await db.updateTable('meeting_rooms').set({ current_version_id: v2.id }).where('id', '=', roomB.roomId).execute();

    await expect(service.approve({ userId: ra2 }, booking)).rejects.toThrow(NotTheApprover);
    expect(await service.approve({ userId: ra1 }, booking)).toEqual({ message: 'อนุมัติการจองสำเร็จ' });
  });

  const trail = (id = booking) =>
    db.selectFrom('booking_audit_entries').select(['actor_id', 'action', 'reason', 'at']).where('booking_id', '=', id).execute();

  it('mails the booker that it was approved — to the booker only (BR-mrr-007 (1))', async () => {
    await service.approve({ userId: ra1 }, booking);

    expect(mail.sent).toEqual([{
      to: ['u1@example.test'],
      subject: '[จองห้องประชุม] อนุมัติ: ประชุมลูกค้า · ห้อง B 18/10 10:00–11:00',
      text: '[จองห้องประชุม] อนุมัติ: ประชุมลูกค้า · ห้อง B 18/10 10:00–11:00',
    }]);
  });

  it('AC-mrr-062 the mail does not go — still รออนุมัติ, no trail, and the message asks to press again', async () => {
    mail.down = true;

    const refused = service.approve({ userId: ra1 }, booking);
    await expect(refused).rejects.toBeInstanceOf(EmailDeliveryFailed);
    await expect(refused).rejects.toThrow('ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง');
    expect(await status()).toBe('PENDING_APPROVAL');
    expect(await trail()).toEqual([]);
  });

  it('AC-mrr-052 16/10 14:05 RA1 approves — one new trail entry: RA1 · 16/10 14:05 · อนุมัติ · no reason', async () => {
    await service.approve({ userId: ra1 }, booking);

    expect(await trail()).toEqual([{ actor_id: ra1, action: 'APPROVE', reason: null, at: at(16, '14:05') }]);
  });

  it('AC-mrr-051 18/10 10:03, the auto-cancel could not mail and it is still pending — it can still be approved', async () => {
    now = at(18, '10:03');

    expect(await service.approve({ userId: ra1 }, booking)).toEqual({ message: 'อนุมัติการจองสำเร็จ' });
    // No longer PENDING_APPROVAL, so the next auto-cancel pass (cancelIfPending) leaves it alone.
    expect(await status()).toBe('APPROVED');
  });

  it.each(['CONFIRMED', 'APPROVED', 'REJECTED', 'CANCELLED'] as const)(
    'a booking that is %s is not waiting for approval — refused and left as it is',
    async (state) => {
      await db.updateTable('bookings').set({ status: state }).where('id', '=', booking).execute();

      const refused = service.approve({ userId: ra1 }, booking);
      await expect(refused).rejects.toBeInstanceOf(NotPending);
      await expect(refused).rejects.toThrow('การจองนี้ไม่ได้รออนุมัติแล้ว');
      expect(await status()).toBe(state);
      expect(mail.sent).toEqual([]);
      expect(await trail()).toEqual([]);
    },
  );

  it('a booking that does not exist is not found', async () => {
    await expect(service.approve({ userId: ra1 }, '99999999-9999-9999-9999-999999999999')).rejects.toThrow(BookingNotFound);
  });

  it('the trail cannot be changed or removed once written (BR-mrr-018)', async () => {
    await service.approve({ userId: ra1 }, booking);

    await expect(db.updateTable('booking_audit_entries').set({ reason: 'แก้' }).execute()).rejects.toThrow();
    await expect(db.deleteFrom('booking_audit_entries').execute()).rejects.toThrow();
    expect(await trail()).toHaveLength(1);
  });

  describe('reject (API-012)', () => {
    it('a Room Administrator rejects — REJECTED, ปฏิเสธการจองสำเร็จ, and no mail (BR-mrr-007 names none)', async () => {
      expect(await service.reject({ userId: ra1 }, booking)).toEqual({ message: 'ปฏิเสธการจองสำเร็จ' });
      expect(await status()).toBe('REJECTED');
      expect(mail.sent).toEqual([]);
    });

    it('releases the slot — someone else can book ห้อง B 18/10 10:00–11:00 again', async () => {
      await service.reject({ userId: ra1 }, booking);
      const u2 = await seedUser(db, 'U2');

      const again = await seedBooking(db, {
        room: roomB, bookedBy: u2, title: 'ประชุมใหม่', startAt: at(18, '10:00'), endAt: at(18, '11:00'), status: 'PENDING_APPROVAL',
      });
      expect(await status(again)).toBe('PENDING_APPROVAL');
    });

    it('BR-mrr-017 leaves one trail entry: RA1 · 16/10 14:05 · ปฏิเสธ · no reason', async () => {
      await service.reject({ userId: ra1 }, booking);

      expect(await trail()).toEqual([{ actor_id: ra1, action: 'REJECT', reason: null, at: at(16, '14:05') }]);
    });

    it('a General User cannot reject', async () => {
      await expect(service.reject({ userId: u1 }, booking)).rejects.toThrow(
        new NotRoomAdministrator('เฉพาะผู้ดูแลห้องเท่านั้นที่ปฏิเสธได้'),
      );
      expect(await status()).toBe('PENDING_APPROVAL');
    });

    it('a Room Administrator who is not the room\'s approver cannot reject', async () => {
      await approverOfB(ra1);
      const ra2 = await seedUser(db, 'RA2', 'ROOM_ADMINISTRATOR');

      await expect(service.reject({ userId: ra2 }, booking)).rejects.toThrow(
        new NotTheApprover('เฉพาะผู้อนุมัติประจำห้องนี้เท่านั้นที่ปฏิเสธได้'),
      );
      expect(await status()).toBe('PENDING_APPROVAL');
      expect(await trail()).toEqual([]);
    });

    it('an approved booking is not rejected here — that is a change of decision with a reason (API-013)', async () => {
      await service.approve({ userId: ra1 }, booking);

      await expect(service.reject({ userId: ra1 }, booking)).rejects.toBeInstanceOf(NotPending);
      expect(await status()).toBe('APPROVED');
    });
  });

  describe('pending list (API-010)', () => {
    it('lists what waits for approval with who booked it and the room\'s approver, the nearest start first', async () => {
      await approverOfB(ra1);
      const roomC = await seedRoom(db, 'ห้อง C', ra1, { requiresApproval: true });
      const earlier = await seedBooking(db, {
        room: roomC, bookedBy: u1, title: 'ประชุมเช้า', startAt: at(17, '09:00'), endAt: at(17, '09:30'), status: 'PENDING_APPROVAL',
      });
      // Not waiting any more — never listed.
      await seedBooking(db, { room: roomC, bookedBy: u1, title: 'จบแล้ว', startAt: at(19, '09:00'), endAt: at(19, '10:00'), status: 'APPROVED' });

      const page = await service.listPending({ userId: ra1 }, 1);

      expect(page).toEqual({
        items: [
          {
            id: earlier, roomId: roomC.roomId, roomName: 'ห้อง C', startAt: at(17, '09:00').toISOString(), endAt: at(17, '09:30').toISOString(),
            title: 'ประชุมเช้า', bookedBy: { id: u1, fullName: 'U1' }, approver: null, canDecide: true,
          },
          {
            id: booking, roomId: roomB.roomId, roomName: 'ห้อง B', startAt: at(18, '10:00').toISOString(), endAt: at(18, '11:00').toISOString(),
            title: 'ประชุมลูกค้า', bookedBy: { id: u1, fullName: 'U1' }, approver: { id: ra1, fullName: 'RA1' }, canDecide: true,
          },
        ],
        page: 1,
        pageSize: 20,
        total: 2,
      });
    });

    it('a room with another approver is listed but marked as not mine to decide (UI-mrr-009 unauthorized)', async () => {
      await approverOfB(ra1);
      const ra2 = await seedUser(db, 'RA2', 'ROOM_ADMINISTRATOR');

      const page = await service.listPending({ userId: ra2 }, 1);

      expect(page.items.map((i) => [i.title, i.canDecide])).toEqual([['ประชุมลูกค้า', false]]);
    });

    it('keeps listing a pending booking whose start has passed — it is still approvable (BR-mrr-016)', async () => {
      now = at(18, '10:03');

      expect((await service.listPending({ userId: ra1 }, 1)).items.map((i) => i.id)).toEqual([booking]);
    });

    it('overflow — 20 to a page', async () => {
      for (let h = 0; h < 20; h++) {
        await seedBooking(db, {
          room: roomB, bookedBy: u1, title: `คิว ${h}`, startAt: at(20, `${String(h).padStart(2, '0')}:00`),
          endAt: at(20, `${String(h).padStart(2, '0')}:30`), status: 'PENDING_APPROVAL',
        });
      }

      const first = await service.listPending({ userId: ra1 }, 1);
      const second = await service.listPending({ userId: ra1 }, 2);

      expect([first.items.length, first.total, second.items.length]).toEqual([20, 21, 1]);
      expect(first.items[0].title).toBe('ประชุมลูกค้า');
      expect(second.items[0].title).toBe('คิว 19');
    });

    it('only a Room Administrator may see it — คุณไม่มีสิทธิ์เข้าหน้านี้', async () => {
      await expect(service.listPending({ userId: u1 }, 1)).rejects.toThrow(new NotRoomAdministrator('คุณไม่มีสิทธิ์เข้าหน้านี้'));
    });
  });

  it('a System Administrator is not a Room Administrator here (ACL-008 is ROLE-002 only)', async () => {
    const sa = await seedUser(db, 'SA', 'SYSTEM_ADMINISTRATOR');

    await expect(service.approve({ userId: sa }, booking)).rejects.toThrow(NotRoomAdministrator);
    expect(await status()).toBe('PENDING_APPROVAL');
  });
});
