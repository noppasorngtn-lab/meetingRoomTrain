import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Kysely, sql } from 'kysely';
import { Database } from './schema';

const DIR = join(__dirname, 'migrations');

/** Applies every migrations/NNN_*.sql not yet recorded, in name order, each in its own transaction. */
export async function migrate(db: Kysely<Database>, dir = DIR): Promise<string[]> {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`.execute(db);
  const done = new Set(
    (await sql<{ name: string }>`SELECT name FROM schema_migrations`.execute(db)).rows.map((r) => r.name),
  );
  const applied: string[] = [];
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(name)) continue;
    const body = readFileSync(join(dir, name), 'utf8');
    await db.transaction().execute(async (tx) => {
      await sql.raw(body).execute(tx);
      await sql`INSERT INTO schema_migrations (name) VALUES (${name})`.execute(tx);
    });
    applied.push(name);
  }
  return applied;
}
