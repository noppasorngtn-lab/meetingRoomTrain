import {
  BadRequestException, Controller, createParamDecorator, ExecutionContext, Get, NotFoundException, Param, Query,
  UnauthorizedException,
} from '@nestjs/common';
import { CalendarView, isCalendarDate, VIEWS } from './calendar-range';
import { Caller, CalendarService, RoomCalendar, RoomNotFound } from './calendar.service';

/**
 * The signed-in user, as the sign-in guard leaves it on the request. Until that guard exists
 * (GAP-mrr-003) there is never one, so every call is 401 — there is no back door to fake it.
 */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): Caller => {
  const user = ctx.switchToHttp().getRequest().user as Caller | undefined;
  if (!user?.userId) throw new UnauthorizedException();
  return user;
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
