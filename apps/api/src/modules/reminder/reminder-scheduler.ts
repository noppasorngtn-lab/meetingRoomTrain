import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DEFAULT_INTERVAL_MS, IntervalRunner } from '../../common/interval-runner';
import { ReminderJob } from './reminder-job';

/** Every minute by default — a reminder lands between 15 and 14 minutes before the start. */
@Injectable()
export class ReminderScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly runner: IntervalRunner;

  constructor(job: ReminderJob) {
    const interval = Number(process.env.REMINDER_JOB_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
    this.runner = new IntervalRunner(ReminderScheduler.name, (now) => job.run(now), interval);
  }

  onModuleInit(): void {
    this.runner.start();
  }

  onModuleDestroy(): void {
    this.runner.stop();
  }
}
