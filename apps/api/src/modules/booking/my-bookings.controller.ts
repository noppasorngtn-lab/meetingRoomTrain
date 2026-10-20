import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Caller, CurrentUser } from '../../common/auth/current-user';
import { MyBookingsPage, MyBookingsService } from './my-bookings.service';

/** API-006 — the caller's own bookings, a page at a time (ACL-007). */
@Controller('me/bookings')
export class MyBookingsController {
  constructor(private readonly bookings: MyBookingsService) {}

  @Get()
  async list(@CurrentUser() caller: Caller, @Query('page') page: unknown): Promise<MyBookingsPage> {
    const n = page === undefined ? 1 : typeof page === 'string' && /^[1-9]\d*$/.test(page) ? Number(page) : NaN;
    if (!Number.isSafeInteger(n)) throw new BadRequestException('page ต้องเป็นจำนวนเต็มตั้งแต่ 1');
    return this.bookings.list(caller, n);
  }
}
