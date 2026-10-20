import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ReminderJob } from './reminder-job';

/** Every minute by default — a reminder lands between 15 and 14 minutes before the start. */
const DEFAULT_INTERVAL_MS = 60_000;

@Injectable()
export class ReminderScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReminderScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly job: ReminderJob) {}

  onModuleInit(): void {
    const interval = Number(process.env.REMINDER_JOB_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
    this.timer = setInterval(() => void this.tick(), interval);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** A pass that is still running when the next one is due is not overlapped. */
  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.job.run(new Date());
    } catch (err) {
      this.logger.error('reminder pass failed', err instanceof Error ? err.stack : String(err));
    } finally {
      this.running = false;
    }
  }
}
