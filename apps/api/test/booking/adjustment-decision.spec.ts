import { Kysely } from 'kysely';
import { Clock } from '../../src/common/clock';
import { Database } from '../../src/common/database/schema';
import {
  AdjustmentNotPending, AdjustmentRequestNotFound, AdjustmentRequestService, OwnAdjustmentRequest,
} from '../../src/modules/booking/adjustment-request.service';
import { SlotTaken } from '../../src/modules/booking/booking.service';
import { NotRoomAdministrator } from '../../src/modules/booking/room-admin';
import { seedBooking, seedRoom, seedUser, startDatabase, truncateAll } from '../support/postgres';

jest.setTimeout(120_000);

/** 2026-10-<day>T<hh:mm> in Bangkok — the examples' "18/10 10:00". */
const at = (day: number, hhmm: string) => new Date(`2026-10-${day}T${hhmm}:00+07:00`);

describe('FE-mrr-032 another Room Administrator decides an adjustment request (UC-mrr-011)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let now: Date;
  let service: AdjustmentRequestService;
  let u1: string;
  let ra1: string;
  let ra2: string;
  let roomA: { roomId: string; versionId: string };
  let booking: string;
  let request: string;

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
    ra2 = await seedUser(db, 'RA2', 'ROOM_ADMINISTRATOR');
    roomA = await seedRoom(db, 'ห้อง A', ra1);
    // ห้อง A 18/10 10:00–11:00 'ประชุมทีม' of U1, ended · RA1 asked for 'ประชุมวางแผน'.
    booking = await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ประชุมทีม', startAt: at(18, '10:00'), endAt: at(18, '11:00') });
    request = await seedRequest({ title: 'ประชุมวางแผน' });
    now = at(18, '13:00');
    const clock: Clock = { now: () => now };
    service = new AdjustmentRequestService(db, clock);
  });

  const seedRequest = async (proposed: Record<string, unknown>, by = () => ra1, createdAt = at(18, '11:00')) =>
    (
      await db
        .insertInto('booking_adjustment_requests')
        .values({ booking_id: booking, requested_by: by(), proposed_changes: JSON.stringify(proposed), reason: 'ผู้จองพิมพ์หัวข้อผิด', created_at: createdAt })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  const title = async () => (await db.selectFrom('bookings').select('title').where('id', '=', booking).executeTakeFirstOrThrow()).title;
  const trail = () =>
    db.selectFrom('booking_audit_entries').select(['actor_id', 'action', 'reason', 'detail', 'at']).where('booking_id', '=', booking).execute();
  const state = () =>
    db.selectFrom('booking_adjustment_requests').select(['status', 'decided_by', 'decided_at']).where('id', '=', request).executeTakeFirstOrThrow();

  it('AC-mrr-043 RA2 approves — the title becomes ประชุมวางแผน and RA2 is told อนุมัติคำขอแก้ไขสำเร็จ', async () => {
    const res = await service.approve({ userId: ra2 }, request);

    expect(res).toEqual({ message: 'อนุมัติคำขอแก้ไขสำเร็จ' });
    expect(await title()).toBe('ประชุมวางแผน');
    expect(await state()).toEqual({ status: 'APPROVED', decided_by: ra2, decided_at: at(18, '13:00') });
  });

  it('AC-mrr-044 RA1 approves their own request — refused in BR-mrr-014\'s words; ประชุมทีม and PENDING stay', async () => {
    await expect(service.approve({ userId: ra1 }, request)).rejects.toThrow(
      'ผู้แก้ไขอนุมัติคำขอของตัวเองไม่ได้ ต้องให้ผู้ดูแลห้องคนอื่นอนุมัติ',
    );

    expect(await title()).toBe('ประชุมทีม');
    expect(await state()).toEqual({ status: 'PENDING', decided_by: null, decided_at: null });
    expect(await trail()).toEqual([]);
  });

  it('BR-mrr-014 nor may RA1 reject their own request', async () => {
    await expect(service.reject({ userId: ra1 }, request)).rejects.toBeInstanceOf(OwnAdjustmentRequest);

    expect(await state()).toEqual({ status: 'PENDING', decided_by: null, decided_at: null });
  });

  it('UC-mrr-011 RA2 rejects — ปฏิเสธคำขอแก้ไขสำเร็จ, the booking keeps ประชุมทีม', async () => {
    const res = await service.reject({ userId: ra2 }, request);

    expect(res).toEqual({ message: 'ปฏิเสธคำขอแก้ไขสำเร็จ' });
    expect(await title()).toBe('ประชุมทีม');
    expect(await state()).toEqual({ status: 'REJECTED', decided_by: ra2, decided_at: at(18, '13:00') });
  });

  it('BR-mrr-017 each decision leaves its trail entry — who, what, when, and which request', async () => {
    await service.approve({ userId: ra2 }, request);

    expect(await trail()).toEqual([{
      actor_id: ra2, action: 'APPROVE_ADJUSTMENT', reason: null, at: at(18, '13:00'),
      detail: { requestId: request, proposedChanges: { title: 'ประชุมวางแผน' } },
    }]);
  });

  it('STM-mrr-002 a decided request is final — neither approved again nor rejected', async () => {
    await service.reject({ userId: ra2 }, request);
    const ra3 = await seedUser(db, 'RA3', 'ROOM_ADMINISTRATOR');

    await expect(service.approve({ userId: ra3 }, request)).rejects.toThrow(new AdjustmentNotPending());
    await expect(service.reject({ userId: ra3 }, request)).rejects.toBeInstanceOf(AdjustmentNotPending);
    expect(await title()).toBe('ประชุมทีม');
    expect((await state()).status).toBe('REJECTED');
  });

  it('ACL-012 a General User or a System Administrator decides nothing', async () => {
    const admin = await seedUser(db, 'SA', 'SYSTEM_ADMINISTRATOR');

    await expect(service.approve({ userId: u1 }, request)).rejects.toBeInstanceOf(NotRoomAdministrator);
    await expect(service.reject({ userId: admin }, request)).rejects.toBeInstanceOf(NotRoomAdministrator);
    expect((await state()).status).toBe('PENDING');
  });

  it('a request nobody made is not found', async () => {
    await expect(service.approve({ userId: ra2 }, '00000000-0000-0000-0000-000000000000')).rejects.toThrow(new AdjustmentRequestNotFound());
  });

  it('a later time, attendees and equipment take effect together on approval', async () => {
    const u2 = await seedUser(db, 'U2');
    const { id: mic } = await db.insertInto('facilities').values({ name: 'ไมโครโฟน' }).returning('id').executeTakeFirstOrThrow();
    request = await seedRequest({ endAt: at(18, '11:30').toISOString(), attendeeIds: [u2], equipmentIds: [mic] });

    await service.approve({ userId: ra2 }, request);

    const row = await db.selectFrom('bookings').select(['title', 'start_at', 'end_at']).where('id', '=', booking).executeTakeFirstOrThrow();
    expect(row).toEqual({ title: 'ประชุมทีม', start_at: at(18, '10:00'), end_at: at(18, '11:30') });
    expect(await db.selectFrom('booking_attendees').select('user_id').where('booking_id', '=', booking).execute()).toEqual([{ user_id: u2 }]);
    expect(await db.selectFrom('booking_equipment_requests').select('facility_id').where('booking_id', '=', booking).execute()).toEqual([
      { facility_id: mic },
    ]);
  });

  it('a new time that another booking now holds is refused — nothing changes and the request still waits', async () => {
    await seedBooking(db, { room: roomA, bookedBy: u1, title: 'ประชุมต่อ', startAt: at(18, '11:00'), endAt: at(18, '12:00') });
    request = await seedRequest({ endAt: at(18, '11:30').toISOString() });

    await expect(service.approve({ userId: ra2 }, request)).rejects.toBeInstanceOf(SlotTaken);
    expect((await state()).status).toBe('PENDING');
    expect(await trail()).toEqual([]);
  });

  describe('API-017 the pending list', () => {
    it('lists what waits, the longest waiting first, with the caller\'s own marked canDecide: false', async () => {
      const second = await seedRequest({ title: 'ประชุมใหญ่' }, () => ra2, at(18, '12:00'));
      await service.reject({ userId: ra2 }, request);
      const third = await seedRequest({ title: 'ประชุมเล็ก' }, () => ra1, at(18, '11:30'));

      const page = await service.listPending({ userId: ra2 }, 1);

      expect(page).toEqual({
        page: 1, pageSize: 20, total: 2,
        items: [
          {
            id: third,
            booking: { id: booking, roomName: 'ห้อง A', title: 'ประชุมทีม', startAt: at(18, '10:00').toISOString(), endAt: at(18, '11:00').toISOString() },
            requestedBy: { id: ra1, fullName: 'RA1' }, proposedChanges: { title: 'ประชุมเล็ก' }, reason: 'ผู้จองพิมพ์หัวข้อผิด',
            status: 'PENDING', createdAt: at(18, '11:30').toISOString(), canDecide: true,
          },
          expect.objectContaining({ id: second, requestedBy: { id: ra2, fullName: 'RA2' }, canDecide: false }),
        ],
      });
    });

    it('UI-mrr-011 overflow — 20 to a page', async () => {
      for (let i = 1; i <= 21; i++) await seedRequest({ title: `หัวข้อ ${i}` }, () => ra1, new Date(at(18, '11:00').getTime() + i * 60_000));

      const one = await service.listPending({ userId: ra2 }, 1);
      const two = await service.listPending({ userId: ra2 }, 2);

      expect([one.items.length, two.items.length, one.total]).toEqual([20, 2, 22]);
      expect(one.items[0].id).toBe(request);
      expect(two.items[1].proposedChanges).toEqual({ title: 'หัวข้อ 21' });
    });

    it('a General User is refused with คุณไม่มีสิทธิ์เข้าหน้านี้', async () => {
      await expect(service.listPending({ userId: u1 }, 1)).rejects.toThrow('คุณไม่มีสิทธิ์เข้าหน้านี้');
    });
  });
});
