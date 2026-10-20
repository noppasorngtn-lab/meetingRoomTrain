import { Logger } from '@nestjs/common';

/** Every minute unless the environment says otherwise. */
export const DEFAULT_INTERVAL_MS = 60_000;

/**
 * Runs one scheduled pass every `intervalMs`. A pass still running when the next is due is not
 * overlapped, and a pass that throws is logged and does not stop the timer.
 */
export class IntervalRunner {
  private readonly logger: Logger;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    name: string,
    private readonly pass: (now: Date) => Promise<void>,
    private readonly intervalMs: number,
  ) {
    this.logger = new Logger(name);
  }

  start(): void {
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.pass(new Date());
    } catch (err) {
      this.logger.error('scheduled pass failed', err instanceof Error ? err.stack : String(err));
    } finally {
      this.running = false;
    }
  }
}
