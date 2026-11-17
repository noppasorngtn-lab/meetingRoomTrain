import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { Kysely } from 'kysely';
import { clockOffsetMs, setClockOffsetMs, systemClock } from '../../common/clock';
import { KYSELY } from '../../common/database/database.module';
import { Database } from '../../common/database/schema';

/**
 * Moves the app's clock for end-to-end tests. `{ now: "<ISO instant>" }` makes the app read that
 * instant as "now" (and let it tick on from there); `{ now: null }` puts it back on the machine's clock.
 * Sessions are idle-limited by the same clock, so every session is re-stamped to the new "now" —
 * otherwise a jump forward would sign everyone out.
 */
@Controller('__test/clock')
export class TestControlsController {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  @Get()
  read(): { now: string; offsetMs: number } {
    return { now: systemClock.now().toISOString(), offsetMs: clockOffsetMs() };
  }

  @Post()
  @HttpCode(200)
  async set(@Body() body: { now?: unknown } = {}): Promise<{ now: string; offsetMs: number }> {
    if (body.now === null) setClockOffsetMs(0);
    else if (typeof body.now === 'string' && !Number.isNaN(Date.parse(body.now))) setClockOffsetMs(Date.parse(body.now) - Date.now());
    else throw new BadRequestException('now ต้องเป็นเวลา ISO หรือ null');
    await this.db.updateTable('sessions').set({ last_seen_at: systemClock.now() }).execute();
    return this.read();
  }
}
