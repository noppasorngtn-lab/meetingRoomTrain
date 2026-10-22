import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { CLOCK, Clock } from '../../common/clock';
import { KYSELY } from '../../common/database/database.module';
import { Database } from '../../common/database/schema';
import { hash, newToken } from './tokens';

/** A session ends after 30 minutes with no request — usable while now < last_seen_at + 30 min (decided by Noppasorn, 2026-10-22). */
const IDLE_LIMIT_MS = 30 * 60 * 1000;

@Injectable()
export class SessionsService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Opens a session for the user and returns the token the cookie carries. */
  async open(userId: string): Promise<string> {
    const token = newToken();
    const now = this.clock.now();
    await this.db
      .insertInto('sessions')
      .values({ token_hash: hash(token), user_id: userId, created_at: now, last_seen_at: now })
      .execute();
    return token;
  }

  /**
   * The user a token belongs to, or null when it is unknown, idle too long, or its user was
   * deactivated since (BR-mrr-026). A live session is touched, so activity keeps it open.
   */
  async resolve(token: string): Promise<string | null> {
    const now = this.clock.now();
    const row = await this.db
      .selectFrom('sessions')
      .innerJoin('users', 'users.id', 'sessions.user_id')
      .select(['sessions.id', 'sessions.user_id'])
      .where('sessions.token_hash', '=', hash(token))
      .where('sessions.last_seen_at', '>', new Date(now.getTime() - IDLE_LIMIT_MS))
      .where('users.active', '=', true)
      .executeTakeFirst();
    if (!row) return null;
    await this.db.updateTable('sessions').set({ last_seen_at: now }).where('id', '=', row.id).execute();
    return row.user_id;
  }
}
