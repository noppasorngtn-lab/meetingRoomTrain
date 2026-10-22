import { Module } from '@nestjs/common';
import { BookingNotifier } from './booking-notifier';
import { MAIL_TRANSPORT } from './mail-transport';
import { SmtpMailTransport, smtpConfigFromEnv } from './smtp-mail-transport';

@Module({
  providers: [
    { provide: MAIL_TRANSPORT, useFactory: () => new SmtpMailTransport(smtpConfigFromEnv()) },
    BookingNotifier,
  ],
  exports: [BookingNotifier, MAIL_TRANSPORT],
})
export class NotificationModule {}
