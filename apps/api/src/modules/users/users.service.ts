import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { KYSELY } from '../../common/database/database.module';
import { Database } from '../../common/database/schema';

export interface UserOption {
  id: string;
  fullName: string;
  email: string;
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
}
