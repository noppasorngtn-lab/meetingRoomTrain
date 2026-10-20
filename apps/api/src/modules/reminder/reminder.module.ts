import { DynamicModule, Module, Type } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { ReminderJob } from './reminder-job';
import { ReminderScheduler } from './reminder-scheduler';
import { REMINDER_STORE, ReminderStore } from './reminder-store';

/**
 * The store is handed in by whoever owns booking persistence, so this module never reaches into
 * the database itself: `ReminderModule.withStore(PgReminderStore)`.
 */
@Module({})
export class ReminderModule {
  static withStore(store: Type<ReminderStore>): DynamicModule {
    return {
      module: ReminderModule,
      imports: [NotificationModule],
      providers: [{ provide: REMINDER_STORE, useClass: store }, ReminderJob, ReminderScheduler],
    };
  }
}
