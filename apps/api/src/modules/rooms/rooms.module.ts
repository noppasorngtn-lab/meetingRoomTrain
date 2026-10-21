import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../../common/clock';
import { DatabaseModule } from '../../common/database/database.module';
import { RoomMaintenanceService } from './room-maintenance.service';
import { FacilitiesController, RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [DatabaseModule],
  controllers: [RoomsController, FacilitiesController],
  providers: [{ provide: CLOCK, useValue: systemClock }, RoomsService, RoomMaintenanceService],
})
export class RoomsModule {}
