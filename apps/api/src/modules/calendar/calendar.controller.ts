import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { Caller, CurrentUser, UUID } from '../../common/auth/current-user';
import { CalendarView, isCalendarDate, VIEWS } from './calendar-range';
import { CalendarService, RoomCalendar, RoomNotFound } from './calendar.service';

/** API-003 — the room's booked slots, details only on the caller's own bookings (BR-mrr-021). */
@Controller('rooms')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get(':id/calendar')
  async roomCalendar(
    @CurrentUser() caller: Caller,
    @Param('id') id: string,
    @Query('view') view: string,
    @Query('date') date: string,
  ): Promise<RoomCalendar> {
    if (!VIEWS.includes(view as CalendarView)) throw new BadRequestException(`view ต้องเป็น ${VIEWS.join(' · ')}`);
    if (typeof date !== 'string' || !isCalendarDate(date)) throw new BadRequestException('date ต้องเป็นวันที่ YYYY-MM-DD');
    if (!UUID.test(id)) throw new NotFoundException('ไม่พบห้อง');
    try {
      return await this.calendar.forRoom(caller, id, view as CalendarView, date);
    } catch (err) {
      if (err instanceof RoomNotFound) throw new NotFoundException(err.message);
      throw err;
    }
  }
}
