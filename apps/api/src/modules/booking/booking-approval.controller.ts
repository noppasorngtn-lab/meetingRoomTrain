import {
  BadRequestException, ConflictException, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, Post, Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Caller, CurrentUser, UUID } from '../../common/auth/current-user';
import { EmailDeliveryFailed } from '../notification/booking-notifier';
import {
  BookingApprovalService, NotPending, NotRoomAdministrator, NotTheApprover, PendingPage,
} from './booking-approval.service';
import { BookingNotFound } from './booking-edit.service';

/** The domain's refusals as HTTP answers, with the domain's words. */
function answer(err: unknown): never {
  if (err instanceof BookingNotFound) throw new NotFoundException(err.message);
  if (err instanceof NotRoomAdministrator || err instanceof NotTheApprover) throw new ForbiddenException(err.message);
  if (err instanceof NotPending) throw new ConflictException(err.message);
  if (err instanceof EmailDeliveryFailed) throw new ServiceUnavailableException(err.message);
  throw err;
}

/** API-010 · API-011 · API-012 — a Room Administrator's pending list and decisions (ACL-008). */
@Controller('bookings')
export class BookingApprovalController {
  constructor(private readonly approvals: BookingApprovalService) {}

  @Get()
  async listPending(
    @CurrentUser() caller: Caller,
    @Query('status') status: unknown,
    @Query('page') page: unknown,
  ): Promise<PendingPage> {
    // API-010 is the only listing of /bookings so far — it answers the pending queue and nothing else.
    if (status !== 'PENDING_APPROVAL') throw new BadRequestException('status ต้องเป็น PENDING_APPROVAL');
    const n = page === undefined ? 1 : typeof page === 'string' && /^[1-9]\d*$/.test(page) ? Number(page) : NaN;
    if (!Number.isSafeInteger(n)) throw new BadRequestException('page ต้องเป็นจำนวนเต็มตั้งแต่ 1');
    try {
      return await this.approvals.listPending(caller, n);
    } catch (err) {
      answer(err);
    }
  }

  @Post(':id/approve')
  @HttpCode(200)
  async approve(@CurrentUser() caller: Caller, @Param('id') id: string): Promise<{ message: string }> {
    if (!UUID.test(id)) throw new NotFoundException('ไม่พบการจอง');
    try {
      return await this.approvals.approve(caller, id);
    } catch (err) {
      answer(err);
    }
  }

  @Post(':id/reject')
  @HttpCode(200)
  async reject(@CurrentUser() caller: Caller, @Param('id') id: string): Promise<{ message: string }> {
    if (!UUID.test(id)) throw new NotFoundException('ไม่พบการจอง');
    try {
      return await this.approvals.reject(caller, id);
    } catch (err) {
      answer(err);
    }
  }
}
