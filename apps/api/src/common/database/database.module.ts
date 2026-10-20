import { Global, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { Database } from './schema';

export const KYSELY = Symbol('KYSELY');

/** One pool for the app, from DATABASE_URL — the credentials live in the server's secrets. */
@Global()
@Module({
  providers: [
    {
      provide: KYSELY,
      useFactory: () =>
        new Kysely<Database>({
          dialect: new PostgresDialect({ pool: new Pool({ connectionString: process.env.DATABASE_URL }) }),
        }),
    },
  ],
  exports: [KYSELY],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async onApplicationShutdown(): Promise<void> {
    await this.db.destroy();
  }
}
