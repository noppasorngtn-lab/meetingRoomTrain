import { Kysely } from 'kysely';
import { BookingSnapshot } from '../modules/notification/booking-notifier';
import { Database } from './database/schema';

export interface BookingRowForMail {
  id: string;
  room_id: string;
  booked_by: string;
  title: string;
  start_at: Date;
  end_at: Date;
}

/**
 * The booker's email, or null when the account is masked under ADR-017 (inactive): such a booker is left
 * out of every mail, as a masked attendee is (T5 F5 · Q-ADR017-3).
 */
export async function activeBookerEmail(db: Kysely<Database>, userId: string): Promise<string | null> {
  const u = await db.selectFrom('users').select('email').where('id', '=', userId).where('active', '=', true).executeTakeFirst();
  return u?.email ?? null;
}

/**
 * What a mail needs about each booking — room name (the room's current version), booker and attendee emails —
 * read in three queries however many bookings there are. Attendees are ordered by email, as the booking
 * services order them. Keyed by booking id.
 */
export async function loadSnapshots(db: Kysely<Database>, rows: BookingRowForMail[]): Promise<Map<string, BookingSnapshot>> {
  const out = new Map<string, BookingSnapshot>();
  if (rows.length === 0) return out;
  const rooms = new Map(
    (
      await db
        .selectFrom('meeting_rooms as r')
        .innerJoin('meeting_room_versions as v', 'v.id', 'r.current_version_id')
        .select(['r.id', 'v.name'])
        .where('r.id', 'in', [...new Set(rows.map((r) => r.room_id))])
        .execute()
    ).map((r) => [r.id, r.name]),
  );
  const bookers = new Map(
    (
      await db
        .selectFrom('users')
        .select(['id', 'email'])
        .where('id', 'in', [...new Set(rows.map((r) => r.booked_by))])
        .where('active', '=', true) // ADR-017 · T5 F5: a booker masked (inactive) is not mailed
        .execute()
    ).map((u) => [u.id, u.email]),
  );
  const attendees = await db
    .selectFrom('booking_attendees as a')
    .innerJoin('users as u', 'u.id', 'a.user_id')
    .select(['a.booking_id', 'u.email'])
    .where('u.active', '=', true) // ADR-017 · DEF-06: an attendee masked (inactive) is not mailed
    .where('a.booking_id', 'in', rows.map((r) => r.id))
    .orderBy('u.email')
    .execute();
  for (const b of rows) {
    out.set(b.id, {
      title: b.title,
      roomName: rooms.get(b.room_id) ?? '',
      startAt: b.start_at,
      endAt: b.end_at,
      bookerEmail: bookers.get(b.booked_by) ?? null,
      attendeeEmails: attendees.filter((a) => a.booking_id === b.id).map((a) => a.email),
    });
  }
  return out;
}
