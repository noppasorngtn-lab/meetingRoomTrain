import { BadRequestException, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Caller, CurrentUser, UUID } from '../../common/auth/current-user';
import { NotRoomAdministrator } from '../booking/room-admin';
import { RoomMaintenanceService } from './room-maintenance.service';
import { FacilityOption, RoomInfo, RoomInfoNotFound, RoomsService } from './rooms.service';

/**
 * API-022 — any signed-in user may read a room they can see in search (ACL-001 · GAP-mrr-013).
 * API-024 — a Room Administrator puts it under maintenance or opens it again (ACL-015).
 */
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly maintenance: RoomMaintenanceService,
  ) {}

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

  /** API-024 — ACTIVE ↔ UNDER_MAINTENANCE; the bookings the room has stay as they are (BR-mrr-012). */
  @Post(':id/maintenance')
  @HttpCode(200)
  async toggleMaintenance(@CurrentUser() caller: Caller, @Param('id') id: string): Promise<{ message: string; status: string }> {
    if (!UUID.test(id)) throw new NotFoundException('ไม่พบห้อง');
    try {
      return await this.maintenance.toggle(caller, id);
    } catch (err) {
      if (err instanceof RoomInfoNotFound) throw new NotFoundException(err.message);
      if (err instanceof NotRoomAdministrator) throw new ForbiddenException(err.message);
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
