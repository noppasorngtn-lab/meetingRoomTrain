import {
  BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, Patch, Post, Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Caller, CurrentUser, UUID } from '../../common/auth/current-user';
import { NotRoomAdministrator } from '../booking/room-admin';
import { EmailDeliveryFailed } from '../notification/booking-notifier';
import { Facility, FacilityNotFound, RoomAdminService, RoomDetail, RoomInvalid, RoomPage, RoomVersionInput } from './room-admin.service';
import { isCalendarDate } from '../calendar/calendar-range';
import { RoomMaintenanceService } from './room-maintenance.service';
import { AvailableRoom, RoomSearch, RoomSearchService } from './room-search.service';
import { FacilityOption, RoomInfo, RoomInfoNotFound, RoomsService } from './rooms.service';

const invalid = (field: string, message: string) => new BadRequestException({ statusCode: 400, field, message });

/** The domain's refusals as HTTP answers, with the domain's words. */
function answer(err: unknown): never {
  if (err instanceof RoomInvalid) throw invalid(err.field, err.message);
  if (err instanceof RoomInfoNotFound || err instanceof FacilityNotFound) throw new NotFoundException(err.message);
  if (err instanceof NotRoomAdministrator) throw new ForbiddenException(err.message);
  if (err instanceof EmailDeliveryFailed) throw new ServiceUnavailableException(err.message);
  throw err;
}

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The search query as the URL carries it, checked and turned into instants — Bangkok, as the calendar reads a day. */
function searchOf(q: { date: unknown; start: unknown; end: unknown; attendees: unknown; facilities: unknown }): RoomSearch {
  if (typeof q.date !== 'string' || !isCalendarDate(q.date)) throw invalid('date', 'date ต้องเป็นวันที่ YYYY-MM-DD');
  if (typeof q.start !== 'string' || !HH_MM.test(q.start)) throw invalid('start', 'start ต้องเป็นเวลา HH:MM');
  if (typeof q.end !== 'string' || !HH_MM.test(q.end)) throw invalid('end', 'end ต้องเป็นเวลา HH:MM');
  const startAt = new Date(`${q.date}T${q.start}:00+07:00`);
  const endAt = new Date(`${q.date}T${q.end}:00+07:00`);
  if (endAt <= startAt) throw invalid('end', 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม');

  let attendees: number | undefined;
  if (q.attendees !== undefined) {
    if (typeof q.attendees !== 'string' || !/^[1-9]\d*$/.test(q.attendees)) throw invalid('attendees', 'attendees ต้องเป็นจำนวนเต็มตั้งแต่ 1');
    attendees = Number(q.attendees);
  }

  let facilityIds: string[] = [];
  if (q.facilities !== undefined) {
    const ids = typeof q.facilities === 'string' ? q.facilities.split(',') : [];
    if (ids.length === 0 || !ids.every((f) => UUID.test(f))) throw invalid('facilities', 'facilities ต้องเป็นรายการ id คั่นด้วย ,');
    facilityIds = ids;
  }
  return { startAt, endAt, attendees, facilityIds };
}

const STATUSES = ['ACTIVE', 'UNDER_MAINTENANCE', 'ARCHIVED'] as const;

/** A room version's fields as the body carries them — every one of them, each of its own type. */
function versionInput(body: Record<string, unknown>): RoomVersionInput {
  const { name, capacity, photos = [], facilityIds = [], requiresApproval, approverId = null } = body;
  if (typeof name !== 'string') throw invalid('name', 'กรุณาระบุชื่อห้อง');
  if (typeof capacity !== 'number') throw invalid('capacity', 'ความจุต้องเป็นจำนวนเต็มตั้งแต่ 1');
  if (!Array.isArray(photos) || !photos.every((p) => typeof p === 'string')) throw invalid('photos', 'photos ต้องเป็นรายการ id ของไฟล์');
  if (!Array.isArray(facilityIds) || !facilityIds.every((f) => typeof f === 'string' && UUID.test(f))) {
    throw invalid('facilityIds', 'facilityIds ต้องเป็นรายการ id');
  }
  if (typeof requiresApproval !== 'boolean') throw invalid('requiresApproval', 'requiresApproval ต้องเป็น true หรือ false');
  if (approverId !== null && !(typeof approverId === 'string' && UUID.test(approverId))) {
    throw invalid('approverId', 'ผู้อนุมัติประจำห้องต้องเป็นผู้ดูแลห้อง');
  }
  return { name, capacity, photos, facilityIds, requiresApproval, approverId };
}

/**
 * API-020 · API-021 · API-023 — a Room Administrator lists, adds and edits rooms (ACL-014).
 * API-022 — any signed-in user may read a room they can see in search (ACL-001 · GAP-mrr-013); a Room
 *   Administrator reads its whole current version, the one an edit starts from (ACL-014).
 * API-024 — a Room Administrator puts it under maintenance or opens it again (ACL-015).
 */
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly maintenance: RoomMaintenanceService,
    private readonly admin: RoomAdminService,
    private readonly search: RoomSearchService,
  ) {}

  /** API-020 — 20 to a page, by code; ?status= picks one state, archived rooms only that way. */
  @Get()
  async list(
    @CurrentUser() caller: Caller,
    @Query('status') status: unknown,
    @Query('query') query: unknown,
    @Query('page') page: unknown,
  ): Promise<RoomPage> {
    if (status !== undefined && !STATUSES.includes(status as (typeof STATUSES)[number])) {
      throw new BadRequestException('status ต้องเป็น ACTIVE, UNDER_MAINTENANCE หรือ ARCHIVED');
    }
    const n = page === undefined ? 1 : typeof page === 'string' && /^[1-9]\d*$/.test(page) ? Number(page) : NaN;
    if (!Number.isSafeInteger(n)) throw new BadRequestException('page ต้องเป็นจำนวนเต็มตั้งแต่ 1');
    try {
      return await this.admin.list(caller, {
        status: status as (typeof STATUSES)[number] | undefined,
        query: typeof query === 'string' ? query : undefined,
        page: n,
      });
    } catch (err) {
      answer(err);
    }
  }

  /** API-021 — a new room with its first version; its code is fixed from now on. */
  @Post()
  async create(@CurrentUser() caller: Caller, @Body() body: Record<string, unknown> = {}): Promise<{ id: string; message: string }> {
    if (typeof body.code !== 'string') throw invalid('code', 'กรุณาระบุรหัสห้อง');
    const input = { code: body.code, ...versionInput(body) };
    try {
      return await this.admin.create(caller, input);
    } catch (err) {
      answer(err);
    }
  }

  /**
   * API-001 — the rooms free for a day and time, with seats enough and the facilities asked for (UC-mrr-001).
   * Declared before `:id`, or "available" would be read as a room id.
   */
  @Get('available')
  async available(
    @CurrentUser() _caller: Caller,
    @Query('date') date: unknown,
    @Query('start') start: unknown,
    @Query('end') end: unknown,
    @Query('attendees') attendees: unknown,
    @Query('facilities') facilities: unknown,
  ): Promise<AvailableRoom[]> {
    return this.search.available(searchOf({ date, start, end, attendees, facilities }));
  }

  @Get(':id')
  async room(@CurrentUser() caller: Caller, @Param('id') id: string): Promise<RoomDetail | RoomInfo> {
    if (!UUID.test(id)) throw new NotFoundException('ไม่พบห้อง');
    try {
      return await this.admin.room(caller, id);
    } catch (err) {
      if (!(err instanceof NotRoomAdministrator)) answer(err);
    }
    try {
      return await this.rooms.room(id);
    } catch (err) {
      answer(err);
    }
  }

  /** API-023 — the room's next version; the bookings that have not started follow its approval setting. */
  @Post(':id/versions')
  async saveVersion(
    @CurrentUser() caller: Caller,
    @Param('id') id: string,
    @Body() body: Record<string, unknown> = {},
  ): Promise<{ message: string }> {
    if (!UUID.test(id)) throw new NotFoundException('ไม่พบห้อง');
    const input = versionInput(body);
    try {
      return await this.admin.saveVersion(caller, id, input);
    } catch (err) {
      answer(err);
    }
  }

  /** API-024 — ACTIVE ↔ UNDER_MAINTENANCE; the bookings the room has stay as they are (BR-mrr-012). */
  @Post(':id/maintenance')
  @HttpCode(200)
  async toggleMaintenance(@CurrentUser() caller: Caller, @Param('id') id: string): Promise<{ message: string; status: string }> {
    if (!UUID.test(id)) throw new NotFoundException('ไม่พบห้อง');
    try {
      return await this.maintenance.toggle(caller, id);
    } catch (err) {
      answer(err);
    }
  }
}

/**
 * API-002 — the choices for the search filter and the booking form (`active=true`).
 * API-036 — every facility, the taken-out ones too (`active=all`), for a Room Administrator.
 * API-026 · API-027 — a Room Administrator adds a facility, renames it or takes it out of use.
 */
@Controller('facilities')
export class FacilitiesController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly admin: RoomAdminService,
  ) {}

  /** `active=true` is API-002 (anyone signed in); `active=all` is API-036 — every facility, taken-out ones too, for a Room Administrator. */
  @Get()
  async list(@CurrentUser() caller: Caller, @Query('active') active: unknown): Promise<FacilityOption[] | Facility[]> {
    if (active === 'all') {
      try {
        return await this.admin.listAllFacilities(caller);
      } catch (err) {
        answer(err);
      }
    }
    if (active !== 'true') throw new BadRequestException('active ต้องเป็น true หรือ all');
    return this.rooms.activeFacilities();
  }

  @Post()
  async create(@CurrentUser() caller: Caller, @Body() body: Record<string, unknown> = {}): Promise<{ facility: Facility; message: string }> {
    if (typeof body.name !== 'string') throw invalid('name', 'กรุณาระบุชื่อสิ่งอำนวยความสะดวก');
    try {
      return await this.admin.createFacility(caller, { name: body.name });
    } catch (err) {
      answer(err);
    }
  }

  @Patch(':id')
  async update(
    @CurrentUser() caller: Caller,
    @Param('id') id: string,
    @Body() body: Record<string, unknown> = {},
  ): Promise<{ facility: Facility; message: string }> {
    if (!UUID.test(id)) throw new NotFoundException('ไม่พบสิ่งอำนวยความสะดวก');
    if (body.name !== undefined && typeof body.name !== 'string') throw invalid('name', 'กรุณาระบุชื่อสิ่งอำนวยความสะดวก');
    if (body.active !== undefined && typeof body.active !== 'boolean') throw invalid('active', 'active ต้องเป็น true หรือ false');
    try {
      return await this.admin.updateFacility(caller, id, { name: body.name as string | undefined, active: body.active as boolean | undefined });
    } catch (err) {
      answer(err);
    }
  }
}
