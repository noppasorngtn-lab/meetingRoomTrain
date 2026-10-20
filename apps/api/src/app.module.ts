import { Module } from '@nestjs/common';
import { CalendarModule } from './modules/calendar/calendar.module';
import { NotificationModule } from './modules/notification/notification.module';

@Module({
  imports: [NotificationModule, CalendarModule],
})
export class AppModule {}
