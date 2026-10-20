import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { Caller, CurrentUser, UUID } from '../../common/auth/current-user';
import { FacilityOption, RoomInfo, RoomInfoNotFound, RoomsService } from './rooms.service';

/** API-022 — any signed-in user may read a room they can see in search (ACL-001 · GAP-mrr-013). */
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get(':id')
  async room(@CurrentUser() _caller: Caller, @Param('id') id: string): Promise<RoomInfo> {
    if (!UUID.test(id)) throw new NotFoundException('ไม่พบห้อง');
    try {
      return await this.rooms.room(id);
    } catch (err) {
      if (err instanceof RoomInfoNotFound) throw new NotFoundException(err.message);
      throw err;
    }
  }
}

/** API-002 — the choices for the search filter and the booking form. Only `active=true` is served here. */
@Controller('facilities')
export class FacilitiesController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  async list(@CurrentUser() _caller: Caller, @Query('active') active: unknown): Promise<FacilityOption[]> {
    if (active !== 'true') throw new BadRequestException('active ต้องเป็น true');
    return this.rooms.activeFacilities();
  }
}
