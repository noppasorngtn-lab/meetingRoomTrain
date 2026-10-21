import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../../common/clock';
import { DatabaseModule } from '../../common/database/database.module';
import { NotificationModule } from '../notification/notification.module';
import { RoomAdminService } from './room-admin.service';
import { RoomMaintenanceService } from './room-maintenance.service';
import { FacilitiesController, RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [DatabaseModule, NotificationModule],
  controllers: [RoomsController, FacilitiesController],
  providers: [{ provide: CLOCK, useValue: systemClock }, RoomsService, RoomMaintenanceService, RoomAdminService],
})
export class RoomsModule {}
