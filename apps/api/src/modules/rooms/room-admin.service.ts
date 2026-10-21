import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { Caller } from '../../common/auth/current-user';
import { CLOCK, Clock } from '../../common/clock';
import { KYSELY } from '../../common/database/database.module';
import { Database } from '../../common/database/schema';
import { assertRoomAdministrator } from '../booking/room-admin';
import { BookingNotifier } from '../notification/booking-notifier';
import { RoomInfoNotFound } from './rooms.service';

type RoomStatus = Database['meeting_rooms']['status'];

/** A value the form must fix, named by its field. */
export class RoomInvalid extends Error {
  constructor(readonly field: string, message: string) {
    super(message);
    this.name = 'RoomInvalid';
  }
}

/** No such facility. */
export class FacilityNotFound extends Error {
  constructor() {
    super('ไม่พบสิ่งอำนวยความสะดวก');
    this.name = 'FacilityNotFound';
  }
}

/** Every value of a room's version — a version is whole, never a patch (ENT-003 · DQ-mrr-002). */
export interface RoomVersionInput {
  name: string;
  capacity: number;
  photos: string[];
  facilityIds: string[];
  requiresApproval: boolean;
  approverId: string | null;
}

export interface RoomRow {
  id: string;
  code: string;
  name: string;
  capacity: number;
  status: RoomStatus;
  requiresApproval: boolean;
  approver: { id: string; fullName: string } | null;
  versionNo: number;
}

export interface RoomPage {
  items: RoomRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface Facility {
  id: string;
  name: string;
  active: boolean;
}

/** UI-mrr-012 overflow — 20 to a page. */
export const PAGE_SIZE = 20;

/** AC-mrr-017 · AC-mrr-018 — ACL-014 is ROLE-002's alone, a System Administrator included. */
const REFUSAL = 'เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้';
const SAVED = 'บันทึกข้อมูลห้องสำเร็จ';
const UNIQUE_VIOLATION = '23505';

function checkVersion(input: RoomVersionInput): RoomVersionInput {
  const name = input.name.trim();
  if (!name) throw new RoomInvalid('name', 'กรุณาระบุชื่อห้อง');
  if (name.length > 100) throw new RoomInvalid('name', 'ชื่อห้องต้องไม่เกิน 100 ตัวอักษร');
  if (!Number.isInteger(input.capacity) || input.capacity < 1) throw new RoomInvalid('capacity', 'ความจุต้องเป็นจำนวนเต็มตั้งแต่ 1');
  return { ...input, name, facilityIds: [...new Set(input.facilityIds)] };
}

function checkFacilityName(name: string): string {
  const n = name.trim();
  if (!n) throw new RoomInvalid('name', 'กรุณาระบุชื่อสิ่งอำนวยความสะดวก');
  if (n.length > 100) throw new RoomInvalid('name', 'ชื่อสิ่งอำนวยความสะดวกต้องไม่เกิน 100 ตัวอักษร');
  return n;
}

/**
 * API-020 · API-021 · API-023 · API-026 · API-027 — a Room Administrator lists, adds and edits rooms
 * and the facilities they offer (UC-mrr-013 · ACL-014 · BR-mrr-005). An edit is a new version of the
 * room, and a change of the approval setting reaches the bookings that have not started (BR-mrr-010).
 */
@Injectable()
export class RoomAdminService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly notifier: BookingNotifier,
  ) {}

  /** API-020 — rooms by code; archived ones only when the filter asks for them. */
  async list(caller: Caller, input: { status?: RoomStatus; query?: string; page?: number }): Promise<RoomPage> {
    await assertRoomAdministrator(this.db, caller, REFUSAL);
    const page = input.page ?? 1;
    let q = this.db
      .selectFrom('meeting_rooms as r')
      .innerJoin('meeting_room_versions as v', 'v.id', 'r.current_version_id')
      .leftJoin('users as a', 'a.id', 'v.approver_id');
    q = input.status ? q.where('r.status', '=', input.status) : q.where('r.status', '!=', 'ARCHIVED');
    const text = input.query?.trim();
    if (text) {
      const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      q = q.where((eb) => eb.or([eb('v.name', 'ilike', like), eb('r.code', 'ilike', like)]));
    }
    const { total } = await q.select((eb) => eb.fn.countAll<string>().as('total')).executeTakeFirstOrThrow();
    const rows = await q
      .select(['r.id', 'r.code', 'r.status', 'v.name', 'v.capacity', 'v.requires_approval', 'v.version_no', 'a.id as approver_id', 'a.full_name as approver_name'])
      .orderBy(sql`r.code COLLATE "C"`)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .execute();
    return {
      items: rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        capacity: r.capacity,
        status: r.status,
        requiresApproval: r.requires_approval,
        approver: r.approver_id ? { id: r.approver_id, fullName: r.approver_name! } : null,
        versionNo: r.version_no,
      })),
      page,
      pageSize: PAGE_SIZE,
      total: Number(total),
    };
  }

  /** API-021 — a new room, ACTIVE, with its first version. Its code is fixed from now on (ENT-002). */
  async create(caller: Caller, input: RoomVersionInput & { code: string }): Promise<{ id: string; message: string }> {
    const now = this.clock.now();
    const code = input.code.trim();
    const version = checkVersion(input);
    return this.db.transaction().execute(async (tx) => {
      await assertRoomAdministrator(tx, caller, REFUSAL);
      if (!code) throw new RoomInvalid('code', 'กรุณาระบุรหัสห้อง');
      await this.checkReferences(tx, version);
      let roomId: string;
      try {
        // The room and its first version point at each other; the room's side is checked at commit.
        ({ id: roomId } = await tx
          .insertInto('meeting_rooms')
          .values({ code, current_version_id: '00000000-0000-0000-0000-000000000000', status: 'ACTIVE', created_at: now })
          .returning('id')
          .executeTakeFirstOrThrow());
      } catch (err) {
        if ((err as { code?: string }).code === UNIQUE_VIOLATION) throw new RoomInvalid('code', 'รหัสห้องนี้มีอยู่แล้ว');
        throw err;
      }
      await this.insertVersion(tx, caller, roomId, 1, version, now);
      return { id: roomId, message: SAVED };
    });
  }

  /**
   * API-023 — the room's next version becomes current; earlier ones stay as they were. When the
   * approval setting changes, the bookings that have not started follow it (BR-mrr-010@v2):
   * - to "needs approval": a booking usable without approval goes back to PENDING_APPROVAL, quietly
   *   (AC-mrr-076). One that starts now has started and stays (AC-mrr-078); one already approved
   *   stays approved.
   * - to "no approval": a waiting booking is usable at once — CONFIRMED, as if booked in a room that
   *   never needed approval — and its booker gets the จองสำเร็จ mail inside the transaction, so a
   *   mail that fails saves nothing (AC-mrr-077 · BR-mrr-019).
   * The capacity binds no booking, old or new (AC-mrr-032).
   */
  async saveVersion(caller: Caller, roomId: string, input: RoomVersionInput): Promise<{ message: string }> {
    const now = this.clock.now();
    const version = checkVersion(input);
    return this.db.transaction().execute(async (tx) => {
      await assertRoomAdministrator(tx, caller, REFUSAL);
      // Locked, so a booking being confirmed reads either the old setting or the new one (AC-mrr-031).
      const room = await tx
        .selectFrom('meeting_rooms as r')
        .innerJoin('meeting_room_versions as v', 'v.id', 'r.current_version_id')
        .select(['r.id', 'r.status', 'v.version_no', 'v.requires_approval'])
        .where('r.id', '=', roomId)
        .forUpdate('r')
        .executeTakeFirst();
      // ACL-014 condition — ACTIVE or UNDER_MAINTENANCE; an archived room is gone (STM-mrr-003).
      if (!room || room.status === 'ARCHIVED') throw new RoomInfoNotFound();
      await this.checkReferences(tx, version);
      await this.insertVersion(tx, caller, room.id, room.version_no + 1, version, now);

      if (!room.requires_approval && version.requiresApproval) {
        await tx
          .updateTable('bookings')
          .set({ status: 'PENDING_APPROVAL' })
          .where('room_id', '=', room.id)
          .where('status', '=', 'CONFIRMED')
          .where('start_at', '>', now)
          .execute();
      }
      if (room.requires_approval && !version.requiresApproval) {
        const released = await tx
          .updateTable('bookings')
          .set({ status: 'CONFIRMED' })
          .where('room_id', '=', room.id)
          .where('status', '=', 'PENDING_APPROVAL')
          .where('start_at', '>', now)
          .returning(['id', 'title', 'start_at', 'end_at', 'booked_by'])
          .execute();
        for (const b of released) await this.mailUsable(tx, b, version.name, now);
      }
      return { message: SAVED };
    });
  }

  /** API-026 — a new facility, offered from now on. */
  async createFacility(caller: Caller, input: { name: string }): Promise<{ facility: Facility; message: string }> {
    const name = checkFacilityName(input.name);
    await assertRoomAdministrator(this.db, caller, REFUSAL);
    try {
      const facility = await this.db.insertInto('facilities').values({ name }).returning(['id', 'name', 'active']).executeTakeFirstOrThrow();
      return { facility, message: 'บันทึกสิ่งอำนวยความสะดวกสำเร็จ' };
    } catch (err) {
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) throw new RoomInvalid('name', 'มีสิ่งอำนวยความสะดวกชื่อนี้แล้ว');
      throw err;
    }
  }

  /** API-027 — its name, or whether it is still offered; the rooms and bookings that name it keep it (ENT-004). */
  async updateFacility(caller: Caller, id: string, input: { name?: string; active?: boolean }): Promise<{ facility: Facility; message: string }> {
    const set: { name?: string; active?: boolean } = {};
    if (input.name !== undefined) set.name = checkFacilityName(input.name);
    if (input.active !== undefined) set.active = input.active;
    await assertRoomAdministrator(this.db, caller, REFUSAL);
    try {
      const q = Object.keys(set).length ? this.db.updateTable('facilities').set(set) : this.db.updateTable('facilities').set({ id });
      const facility = await q.where('id', '=', id).returning(['id', 'name', 'active']).executeTakeFirst();
      if (!facility) throw new FacilityNotFound();
      return { facility, message: 'บันทึกสิ่งอำนวยความสะดวกสำเร็จ' };
    } catch (err) {
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) throw new RoomInvalid('name', 'มีสิ่งอำนวยความสะดวกชื่อนี้แล้ว');
      throw err;
    }
  }

  /** The approver is a Room Administrator (BR-mrr-013); each facility is one still offered. */
  private async checkReferences(tx: Kysely<Database>, v: RoomVersionInput): Promise<void> {
    if (v.approverId) {
      const approver = await tx.selectFrom('users').select('role').where('id', '=', v.approverId).where('active', '=', true).executeTakeFirst();
      if (approver?.role !== 'ROOM_ADMINISTRATOR') throw new RoomInvalid('approverId', 'ผู้อนุมัติประจำห้องต้องเป็นผู้ดูแลห้อง');
    }
    if (v.facilityIds.length) {
      const found = await tx.selectFrom('facilities').select('id').where('id', 'in', v.facilityIds).where('active', '=', true).execute();
      if (found.length !== v.facilityIds.length) throw new RoomInvalid('facilityIds', 'ไม่พบสิ่งอำนวยความสะดวกที่เลือก');
    }
  }

  private async insertVersion(tx: Kysely<Database>, caller: Caller, roomId: string, versionNo: number, v: RoomVersionInput, now: Date): Promise<void> {
    const { id } = await tx
      .insertInto('meeting_room_versions')
      .values({
        room_id: roomId, version_no: versionNo, name: v.name, capacity: v.capacity, photos: JSON.stringify(v.photos),
        requires_approval: v.requiresApproval, approver_id: v.approverId, created_by: caller.userId, created_at: now,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    if (v.facilityIds.length) {
      await tx.insertInto('room_version_facilities').values(v.facilityIds.map((facility_id) => ({ room_version_id: id, facility_id }))).execute();
    }
    await tx.updateTable('meeting_rooms').set({ current_version_id: id }).where('id', '=', roomId).execute();
  }

  /** The จองสำเร็จ mail a booking made usable at once would have had (BR-mrr-007), its reminder too if due. */
  private async mailUsable(
    tx: Kysely<Database>,
    b: { id: string; title: string; start_at: Date; end_at: Date; booked_by: string },
    roomName: string,
    now: Date,
  ): Promise<void> {
    const booker = await tx.selectFrom('users').select('email').where('id', '=', b.booked_by).executeTakeFirstOrThrow();
    const attendees = await tx
      .selectFrom('booking_attendees as a')
      .innerJoin('users as u', 'u.id', 'a.user_id')
      .select('u.email')
      .where('a.booking_id', '=', b.id)
      .execute();
    const { reminderSent } = await this.notifier.bookingCreated(
      { title: b.title, roomName, startAt: b.start_at, endAt: b.end_at, bookerEmail: booker.email, attendeeEmails: attendees.map((a) => a.email) },
      now,
    );
    if (reminderSent) await tx.updateTable('bookings').set({ reminder_status: 'SENT', reminder_at: now }).where('id', '=', b.id).execute();
  }
}
