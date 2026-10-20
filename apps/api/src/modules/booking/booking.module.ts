import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../../common/clock';
import { DatabaseModule } from '../../common/database/database.module';
import { NotificationModule } from '../notification/notification.module';
import { BookingEditService } from './booking-edit.service';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { MyBookingsController } from './my-bookings.controller';
import { MyBookingsService } from './my-bookings.service';

@Module({
  imports: [DatabaseModule, NotificationModule],
  controllers: [BookingController, MyBookingsController],
  providers: [{ provide: CLOCK, useValue: systemClock }, BookingService, BookingEditService, MyBookingsService],
})
export class BookingModule {}
