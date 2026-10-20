import { DynamicModule, Module, Type } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { AutoCancelJob } from './auto-cancel-job';
import { AutoCancelScheduler } from './auto-cancel-scheduler';
import { AUTO_CANCEL_STORE, AutoCancelStore } from './auto-cancel-store';

/**
 * The store is handed in by whoever owns booking persistence, so this module never reaches into
 * the database itself: `AutoCancelModule.withStore(PgAutoCancelStore)`.
 */
@Module({})
export class AutoCancelModule {
  static withStore(store: Type<AutoCancelStore>): DynamicModule {
    return {
      module: AutoCancelModule,
      imports: [NotificationModule],
      providers: [{ provide: AUTO_CANCEL_STORE, useClass: store }, AutoCancelJob, AutoCancelScheduler],
    };
  }
}
