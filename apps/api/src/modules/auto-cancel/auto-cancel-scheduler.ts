import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DEFAULT_INTERVAL_MS, IntervalRunner } from '../../common/interval-runner';
import { AutoCancelJob } from './auto-cancel-job';

/** Every minute by default — a pending booking is cancelled within a minute of its start. */
@Injectable()
export class AutoCancelScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly runner: IntervalRunner;

  constructor(job: AutoCancelJob) {
    const interval = Number(process.env.AUTO_CANCEL_JOB_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
    this.runner = new IntervalRunner(AutoCancelScheduler.name, (now) => job.run(now), interval);
  }

  onModuleInit(): void {
    this.runner.start();
  }

  onModuleDestroy(): void {
    this.runner.stop();
  }
}
