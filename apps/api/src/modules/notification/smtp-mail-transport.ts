import { createTransport, Transporter } from 'nodemailer';
import { MailMessage, MailTransport } from './mail-transport';

/** Connection and send must both finish within 10 seconds, or the send counts as failed (INT-001). */
const TIMEOUT_MS = 10_000;

export interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
}

/** Read from the server's environment — credentials live in its secrets, never in code (INT-001). */
export const smtpConfigFromEnv = (env: NodeJS.ProcessEnv = process.env): SmtpConfig => ({
  host: env.SMTP_HOST ?? 'localhost',
  port: Number(env.SMTP_PORT ?? 587),
  user: env.SMTP_USER || undefined,
  pass: env.SMTP_PASS || undefined,
  from: env.SMTP_FROM ?? 'no-reply@localhost',
});

export class SmtpMailTransport implements MailTransport {
  private readonly transporter: Transporter;

  constructor(private readonly config: SmtpConfig) {
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: false, // STARTTLS on 587
      requireTLS: config.port === 587,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
      socketTimeout: TIMEOUT_MS,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.config.from, ...message });
  }
}
