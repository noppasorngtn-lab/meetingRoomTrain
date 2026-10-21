import { Kysely } from 'kysely';
import { Clock } from '../../src/common/clock';
import { Database } from '../../src/common/database/schema';
import { NotRoomAdministrator } from '../../src/modules/booking/room-admin';
import { BookingNotifier, EmailDeliveryFailed } from '../../src/modules/notification/booking-notifier';
import { MailMessage, MailTransport } from '../../src/modules/notification/mail-transport';
import { RoomAdminService, RoomInvalid } from '../../src/modules/rooms/room-admin.service';
import { RoomInfoNotFound } from '../../src/modules/rooms/rooms.service';
import { seedBooking, seedRoom, seedUser, startDatabase, truncateAll } from '../support/postgres';

jest.setTimeout(120_000);

/** 2026-10-<day>T<hh:mm> in Bangkok — the examples' "18/10 10:00". */
const at = (day: number, hhmm: string) => new Date(`2026-10-${day}T${hhmm}:00+07:00`);

const SAVED = 'บันทึกข้อมูลห้องสำเร็จ';
const REFUSAL = 'เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้';

class FakeTransport implements MailTransport {
  sent: MailMessage[] = [];
  down = false;
  async send(message: MailMessage): Promise<void> {
    if (this.down) throw new Error('ECONNREFUSED');
    this.sent.push(message);
  }
}

describe('FE-mrr-034 a Room Administrator adds or edits a room and its facilities (UC-mrr-013)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let mail: FakeTransport;
  let now: Date;
  let service: RoomAdminService;
  let u1: string;
  let u2: string;
  let ra1: string;
  let roomA: { roomId: string; versionId: string };

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
    roomA = await seedRoom(db, 'ห้อง A', ra1, { capacity: 8 });
    mail = new FakeTransport();
    now = at(16, '10:00');
    const clock: Clock = { now: () => now };
    service = new RoomAdminService(db, clock, new BookingNotifier(mail));
  });

  const current = (roomId = roomA.roomId) =>
    db
      .selectFrom('meeting_rooms as r')
      .innerJoin('meeting_room_versions as v', 'v.id', 'r.current_version_id')
      .select(['r.code', 'r.status', 'v.version_no', 'v.name', 'v.capacity', 'v.requires_approval', 'v.approver_id', 'v.photos', 'v.created_by'])
      .where('r.id', '=', roomId)
      .executeTakeFirstOrThrow();
  const statusOf = async (id: string) => (await db.selectFrom('bookings').select('status').where('id', '=', id).executeTakeFirstOrThrow()).status;
  /** ห้อง A as it is, with what is asked changed — a version carries every value. */
  const versionOf = (over: object = {}) => ({ name: 'ห้อง A', capacity: 8, photos: [], facilityIds: [], requiresApproval: false, approverId: null, ...over });
  const roomC = (over: object = {}) => ({ code: 'C', name: 'ห้อง C', capacity: 10, photos: [], facilityIds: [], requiresApproval: false, approverId: null, ...over });

  describe('API-021 add a room', () => {
    it('AC-mrr-015 ห้อง C, capacity 10: created with its first version, ACTIVE, บันทึกข้อมูลห้องสำเร็จ', async () => {
      const done = await service.create({ userId: ra1 }, roomC());

      expect(done).toEqual({ id: expect.any(String), message: SAVED });
      expect(await current(done.id)).toEqual({
        code: 'C', status: 'ACTIVE', version_no: 1, name: 'ห้อง C', capacity: 10, requires_approval: false, approver_id: null, photos: [], created_by: ra1,
      });
    });

    it('a code another room already has is refused at the code', async () => {
      await service.create({ userId: ra1 }, roomC());

      await expect(service.create({ userId: ra1 }, roomC({ name: 'ห้อง C2' }))).rejects.toMatchObject({ field: 'code', message: 'รหัสห้องนี้มีอยู่แล้ว' });
    });

    it.each([
      ['an empty code', { code: '  ' }, 'code', 'กรุณาระบุรหัสห้อง'],
      ['an empty name', { name: ' ' }, 'name', 'กรุณาระบุชื่อห้อง'],
      ['a name over 100 characters', { name: 'ก'.repeat(101) }, 'name', 'ชื่อห้องต้องไม่เกิน 100 ตัวอักษร'],
      ['a capacity of 0', { capacity: 0 }, 'capacity', 'ความจุต้องเป็นจำนวนเต็มตั้งแต่ 1'],
      ['a capacity that is not whole', { capacity: 1.5 }, 'capacity', 'ความจุต้องเป็นจำนวนเต็มตั้งแต่ 1'],
    ])('%s is refused at its field and nothing is saved', async (_, over, field, message) => {
      const press = service.create({ userId: ra1 }, roomC(over));

      await expect(press).rejects.toBeInstanceOf(RoomInvalid);
      await expect(press).rejects.toMatchObject({ field, message });
      expect(await db.selectFrom('meeting_rooms').select('id').execute()).toHaveLength(1);
    });

    it('an approver who is not a Room Administrator, or a facility that is not offered, is refused at its field', async () => {
      await expect(service.create({ userId: ra1 }, roomC({ approverId: u1 }))).rejects.toMatchObject({
        field: 'approverId', message: 'ผู้อนุมัติประจำห้องต้องเป็นผู้ดูแลห้อง',
      });
      const off = await db.insertInto('facilities').values({ name: 'กระดานเก่า', active: false }).returning('id').executeTakeFirstOrThrow();
      await expect(service.create({ userId: ra1 }, roomC({ facilityIds: [off.id] }))).rejects.toMatchObject({
        field: 'facilityIds', message: 'ไม่พบสิ่งอำนวยความสะดวกที่เลือก',
      });
    });
  });

  describe('API-023 save a new version of a room', () => {
    it('capacity 12, a projector and a photo: version 2 becomes current, version 1 is kept as it was', async () => {
      const projector = (await service.createFacility({ userId: ra1 }, { name: 'โปรเจคเตอร์' })).facility.id;

      const done = await service.saveVersion({ userId: ra1 }, roomA.roomId, versionOf({ capacity: 12, facilityIds: [projector], photos: ['file-1'] }));

      expect(done).toEqual({ message: SAVED });
      expect(await current()).toMatchObject({ version_no: 2, capacity: 12, photos: ['file-1'] });
      const v1 = await db.selectFrom('meeting_room_versions').select(['capacity']).where('id', '=', roomA.versionId).executeTakeFirstOrThrow();
      expect(v1.capacity).toBe(8);
      const facilities = await db
        .selectFrom('room_version_facilities as f')
        .innerJoin('meeting_room_versions as v', 'v.id', 'f.room_version_id')
        .select(['v.version_no', 'f.facility_id'])
        .where('v.room_id', '=', roomA.roomId)
        .execute();
      expect(facilities).toEqual([{ version_no: 2, facility_id: projector }]);
    });

    it('AC-mrr-040 ห้อง B needs approval and has no approver yet — RA1 is named later', async () => {
      const roomB = await seedRoom(db, 'ห้อง B', ra1, { requiresApproval: true });

      const done = await service.saveVersion({ userId: ra1 }, roomB.roomId, versionOf({ name: 'ห้อง B', requiresApproval: true, approverId: ra1 }));

      expect(done.message).toBe(SAVED);
      expect((await current(roomB.roomId)).approver_id).toBe(ra1);
    });

    it('AC-mrr-032 capacity cut to 4 leaves U1\'s booking of 8 as it was', async () => {
      const booking = await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:00'), attendees: [u2] });

      await service.saveVersion({ userId: ra1 }, roomA.roomId, versionOf({ capacity: 4 }));

      expect(await statusOf(booking)).toBe('CONFIRMED');
      expect(mail.sent).toEqual([]);
    });

    it('AC-mrr-076 ห้อง A now needs approval: U1\'s booking 18/10 10:00–11:00 goes back to PENDING_APPROVAL, and no mail', async () => {
      const booking = await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:00') });

      const done = await service.saveVersion({ userId: ra1 }, roomA.roomId, versionOf({ requiresApproval: true }));

      expect(done.message).toBe(SAVED);
      expect(await statusOf(booking)).toBe('PENDING_APPROVAL');
      expect(mail.sent).toEqual([]);
    });

    it('AC-mrr-078 at 10:00 sharp: the booking that starts at 10:00 has started and stays; the 11:00 one waits for approval', async () => {
      const morning = await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ประชุมเช้า', startAt: at(16, '10:00'), endAt: at(16, '11:00') });
      const late = await seedBooking(db, { room: roomA, bookedBy: u2, title: 'ประชุมสาย', startAt: at(16, '11:00'), endAt: at(16, '12:00') });

      await service.saveVersion({ userId: ra1 }, roomA.roomId, versionOf({ requiresApproval: true }));

      expect(await statusOf(morning)).toBe('CONFIRMED');
      expect(await statusOf(late)).toBe('PENDING_APPROVAL');
    });

    it('a booking already approved stays approved when the room starts to need approval', async () => {
      const approved = await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:00'), status: 'APPROVED' });

      await service.saveVersion({ userId: ra1 }, roomA.roomId, versionOf({ requiresApproval: true }));

      expect(await statusOf(approved)).toBe('APPROVED');
    });

    it('AC-mrr-077 ห้อง B no longer needs approval: U1\'s waiting booking is usable at once — CONFIRMED, not APPROVED — and U1 is mailed จองสำเร็จ', async () => {
      const roomB = await seedRoom(db, 'ห้อง B', ra1, { requiresApproval: true });
      const booking = await seedBooking(db, {
        room: roomB, bookedBy: u1, title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:00'), status: 'PENDING_APPROVAL', attendees: [u2],
      });

      const done = await service.saveVersion({ userId: ra1 }, roomB.roomId, versionOf({ name: 'ห้อง B', requiresApproval: false }));

      expect(done.message).toBe(SAVED);
      expect(await statusOf(booking)).toBe('CONFIRMED');
      expect(mail.sent).toEqual([
        { to: ['u1@example.test'], subject: '[จองห้องประชุม] จองสำเร็จ: ประชุมทีม · ห้อง B 18/10 10:00–11:00', text: '[จองห้องประชุม] จองสำเร็จ: ประชุมทีม · ห้อง B 18/10 10:00–11:00' },
      ]);
    });

    it('BR-mrr-019 the mail does not go — nothing is saved: still version 1, still waiting, and the message asks to press again', async () => {
      const roomB = await seedRoom(db, 'ห้อง B', ra1, { requiresApproval: true });
      const booking = await seedBooking(db, { room: roomB, bookedBy: u1, title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:00'), status: 'PENDING_APPROVAL' });
      mail.down = true;

      const press = service.saveVersion({ userId: ra1 }, roomB.roomId, versionOf({ name: 'ห้อง B', requiresApproval: false }));

      await expect(press).rejects.toBeInstanceOf(EmailDeliveryFailed);
      expect(await current(roomB.roomId)).toMatchObject({ version_no: 1, requires_approval: true });
      expect(await statusOf(booking)).toBe('PENDING_APPROVAL');
    });

    it('a room under maintenance can still be edited; an archived one is ไม่พบห้อง (ACL-014 condition)', async () => {
      await db.updateTable('meeting_rooms').set({ status: 'UNDER_MAINTENANCE' }).where('id', '=', roomA.roomId).execute();
      expect((await service.saveVersion({ userId: ra1 }, roomA.roomId, versionOf({ capacity: 9 }))).message).toBe(SAVED);

      await db.updateTable('meeting_rooms').set({ status: 'ARCHIVED' }).where('id', '=', roomA.roomId).execute();
      await expect(service.saveVersion({ userId: ra1 }, roomA.roomId, versionOf())).rejects.toBeInstanceOf(RoomInfoNotFound);
    });
  });

  it.each([
    ['AC-mrr-017 a General User', 'GENERAL_USER'],
    ['AC-mrr-018 a System Administrator', 'SYSTEM_ADMINISTRATOR'],
  ] as const)('%s cannot set ห้อง A to 12 — still 8, and เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้', async (_, role) => {
    const who = await seedUser(db, 'X', role);

    const press = service.saveVersion({ userId: who }, roomA.roomId, versionOf({ capacity: 12 }));

    await expect(press).rejects.toBeInstanceOf(NotRoomAdministrator);
    await expect(press).rejects.toThrow(REFUSAL);
    expect((await current()).capacity).toBe(8);
    await expect(service.create({ userId: who }, roomC())).rejects.toThrow(REFUSAL);
    await expect(service.list({ userId: who }, {})).rejects.toThrow(REFUSAL);
    await expect(service.createFacility({ userId: who }, { name: 'ไมค์' })).rejects.toThrow(REFUSAL);
  });

  describe('API-020 the rooms', () => {
    it('every room in use, by code, with its current values; archived ones only when asked for', async () => {
      const b = await seedRoom(db, 'ห้อง B', ra1, { requiresApproval: true });
      const old = await seedRoom(db, 'ห้อง เก่า', ra1);
      await db.updateTable('meeting_rooms').set({ status: 'ARCHIVED' }).where('id', '=', old.roomId).execute();
      await db.updateTable('meeting_rooms').set({ status: 'UNDER_MAINTENANCE' }).where('id', '=', b.roomId).execute();

      const page = await service.list({ userId: ra1 }, {});

      expect(page).toMatchObject({ page: 1, pageSize: 20, total: 2 });
      expect(page.items.map((r) => [r.code, r.name, r.capacity, r.status, r.requiresApproval])).toEqual([
        ['ห้อง-A', 'ห้อง A', 8, 'ACTIVE', false],
        ['ห้อง-B', 'ห้อง B', 10, 'UNDER_MAINTENANCE', true],
      ]);
      expect((await service.list({ userId: ra1 }, { status: 'ARCHIVED' })).items.map((r) => r.name)).toEqual(['ห้อง เก่า']);
      expect((await service.list({ userId: ra1 }, { status: 'UNDER_MAINTENANCE' })).items.map((r) => r.name)).toEqual(['ห้อง B']);
    });

    it('a search finds a room by part of its name or its code', async () => {
      await service.create({ userId: ra1 }, roomC({ code: 'R-301', name: 'ห้องประชุมใหญ่' }));

      expect((await service.list({ userId: ra1 }, { query: 'ใหญ่' })).items.map((r) => r.code)).toEqual(['R-301']);
      expect((await service.list({ userId: ra1 }, { query: 'r-3' })).items.map((r) => r.code)).toEqual(['R-301']);
    });

    it('UI-mrr-012 overflow — 20 to a page', async () => {
      for (let i = 1; i <= 20; i++) await seedRoom(db, `ห้อง ${String(i).padStart(2, '0')}`, ra1);

      const second = await service.list({ userId: ra1 }, { page: 2 });

      expect(second).toMatchObject({ page: 2, total: 21 });
      expect(second.items.map((r) => r.name)).toEqual(['ห้อง A']);
    });
  });

  describe('API-026 · API-027 facilities', () => {
    it('adds โปรเจคเตอร์, renames it, takes it out of use, and refuses a name another one has', async () => {
      const { facility } = await service.createFacility({ userId: ra1 }, { name: 'โปรเจคเตอร์' });
      expect(facility).toEqual({ id: expect.any(String), name: 'โปรเจคเตอร์', active: true });

      expect((await service.updateFacility({ userId: ra1 }, facility.id, { name: 'โปรเจคเตอร์ 4K' })).facility.name).toBe('โปรเจคเตอร์ 4K');
      expect((await service.updateFacility({ userId: ra1 }, facility.id, { active: false })).facility).toEqual({ id: facility.id, name: 'โปรเจคเตอร์ 4K', active: false });

      await service.createFacility({ userId: ra1 }, { name: 'ไมค์' });
      await expect(service.updateFacility({ userId: ra1 }, facility.id, { name: 'ไมค์' })).rejects.toMatchObject({ field: 'name', message: 'มีสิ่งอำนวยความสะดวกชื่อนี้แล้ว' });
      await expect(service.createFacility({ userId: ra1 }, { name: ' ' })).rejects.toMatchObject({ field: 'name', message: 'กรุณาระบุชื่อสิ่งอำนวยความสะดวก' });
    });
  });
});
