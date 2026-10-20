import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param,
  Patch, Post, ServiceUnavailableException,
} from '@nestjs/common';
import { Caller, CurrentUser, UUID } from '../../common/auth/current-user';
import { EmailDeliveryFailed } from '../notification/booking-notifier';
import {
  BookingDetail, BookingEditService, BookingLocked, BookingNotFound, EditBookingInput, NotTheBooker,
} from './booking-edit.service';
import {
  BookingInvalid, BookingRoomNotFound, BookingService, CreatedBooking, RoomUnderMaintenance, SlotTaken,
} from './booking.service';

/** An instant with its offset — "2026-10-17T10:00:00+07:00" — so the server never guesses a time zone. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

const invalid = (field: string, message: string) => new BadRequestException({ statusCode: 400, field, message });

const instant = (value: unknown, field: string): Date => {
  const t = typeof value === 'string' && INSTANT.test(value) ? new Date(value) : null;
  if (!t || Number.isNaN(t.getTime())) throw invalid(field, `${field} ต้องเป็นวันเวลา ISO 8601 พร้อม offset`);
  return t;
};

const ids = (value: unknown, field: string): string[] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string' && UUID.test(v))) {
    throw invalid(field, `${field} ต้องเป็นรายการ id`);
  }
  return value;
};

/** For an edit, a field left out means "unchanged", so it stays undefined. */
const optional = <T>(value: unknown, read: (v: unknown) => T): T | undefined => (value === undefined ? undefined : read(value));

/** The domain's refusals as HTTP answers, with the domain's words. */
function answer(err: unknown): never {
  if (err instanceof BookingInvalid) throw invalid(err.field, err.message);
  if (err instanceof BookingRoomNotFound || err instanceof BookingNotFound) throw new NotFoundException(err.message);
  if (err instanceof NotTheBooker) throw new ForbiddenException(err.message);
  if (err instanceof RoomUnderMaintenance || err instanceof SlotTaken || err instanceof BookingLocked) {
    throw new ConflictException(err.message);
  }
  if (err instanceof EmailDeliveryFailed) throw new ServiceUnavailableException(err.message);
  throw err;
}

/**
 * API-004 — create a booking, with the caller as its booker (ACL-004 scope own).
 * API-007 · API-008 · API-009 — read one booking, and let its booker edit or cancel it before it
 * starts (ACL-005 · ACL-006).
 */
@Controller('bookings')
export class BookingController {
  constructor(
    private readonly bookings: BookingService,
    private readonly edits: BookingEditService,
  ) {}

  @Post()
  async create(@CurrentUser() caller: Caller, @Body() body: Record<string, unknown> = {}): Promise<CreatedBooking> {
    if (typeof body.roomId !== 'string' || !UUID.test(body.roomId)) throw new NotFoundException('ไม่พบห้อง');
    const input = {
      roomId: body.roomId,
      startAt: instant(body.startAt, 'startAt'),
      endAt: instant(body.endAt, 'endAt'),
      title: typeof body.title === 'string' ? body.title : '',
      attendeeIds: ids(body.attendeeIds, 'attendeeIds'),
      equipmentIds: ids(body.equipmentIds, 'equipmentIds'),
    };
    try {
      return await this.bookings.create(caller, input);
    } catch (err) {
      answer(err);
    }
  }

  @Get(':id')
  async get(@CurrentUser() caller: Caller, @Param('id') id: string): Promise<BookingDetail> {
    if (!UUID.test(id)) throw new NotFoundException('ไม่พบการจอง');
    try {
      return await this.edits.get(caller, id);
    } catch (err) {
      answer(err);
    }
  }

  /** API-009 — the booker cancels before the start (ACL-006). */
  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(@CurrentUser() caller: Caller, @Param('id') id: string): Promise<{ message: string }> {
    if (!UUID.test(id)) throw new NotFoundException('ไม่พบการจอง');
    try {
      return await this.edits.cancel(caller, id);
    } catch (err) {
      answer(err);
    }
  }

  @Patch(':id')
  async edit(
    @CurrentUser() caller: Caller,
    @Param('id') id: string,
    @Body() body: Record<string, unknown> = {},
  ): Promise<{ message: string }> {
    if (!UUID.test(id)) throw new NotFoundException('ไม่พบการจอง');
    const input: EditBookingInput = {
      startAt: optional(body.startAt, (v) => instant(v, 'startAt')),
      endAt: optional(body.endAt, (v) => instant(v, 'endAt')),
      title: optional(body.title, (v) => (typeof v === 'string' ? v : '')),
      attendeeIds: optional(body.attendeeIds, (v) => ids(v, 'attendeeIds')),
      equipmentIds: optional(body.equipmentIds, (v) => ids(v, 'equipmentIds')),
    };
    try {
      return await this.edits.edit(caller, id, input);
    } catch (err) {
      answer(err);
    }
  }
}
