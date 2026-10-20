import {
  BadRequestException, ConflictException, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, Post, Query,
} from '@nestjs/common';
import { Caller, CurrentUser, UUID } from '../../common/auth/current-user';
import {
  AdjustmentNotPending, AdjustmentPage, AdjustmentRequestNotFound, AdjustmentRequestService, OwnAdjustmentRequest,
} from './adjustment-request.service';
import { SlotTaken } from './booking.service';
import { NotRoomAdministrator } from './room-admin';

/** The domain's refusals as HTTP answers, with the domain's words. */
function answer(err: unknown): never {
  if (err instanceof AdjustmentRequestNotFound) throw new NotFoundException(err.message);
  if (err instanceof NotRoomAdministrator || err instanceof OwnAdjustmentRequest) throw new ForbiddenException(err.message);
  if (err instanceof AdjustmentNotPending || err instanceof SlotTaken) throw new ConflictException(err.message);
  throw err;
}

/** API-017 · API-018 · API-019 — adjustment requests, decided by a Room Administrator who did not ask (ACL-012). */
@Controller('adjustment-requests')
export class AdjustmentRequestController {
  constructor(private readonly adjustments: AdjustmentRequestService) {}

  @Get()
  async listPending(
    @CurrentUser() caller: Caller,
    @Query('status') status: unknown,
    @Query('page') page: unknown,
  ): Promise<AdjustmentPage> {
    if (status !== 'PENDING') throw new BadRequestException('status ต้องเป็น PENDING');
    const n = page === undefined ? 1 : typeof page === 'string' && /^[1-9]\d*$/.test(page) ? Number(page) : NaN;
    if (!Number.isSafeInteger(n)) throw new BadRequestException('page ต้องเป็นจำนวนเต็มตั้งแต่ 1');
    try {
      return await this.adjustments.listPending(caller, n);
    } catch (err) {
      answer(err);
    }
  }

  @Post(':id/approve')
  @HttpCode(200)
  async approve(@CurrentUser() caller: Caller, @Param('id') id: string): Promise<{ message: string }> {
    if (!UUID.test(id)) throw new NotFoundException('ไม่พบคำขอแก้ไข');
    try {
      return await this.adjustments.approve(caller, id);
    } catch (err) {
      answer(err);
    }
  }

  @Post(':id/reject')
  @HttpCode(200)
  async reject(@CurrentUser() caller: Caller, @Param('id') id: string): Promise<{ message: string }> {
    if (!UUID.test(id)) throw new NotFoundException('ไม่พบคำขอแก้ไข');
    try {
      return await this.adjustments.reject(caller, id);
    } catch (err) {
      answer(err);
    }
  }
}
