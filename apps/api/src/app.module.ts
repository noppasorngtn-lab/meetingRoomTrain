import { Module } from '@nestjs/common';
import { BookingModule } from './modules/booking/booking.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { NotificationModule } from './modules/notification/notification.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [NotificationModule, CalendarModule, BookingModule, UsersModule],
})
export class AppModule {}
