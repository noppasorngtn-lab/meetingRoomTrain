import { Kysely } from 'kysely';
import { Clock } from '../../src/common/clock';
import { Database } from '../../src/common/database/schema';
import {
  BookingInvalid, BookingRoomNotFound, BookingService, CreateBookingInput, RoomUnderMaintenance, SlotTaken,
} from '../../src/modules/booking/booking.service';
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

type Room = { roomId: string; versionId: string };

/** What a Room Administrator's edit leaves behind: a new version the room now points at (DQ-mrr-002). */
async function editRoom(db: Kysely<Database>, room: Room, by: string, change: { requiresApproval?: boolean; capacity?: number }) {
  const cur = await db.selectFrom('meeting_room_versions').selectAll().where('id', '=', room.versionId).executeTakeFirstOrThrow();
  const { id } = await db
    .insertInto('meeting_room_versions')
    .values({
      room_id: room.roomId, version_no: cur.version_no + 1, name: cur.name,
      capacity: change.capacity ?? cur.capacity, requires_approval: change.requiresApproval ?? cur.requires_approval,
      approver_id: null, created_by: by,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await db.updateTable('meeting_rooms').set({ current_version_id: id }).where('id', '=', room.roomId).execute();
}

describe('FE-mrr-024 BookingService.create (UC-mrr-003)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let mail: FakeTransport;
  let now: Date;
  let service: BookingService;
  let u: string[]; // U1..U9
  let admin: string;
  let roomA: Room;
  let roomB: Room;

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
  });

  afterAll(async () => {
    await stop();
  });

  beforeEach(async () => {
    await truncateAll(db);
    u = [];
    for (let i = 1; i <= 9; i++) u.push(await seedUser(db, `U${i}`));
    admin = await seedUser(db, 'Admin', 'ROOM_ADMINISTRATOR');
    roomA = await seedRoom(db, 'ห้อง A', admin);
    roomB = await seedRoom(db, 'ห้อง B', admin, { requiresApproval: true });
    mail = new FakeTransport();
    now = at(16, '11:00');
    const clock: Clock = { now: () => now };
    service = new BookingService(db, clock, new BookingNotifier(mail));
  });

  const [U1, U2, U3] = [0, 1, 2].map((i) => () => u[i]);

  const book = (by: string, over: Partial<CreateBookingInput> & { room?: Room }) =>
    service.create({ userId: by }, {
      roomId: (over.room ?? roomA).roomId,
      startAt: over.startAt ?? at(18, '13:00'),
      endAt: over.endAt ?? at(18, '14:00'),
      title: over.title ?? 'ประชุมทีม',
      attendeeIds: over.attendeeIds ?? [U2(), U3()],
      equipmentIds: over.equipmentIds ?? [],
    });

  const statusOf = async (id: string) =>
    (await db.selectFrom('bookings').select('status').where('id', '=', id).executeTakeFirstOrThrow()).status;

  const countBookings = async () => Number((await db.selectFrom('bookings').select((eb) => eb.fn.countAll().as('n')).executeTakeFirstOrThrow()).n);

  describe('BR-mrr-001 · no overlap, half-open [start, end)', () => {
    it('AC-mrr-001 accepts 10:00–11:00 right after a 09:00–10:00 booking', async () => {
      await seedBooking(db, { room: roomA, bookedBy: U2(), title: 'ก่อนหน้า', startAt: at(17, '09:00'), endAt: at(17, '10:00') });

      const res = await book(U1(), { startAt: at(17, '10:00'), endAt: at(17, '11:00') });

      expect(res).toMatchObject({ status: 'CONFIRMED', message: 'จองห้องสำเร็จ' });
    });

    it('AC-mrr-002 rejects 09:59–11:00 over a 09:00–10:00 booking', async () => {
      await seedBooking(db, { room: roomA, bookedBy: U2(), title: 'ก่อนหน้า', startAt: at(17, '09:00'), endAt: at(17, '10:00') });

      const attempt = book(U1(), { startAt: at(17, '09:59'), endAt: at(17, '11:00') });

      await expect(attempt).rejects.toThrow(SlotTaken);
      await expect(attempt).rejects.toThrow('ห้องนี้ไม่ว่างในช่วงเวลาที่เลือก กรุณาเลือกเวลาอื่น');
      expect(await countBookings()).toBe(1);
    });

    it('AC-mrr-003 a booking still waiting for approval holds its time', async () => {
      await seedBooking(db, { room: roomB, bookedBy: U1(), title: 'รอ', startAt: at(17, '09:00'), endAt: at(17, '10:00'), status: 'PENDING_APPROVAL' });

      await expect(book(U2(), { room: roomB, startAt: at(17, '09:30'), endAt: at(17, '10:30') }))
        .rejects.toThrow('ห้องนี้ไม่ว่างในช่วงเวลาที่เลือก กรุณาเลือกเวลาอื่น');
    });

    it('AC-mrr-004 a cancelled booking does not hold its time', async () => {
      await seedBooking(db, { room: roomA, bookedBy: U1(), title: 'ยกเลิก', startAt: at(17, '09:00'), endAt: at(17, '10:00'), status: 'CANCELLED' });

      const res = await book(U2(), { startAt: at(17, '09:00'), endAt: at(17, '10:00') });

      expect(res).toMatchObject({ status: 'CONFIRMED', message: 'จองห้องสำเร็จ' });
    });

    it('two confirms racing for the same slot — exactly one wins', async () => {
      const results = await Promise.allSettled([
        book(U1(), { startAt: at(17, '13:00'), endAt: at(17, '14:00') }),
        book(U2(), { startAt: at(17, '13:30'), endAt: at(17, '14:30') }),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(lost.reason).toBeInstanceOf(SlotTaken);
    });
  });

  describe('BR-mrr-002 · title and attendees are required, equipment is not', () => {
    it('AC-mrr-005 accepts a booking with no equipment', async () => {
      const res = await book(U1(), { title: 'ประชุมทีม', attendeeIds: [U2(), U3(), u[3]], equipmentIds: [] });

      expect(res).toMatchObject({ status: 'CONFIRMED', message: 'จองห้องสำเร็จ' });
    });

    it('stores the equipment requested', async () => {
      const { id: projector } = await db.insertInto('facilities').values({ name: 'โปรเจคเตอร์' }).returning('id').executeTakeFirstOrThrow();

      const res = await book(U1(), { equipmentIds: [projector] });

      const rows = await db.selectFrom('booking_equipment_requests').selectAll().where('booking_id', '=', res.id).execute();
      expect(rows.map((r) => r.facility_id)).toEqual([projector]);
    });

    it('AC-mrr-006 rejects an empty title', async () => {
      const attempt = book(U1(), { title: '  ', attendeeIds: [U2(), U3(), u[3]] });

      await expect(attempt).rejects.toThrow(BookingInvalid);
      await expect(attempt).rejects.toThrow('กรุณาระบุหัวข้อการประชุม');
      expect(await countBookings()).toBe(0);
    });

    it('AC-mrr-007 rejects a booking with no attendees — the booker is not counted', async () => {
      await expect(book(U1(), { attendeeIds: [] })).rejects.toThrow('กรุณาระบุผู้เข้าร่วมอย่างน้อย 1 คน');
    });

    it('rejects a title over 200 characters', async () => {
      await expect(book(U1(), { title: 'ก'.repeat(201) })).rejects.toThrow(BookingInvalid);
    });

    it('rejects an attendee who is not an active user', async () => {
      await db.updateTable('users').set({ active: false }).where('id', '=', U3()).execute();

      await expect(book(U1(), { attendeeIds: [U2(), U3()] })).rejects.toThrow(BookingInvalid);
    });

    it('rejects an end that is not after the start, and a start already past', async () => {
      await expect(book(U1(), { startAt: at(18, '14:00'), endAt: at(18, '14:00') })).rejects.toThrow('เวลาสิ้นสุดต้องหลังเวลาเริ่ม');
      await expect(book(U1(), { startAt: at(16, '10:00'), endAt: at(16, '12:00') })).rejects.toThrow('เวลาเริ่มต้องเป็นเวลาในอนาคต');
    });
  });

  describe('BR-mrr-004 · rooms that need approval', () => {
    it('AC-mrr-012 saves as waiting for approval, and sends no mail', async () => {
      now = at(16, '11:00');

      const res = await book(U1(), { room: roomB, title: 'ประชุมลูกค้า', startAt: at(17, '10:00'), endAt: at(17, '11:00'), attendeeIds: [U2(), U3()] });

      expect(res).toMatchObject({ status: 'PENDING_APPROVAL', message: 'ส่งคำขอจองแล้ว รอการอนุมัติ' });
      expect(await statusOf(res.id)).toBe('PENDING_APPROVAL');
      expect(mail.sent).toEqual([]);
    });

    it('a pending booking made 10 minutes before it starts gets no reminder (BR-mrr-008)', async () => {
      now = at(17, '09:50');

      await book(U1(), { room: roomB, startAt: at(17, '10:00'), endAt: at(17, '11:00') });

      expect(mail.sent).toEqual([]);
    });
  });

  describe('BR-mrr-007 · BR-mrr-008 · the mail that goes with a booking', () => {
    it('AC-mrr-019 the booker alone gets the success mail', async () => {
      await book(U1(), { title: 'ประชุมทีม', startAt: at(17, '10:00'), endAt: at(17, '11:00'), attendeeIds: [U2(), U3()] });

      expect(mail.sent).toEqual([
        {
          to: ['u1@example.test'],
          subject: '[จองห้องประชุม] จองสำเร็จ: ประชุมทีม · ห้อง A 17/10 10:00–11:00',
          text: '[จองห้องประชุม] จองสำเร็จ: ประชุมทีม · ห้อง A 17/10 10:00–11:00',
        },
      ]);
    });

    it('AC-mrr-024 booked at 09:50 for 10:00 — success mail, then the reminder at once', async () => {
      now = at(17, '09:50');

      const res = await book(U1(), { title: 'ประชุมด่วน', startAt: at(17, '10:00'), endAt: at(17, '11:00'), attendeeIds: [U2()] });

      expect(mail.sent.map((m) => [m.to, m.subject])).toEqual([
        [['u1@example.test'], '[จองห้องประชุม] จองสำเร็จ: ประชุมด่วน · ห้อง A 17/10 10:00–11:00'],
        [['u1@example.test', 'u2@example.test'], '[จองห้องประชุม] ใกล้ถึงเวลาประชุม: ประชุมด่วน · ห้อง A 17/10 10:00–11:00'],
      ]);
      const row = await db.selectFrom('bookings').select(['reminder_status', 'reminder_at']).where('id', '=', res.id).executeTakeFirstOrThrow();
      expect(row).toEqual({ reminder_status: 'SENT', reminder_at: now });
    });
  });

  describe('BR-mrr-010 · a room edit applies to bookings created after it', () => {
    it('AC-mrr-030 a booking made after the room became needs-approval waits for approval', async () => {
      now = at(16, '10:00');
      await editRoom(db, roomA, admin, { requiresApproval: true });
      now = at(16, '11:00');

      const res = await book(U2(), { title: 'ประชุมทีม', startAt: at(18, '13:00'), endAt: at(18, '14:00'), attendeeIds: [U1(), U3()] });

      expect(res).toMatchObject({ status: 'PENDING_APPROVAL', message: 'ส่งคำขอจองแล้ว รอการอนุมัติ' });
    });

    it('AC-mrr-031 the room is read when confirm is pressed, not when the form was opened', async () => {
      now = at(16, '09:58'); // the form is opened — nothing is read for it
      const form = { title: 'ประชุมย่อย', startAt: at(18, '15:00'), endAt: at(18, '16:00'), attendeeIds: [U1()] };
      now = at(16, '10:00');
      await editRoom(db, roomA, admin, { requiresApproval: true });
      now = at(16, '10:01');

      const res = await book(U2(), form);

      expect(res).toMatchObject({ status: 'PENDING_APPROVAL', message: 'ส่งคำขอจองแล้ว รอการอนุมัติ' });
      const row = await db.selectFrom('bookings').select(['room_version_id', 'created_at']).where('id', '=', res.id).executeTakeFirstOrThrow();
      const current = await db.selectFrom('meeting_rooms').select('current_version_id').where('id', '=', roomA.roomId).executeTakeFirstOrThrow();
      expect(row).toEqual({ room_version_id: current.current_version_id, created_at: at(16, '10:01') });
    });

    it('AC-mrr-032 capacity does not limit attendees — before or after the edit', async () => {
      const room = await seedRoom(db, 'ห้อง C', admin, { capacity: 10 });
      now = at(16, '09:00');
      const before = await book(U1(), { room, startAt: at(18, '10:00'), endAt: at(18, '11:00'), attendeeIds: u.slice(1, 9) });
      now = at(16, '10:00');
      await editRoom(db, room, admin, { capacity: 4 });
      now = at(16, '11:00');

      const res = await book(U2(), { room, title: 'ประชุมใหญ่', startAt: at(18, '13:00'), endAt: at(18, '14:00'), attendeeIds: u.slice(2, 8) });

      expect(res).toMatchObject({ status: 'CONFIRMED', message: 'จองห้องสำเร็จ' });
      expect(await statusOf(before.id)).toBe('CONFIRMED');
    });
  });

  describe('BR-mrr-019 · the mail failing fails the booking', () => {
    it('AC-mrr-060 nothing is saved, and the slot is still free afterwards', async () => {
      mail.down = true;

      const attempt = book(U1(), { title: 'ประชุมทีม', startAt: at(17, '13:00'), endAt: at(17, '14:00'), attendeeIds: [U2()] });

      await expect(attempt).rejects.toThrow(EmailDeliveryFailed);
      await expect(attempt).rejects.toThrow('ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง');
      expect(await countBookings()).toBe(0);
      expect(await db.selectFrom('booking_attendees').selectAll().execute()).toEqual([]);

      mail.down = false;
      await expect(book(U3(), { startAt: at(17, '13:00'), endAt: at(17, '14:00') })).resolves.toMatchObject({ status: 'CONFIRMED' });
    });
  });

  describe('BR-mrr-012 · a room under maintenance takes no booking', () => {
    it('AC-mrr-079 rejects the booking', async () => {
      await db.updateTable('meeting_rooms').set({ status: 'UNDER_MAINTENANCE' }).where('id', '=', roomA.roomId).execute();

      const attempt = book(U2(), { title: 'ประชุมทีม', startAt: at(18, '13:00'), endAt: at(18, '14:00') });

      await expect(attempt).rejects.toThrow(RoomUnderMaintenance);
      await expect(attempt).rejects.toThrow('ห้องนี้ปิดปรับปรุง ไม่สามารถจองได้');
      expect(await countBookings()).toBe(0);
    });

    it('AC-mrr-081 once reopened, the room takes a booking at once', async () => {
      await db.updateTable('meeting_rooms').set({ status: 'UNDER_MAINTENANCE' }).where('id', '=', roomA.roomId).execute();
      await db.updateTable('meeting_rooms').set({ status: 'ACTIVE' }).where('id', '=', roomA.roomId).execute();

      const res = await book(U2(), { title: 'ประชุมทีม', startAt: at(18, '13:00'), endAt: at(18, '14:00') });

      expect(res).toMatchObject({ status: 'CONFIRMED', message: 'จองห้องสำเร็จ' });
    });

    it('an archived room is not found', async () => {
      await db.updateTable('meeting_rooms').set({ status: 'ARCHIVED' }).where('id', '=', roomA.roomId).execute();

      await expect(book(U1(), {})).rejects.toThrow(BookingRoomNotFound);
    });
  });

  it('records the caller as booker and the picked users as attendees', async () => {
    const res = await book(U1(), { attendeeIds: [U2(), U3(), U2()] });

    const row = await db.selectFrom('bookings').select(['booked_by', 'room_version_id']).where('id', '=', res.id).executeTakeFirstOrThrow();
    const people = await db.selectFrom('booking_attendees').select('user_id').where('booking_id', '=', res.id).execute();
    expect(row).toEqual({ booked_by: U1(), room_version_id: roomA.versionId });
    expect(people.map((p) => p.user_id).sort()).toEqual([U2(), U3()].sort());
  });
});
