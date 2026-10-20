import {
  BadRequestException, Body, ConflictException, Controller, NotFoundException, Post, ServiceUnavailableException,
} from '@nestjs/common';
import { Caller, CurrentUser, UUID } from '../../common/auth/current-user';
import { EmailDeliveryFailed } from '../notification/booking-notifier';
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

/** API-004 — create a booking, with the caller as its booker (ACL-004 scope own). */
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookings: BookingService) {}

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
      if (err instanceof BookingInvalid) throw invalid(err.field, err.message);
      if (err instanceof BookingRoomNotFound) throw new NotFoundException(err.message);
      if (err instanceof RoomUnderMaintenance || err instanceof SlotTaken) throw new ConflictException(err.message);
      if (err instanceof EmailDeliveryFailed) throw new ServiceUnavailableException(err.message);
      throw err;
    }
  }
}
