import { Kysely } from 'kysely';
import { Caller } from '../../common/auth/current-user';
import { Database } from '../../common/database/schema';

/** ACL-008 · ACL-009 · ACL-010 are ROLE-002's alone — a General User, or a System Administrator, does none of it. */
export class NotRoomAdministrator extends Error {}

/** The role is read from the database on every call, never trusted from the request. */
export async function assertRoomAdministrator(db: Kysely<Database>, caller: Caller, refusal: string): Promise<void> {
  const me = await db.selectFrom('users').select('role').where('id', '=', caller.userId).executeTakeFirst();
  if (me?.role !== 'ROOM_ADMINISTRATOR') throw new NotRoomAdministrator(refusal);
}

/**
 * BR-mrr-017 — who · when · what · why, written in the same transaction as the action, so an
 * action that fails leaves no entry (AC-mrr-055).
 */
export async function recordAudit(
  tx: Kysely<Database>,
  entry: {
    bookingId: string;
    caller: Caller;
    action: Database['booking_audit_entries']['action'];
    at: Date;
    reason?: string | null;
    detail?: unknown;
  },
): Promise<void> {
  await tx
    .insertInto('booking_audit_entries')
    .values({
      booking_id: entry.bookingId,
      actor_id: entry.caller.userId,
      action: entry.action,
      reason: entry.reason ?? null,
      detail: entry.detail === undefined || entry.detail === null ? null : JSON.stringify(entry.detail),
      at: entry.at,
    })
    .execute();
}
