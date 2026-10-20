import { Kysely } from 'kysely';
import { Clock } from '../../src/common/clock';
import { Database } from '../../src/common/database/schema';
import {
  BookingEditService, BookingLocked, BookingNotFound, EditBookingInput, NotTheBooker,
} from '../../src/modules/booking/booking-edit.service';
import { BookingInvalid, RoomUnderMaintenance, SlotTaken } from '../../src/modules/booking/booking.service';
import { BookingNotifier, EmailDeliveryFailed } from '../../src/modules/notification/booking-notifier';
import { MailMessage, MailTransport } from '../../src/modules/notification/mail-transport';
import { seedBooking, seedRoom, seedUser, startDatabase, truncateAll } from '../support/postgres';

jest.setTimeout(120_000);

/** 2026-10-<day>T<hh:mm> in Bangkok — the examples' "17/10 10:00". */
const at = (day: number, hhmm: string) => new Date(`2026-10-${day}T${hhmm}:00+07:00`);

class FakeTransport implements MailTransport {
  sent: MailMessage[] = [];
  down = false;
  async send(message: MailMessage): Promise<void> {
    if (this.down) throw new Error('ECONNREFUSED');
    this.sent.push(message);
  }
}

describe('FE-mrr-025 BookingEditService (UC-mrr-004)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let mail: FakeTransport;
  let now: Date;
  let service: BookingEditService;
  let u1: string;
  let u2: string;
  let u3: string;
  let admin: string;
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
    u3 = await seedUser(db, 'U3');
    admin = await seedUser(db, 'Admin', 'ROOM_ADMINISTRATOR');
    roomA = await seedRoom(db, 'ห้อง A', admin);
    // U1's booking: ห้อง A 17/10 10:00–11:00 'ประชุมทีม', attendees U2 and U3.
    booking = await seedBooking(db, {
      room: roomA, bookedBy: u1, title: 'ประชุมทีม', startAt: at(17, '10:00'), endAt: at(17, '11:00'), attendees: [u2, u3],
    });
    mail = new FakeTransport();
    now = at(16, '15:00');
    const clock: Clock = { now: () => now };
    service = new BookingEditService(db, clock, new BookingNotifier(mail));
  });

  const edit = (input: EditBookingInput, by = u1, id = booking) => service.edit({ userId: by }, id, input);

  const row = () =>
    db.selectFrom('bookings').select(['title', 'start_at', 'end_at', 'status']).where('id', '=', booking).executeTakeFirstOrThrow();

  describe('BR-mrr-003 · the booker edits before the start', () => {
    it('AC-mrr-008 saves a new title and answers บันทึกการแก้ไขสำเร็จ', async () => {
      const res = await edit({ title: 'ประชุมวางแผน' });

      expect(res).toEqual({ message: 'บันทึกการแก้ไขสำเร็จ' });
      expect((await row()).title).toBe('ประชุมวางแผน');
    });

    it('refuses someone who is not the booker, even with the id in hand', async () => {
      await expect(edit({ title: 'แอบแก้' }, u2)).rejects.toThrow(NotTheBooker);
      expect((await row()).title).toBe('ประชุมทีม');
    });

    it('refuses once the meeting has started — a Room Administrator does it instead', async () => {
      now = at(17, '10:00');

      await expect(edit({ title: 'สายไป' })).rejects.toThrow(BookingLocked);
      await expect(edit({ title: 'สายไป' })).rejects.toThrow('ถึงเวลาเริ่มประชุมแล้ว แก้ไขไม่ได้ กรุณาติดต่อ Room Administrator');
    });

    it('refuses a cancelled booking', async () => {
      await db.updateTable('bookings').set({ status: 'CANCELLED' }).where('id', '=', booking).execute();

      await expect(edit({ title: 'ฟื้น' })).rejects.toThrow(BookingLocked);
    });

    it('a booking that does not exist is not found', async () => {
      await expect(edit({ title: 'x' }, u1, '00000000-0000-4000-8000-000000000000')).rejects.toThrow(BookingNotFound);
    });

    it('keeps the BR-mrr-002 checks — no empty title, no empty attendee list', async () => {
      await expect(edit({ title: ' ' })).rejects.toThrow('กรุณาระบุหัวข้อการประชุม');
      await expect(edit({ attendeeIds: [] })).rejects.toThrow('กรุณาระบุผู้เข้าร่วมอย่างน้อย 1 คน');
    });

    it('replaces the attendees and the equipment', async () => {
      const { id: mic } = await db.insertInto('facilities').values({ name: 'ไมโครโฟน' }).returning('id').executeTakeFirstOrThrow();

      await edit({ attendeeIds: [u3], equipmentIds: [mic] });

      const detail = await service.get({ userId: u1 }, booking);
      expect(detail.attendees.map((a) => a.fullName)).toEqual(['U3']);
      expect(detail.equipment).toEqual([{ id: mic, name: 'ไมโครโฟน' }]);
    });
  });

  describe('BR-mrr-007 · BR-mrr-019 · the mail that goes with an edit', () => {
    it('AC-mrr-021 a new time mails the booker and every attendee', async () => {
      await edit({ startAt: at(17, '14:00'), endAt: at(17, '15:00') });

      expect(mail.sent).toEqual([{
        to: ['u1@example.test', 'u2@example.test', 'u3@example.test'],
        subject: '[จองห้องประชุม] เปลี่ยนเวลา: ประชุมทีม · ห้อง A 17/10 14:00–15:00',
        text: '[จองห้องประชุม] เปลี่ยนเวลา: ประชุมทีม · ห้อง A 17/10 14:00–15:00',
      }]);
      expect(await row()).toMatchObject({ start_at: at(17, '14:00'), end_at: at(17, '15:00') });
    });

    it('AC-mrr-022 a new title alone saves and mails nobody', async () => {
      const res = await edit({ title: 'ประชุมวางแผน' });

      expect(res.message).toBe('บันทึกการแก้ไขสำเร็จ');
      expect(mail.sent).toEqual([]);
    });

    it('AC-mrr-061 the mail failing keeps the old time', async () => {
      mail.down = true;

      const attempt = edit({ startAt: at(17, '14:00'), endAt: at(17, '15:00') });

      await expect(attempt).rejects.toThrow(EmailDeliveryFailed);
      await expect(attempt).rejects.toThrow('ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง');
      expect(await row()).toMatchObject({ start_at: at(17, '10:00'), end_at: at(17, '11:00') });
    });

    it('AC-mrr-063 a title edit needs no mail, so a mail failure does not stop it', async () => {
      mail.down = true;

      const res = await edit({ title: 'ประชุมวางแผน' });

      expect(res.message).toBe('บันทึกการแก้ไขสำเร็จ');
      expect((await row()).title).toBe('ประชุมวางแผน');
    });
  });

  describe('a new time counts as a new booking', () => {
    it('AC-mrr-080 a room under maintenance refuses the new time, and the old booking stays', async () => {
      await db.updateTable('meeting_rooms').set({ status: 'UNDER_MAINTENANCE' }).where('id', '=', roomA.roomId).execute();

      const attempt = edit({ startAt: at(17, '14:00'), endAt: at(17, '15:00') });

      await expect(attempt).rejects.toThrow(RoomUnderMaintenance);
      await expect(attempt).rejects.toThrow('ห้องนี้ปิดปรับปรุง ไม่สามารถจองได้');
      expect(await row()).toMatchObject({ start_at: at(17, '10:00'), end_at: at(17, '11:00'), status: 'CONFIRMED' });
    });

    it('a new time that overlaps another booking is refused (BR-mrr-001)', async () => {
      await seedBooking(db, { room: roomA, bookedBy: u2, title: 'บ่าย', startAt: at(17, '14:00'), endAt: at(17, '15:00') });

      await expect(edit({ startAt: at(17, '14:30'), endAt: at(17, '15:30') }))
        .rejects.toThrow('ห้องนี้ไม่ว่างในช่วงเวลาที่เลือก กรุณาเลือกเวลาอื่น');
      expect(mail.sent).toEqual([]);
    });

    it('moving within its own slot does not collide with itself', async () => {
      await expect(edit({ startAt: at(17, '10:30'), endAt: at(17, '11:30') })).resolves.toEqual({ message: 'บันทึกการแก้ไขสำเร็จ' });
    });

    it('a new time already past, or ending before it starts, is refused', async () => {
      await expect(edit({ startAt: at(16, '09:00'), endAt: at(16, '10:00') })).rejects.toThrow(BookingInvalid);
      await expect(edit({ startAt: at(17, '15:00'), endAt: at(17, '14:00') })).rejects.toThrow('เวลาสิ้นสุดต้องหลังเวลาเริ่ม');
    });

    it('a title edit is still allowed while the room is under maintenance', async () => {
      await db.updateTable('meeting_rooms').set({ status: 'UNDER_MAINTENANCE' }).where('id', '=', roomA.roomId).execute();

      await expect(edit({ title: 'ประชุมวางแผน' })).resolves.toEqual({ message: 'บันทึกการแก้ไขสำเร็จ' });
    });
  });

  describe('API-007 · reading one booking', () => {
    it('the booker sees the booking with its room, attendees and equipment', async () => {
      const detail = await service.get({ userId: u1 }, booking);

      expect(detail).toEqual({
        id: booking, roomId: roomA.roomId, roomName: 'ห้อง A',
        startAt: at(17, '10:00').toISOString(), endAt: at(17, '11:00').toISOString(),
        title: 'ประชุมทีม', status: 'CONFIRMED',
        bookedBy: { id: u1, fullName: 'U1' },
        attendees: [{ id: u2, fullName: 'U2' }, { id: u3, fullName: 'U3' }],
        equipment: [],
      });
    });

    it('a Room Administrator sees any booking', async () => {
      await expect(service.get({ userId: admin }, booking)).resolves.toMatchObject({ id: booking });
    });

    it('someone else — even an attendee — gets not found', async () => {
      await expect(service.get({ userId: u2 }, booking)).rejects.toThrow(BookingNotFound);
    });
  });
});
