import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Kysely } from 'kysely';
import { clockOffsetMs, setClockOffsetMs, systemClock } from '../../common/clock';
import { KYSELY } from '../../common/database/database.module';
import { Database } from '../../common/database/schema';
import { AutoCancelJob } from '../auto-cancel/auto-cancel-job';
import { AUTO_CANCEL_STORE, AutoCancelStore } from '../auto-cancel/auto-cancel-store';
import { BookingNotifier } from '../notification/booking-notifier';
import { ReminderJob } from '../reminder/reminder-job';
import { REMINDER_STORE, ReminderStore } from '../reminder/reminder-store';

/**
 * Dev-only handles for the end-to-end tests (docs/qa/t1-test-cases.md · OQ-T1-01 · OQ-T1-02).
 */
@Controller('__test')
export class TestControlsController {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    private readonly modules: ModuleRef,
  ) {}

  @Get('clock')
  read(): { now: string; offsetMs: number } {
    return { now: systemClock.now().toISOString(), offsetMs: clockOffsetMs() };
  }

  /**
   * Moves the app's clock. `{ now: "<ISO instant>" }` makes the app read that instant as "now" (and let it tick on
   * from there); `{ now: null }` puts it back on the machine's clock. Sessions are idle-limited by the same clock,
   * so every session is re-stamped to the new "now" — otherwise a jump forward would sign everyone out.
   * While the clock is moved the scheduled passes stand still (common/interval-runner.ts).
   */
  @Post('clock')
  @HttpCode(200)
  async set(@Body() body: { now?: unknown } = {}): Promise<{ now: string; offsetMs: number }> {
    if (body.now === null) setClockOffsetMs(0);
    else if (typeof body.now === 'string' && !Number.isNaN(Date.parse(body.now))) setClockOffsetMs(Date.parse(body.now) - Date.now());
    else throw new BadRequestException('now ต้องเป็นเวลา ISO หรือ null');
    await this.db.updateTable('sessions').set({ last_seen_at: systemClock.now() }).execute();
    return this.read();
  }

  /**
   * Runs one reminder pass and one auto-cancel pass now, at the app's clock — the same jobs the timers run, with the
   * real stores and mailer, but only over bookings whose title contains `titleContains`. The scope is required: a
   * pass at a borrowed "now" would otherwise cancel every pending booking in the database that "has started".
   */
  @Post('jobs/run')
  @HttpCode(200)
  async runJobs(@Body() body: { titleContains?: unknown } = {}): Promise<{ now: string }> {
    const scope = body.titleContains;
    if (typeof scope !== 'string' || scope.trim().length < 3) throw new BadRequestException('titleContains ต้องเป็นข้อความอย่างน้อย 3 ตัวอักษร');
    const now = systemClock.now();
    const notifier = this.modules.get(BookingNotifier, { strict: false });

    const reminders = this.modules.get<ReminderStore>(REMINDER_STORE, { strict: false });
    await new ReminderJob(
      {
        listUpcoming: async (from, until) => (await reminders.listUpcoming(from, until)).filter((b) => b.title.includes(scope)),
        recordReminder: (id, status, at) => reminders.recordReminder(id, status, at),
      },
      notifier,
    ).run(now);

    const pending = this.modules.get<AutoCancelStore>(AUTO_CANCEL_STORE, { strict: false });
    await new AutoCancelJob(
      {
        listPendingStartedBy: async (at) => (await pending.listPendingStartedBy(at)).filter((b) => b.title.includes(scope)),
        cancelIfPending: (id) => pending.cancelIfPending(id),
      },
      notifier,
    ).run(now);

    return { now: now.toISOString() };
  }
}
