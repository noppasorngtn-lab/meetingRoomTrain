import { Module } from '@nestjs/common';
import { AutoCancelModule } from './modules/auto-cancel/auto-cancel.module';
import { PgAutoCancelStore } from './modules/auto-cancel/pg-auto-cancel-store';
import { AuthModule } from './modules/auth/auth.module';
import { BookingModule } from './modules/booking/booking.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { NotificationModule } from './modules/notification/notification.module';
import { PgReminderStore } from './modules/reminder/pg-reminder-store';
import { ReminderModule } from './modules/reminder/reminder.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { TestControlsModule } from './modules/test-controls/test-controls.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AuthModule, NotificationModule, CalendarModule, BookingModule, UsersModule, RoomsModule, ReportsModule,
    // The scheduled jobs (UC-mrr-018 · UC-mrr-019): each pass reads and writes through its Postgres store.
    ReminderModule.withStore(PgReminderStore), AutoCancelModule.withStore(PgAutoCancelStore),
    ...TestControlsModule.ifEnabled(),
  ],
})
export class AppModule {}
