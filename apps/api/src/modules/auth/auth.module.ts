import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CLOCK, systemClock } from '../../common/clock';
import { DatabaseModule } from '../../common/database/database.module';
import { NotificationModule } from '../notification/notification.module';
import { AuthController } from './auth.controller';
import { SessionMiddleware } from './session.middleware';
import { SessionsService } from './sessions.service';
import { SignInService } from './sign-in.service';

/** Sign-in (UC-mrr-020) and the session every other endpoint reads its caller from. */
@Module({
  imports: [DatabaseModule, NotificationModule],
  controllers: [AuthController],
  providers: [{ provide: CLOCK, useValue: systemClock }, SignInService, SessionsService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessionMiddleware).forRoutes('*');
  }
}
