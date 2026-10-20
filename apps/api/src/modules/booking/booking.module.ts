import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../../common/clock';
import { DatabaseModule } from '../../common/database/database.module';
import { NotificationModule } from '../notification/notification.module';
import { BookingEditService } from './booking-edit.service';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';

@Module({
  imports: [DatabaseModule, NotificationModule],
  controllers: [BookingController],
  providers: [{ provide: CLOCK, useValue: systemClock }, BookingService, BookingEditService],
})
export class BookingModule {}
