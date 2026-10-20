import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import { migrate } from '../../src/common/database/migrate';
import { Database } from '../../src/common/database/schema';

/** A throwaway PostgreSQL with every migration applied. One per test file. */
export async function startDatabase(): Promise<{ db: Kysely<Database>; stop: () => Promise<void> }> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16-alpine').start();
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString: container.getConnectionUri() }) }),
  });
  await migrate(db);
  return {
    db,
    stop: async () => {
      await db.destroy();
      await container.stop();
    },
  };
}

export async function truncateAll(db: Kysely<Database>): Promise<void> {
  await sql`TRUNCATE booking_attendees, bookings, meeting_rooms, meeting_room_versions, users CASCADE`.execute(db);
}

export async function seedUser(db: Kysely<Database>, fullName: string, role: Database['users']['role'] = 'GENERAL_USER') {
  const { id } = await db
    .insertInto('users')
    .values({ email: `${fullName.toLowerCase()}@example.test`, full_name: fullName, role })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

export async function seedRoom(
  db: Kysely<Database>,
  name: string,
  createdBy: string,
  opts: { requiresApproval?: boolean; status?: Database['meeting_rooms']['status'] } = {},
) {
  return db.transaction().execute(async (tx) => {
    const room = await tx
      .insertInto('meeting_rooms')
      .values({ code: name.replace(/\s+/g, '-'), current_version_id: '00000000-0000-0000-0000-000000000000', status: opts.status ?? 'ACTIVE' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const version = await tx
      .insertInto('meeting_room_versions')
      .values({ room_id: room.id, version_no: 1, name, capacity: 10, requires_approval: opts.requiresApproval ?? false, approver_id: null, created_by: createdBy })
      .returning('id')
      .executeTakeFirstOrThrow();
    await tx.updateTable('meeting_rooms').set({ current_version_id: version.id }).where('id', '=', room.id).execute();
    return { roomId: room.id, versionId: version.id };
  });
}

export async function seedBooking(
  db: Kysely<Database>,
  b: { room: { roomId: string; versionId: string }; bookedBy: string; title: string; startAt: Date; endAt: Date; status?: Database['bookings']['status']; attendees?: string[] },
) {
  const { id } = await db
    .insertInto('bookings')
    .values({
      room_id: b.room.roomId,
      room_version_id: b.room.versionId,
      booked_by: b.bookedBy,
      title: b.title,
      start_at: b.startAt,
      end_at: b.endAt,
      status: b.status ?? 'CONFIRMED',
      reminder_at: null,
      cancel_reason: null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  for (const u of b.attendees ?? []) await db.insertInto('booking_attendees').values({ booking_id: id, user_id: u }).execute();
  return id;
}
