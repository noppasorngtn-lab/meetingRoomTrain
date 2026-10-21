import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Kysely } from 'kysely';
import { KYSELY } from '../../common/database/database.module';
import { Database } from '../../common/database/schema';

export interface UserOption {
  id: string;
  fullName: string;
  email: string;
}

export interface Me {
  fullName: string;
  role: Database['users']['role'];
}

const LIMIT = 20;

/** `%`, `_` and `\` typed by a user are letters, not wildcards. */
const literal = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

@Injectable()
export class UsersService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  /** API-005 — active users whose name or email contains `query`, for picking attendees or approvers. */
  async search(query: string): Promise<UserOption[]> {
    const pattern = `%${literal(query)}%`;
    const rows = await this.db
      .selectFrom('users')
      .select(['id', 'full_name', 'email'])
      .where('active', '=', true)
      .where((eb) => eb.or([eb('full_name', 'ilike', pattern), eb('email', 'ilike', pattern)]))
      .orderBy('full_name')
      .limit(LIMIT)
      .execute();
    return rows.map((r) => ({ id: r.id, fullName: r.full_name, email: r.email }));
  }

  /**
   * API-035 — the signed-in user's own name and role. A session outlives the account it was made
   * for, so a user deactivated since is answered as nobody at all.
   */
  async me(userId: string): Promise<Me> {
    const row = await this.db
      .selectFrom('users')
      .select(['full_name', 'role'])
      .where('id', '=', userId)
      .where('active', '=', true)
      .executeTakeFirst();
    if (!row) throw new UnauthorizedException();
    return { fullName: row.full_name, role: row.role };
  }
}
