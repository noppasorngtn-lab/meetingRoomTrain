import { execFileSync } from 'node:child_process';
import { world } from './world';

/**
 * Report fixture — the rooms A–E of GD-mrr-001 / EX-mrr-084–087 (docs/qa/t1-test-cases.md §C row 7).
 *
 * The report ranks EVERY room in use, so two cases that share a month would rank each other's rooms (D's 50.00% would
 * land between B and A in EX-084). Each case therefore gets its own month. The months are long past (no real booking
 * is there) and each starts on a Thursday with 31 days — the calendar of Oct 2026 the EX are written against — so
 * "5/10", "19–23/10", "30/10 Fri", "31/10 Sat" and the 22 weekdays / 13,200 operating minutes all hold unchanged.
 *
 * Bookings go in by SQL: they are in the past, which the booking API refuses. They are made again on every run
 * (`seedReportFixture`), so a case that changed one starts from the same data next time. Issued reports are
 * append-only and stay (BR-mrr-015); the specs read issue numbers from the answers, never assume them.
 */
export const MONTHS = {
  rank: '2009-10', // EX-084 — rooms A, B
  boundary: '2015-10', // EX-085 — room C
  maintenance: '2020-10', // EX-086 — room D
  closed: '2019-08', // EX-087 — room E
  issues: '2018-03', // EX-047–049 · 072 — rooms A, B
  // BR-mrr-006@v2 (CHG-mrr-004): rooms with the same percentage share a rank. Each month starts on a Thursday and has 31 days,
  // like Oct 2026, so "5/<month>" is a Monday and the 22 weekdays / 13,200 operating minutes hold.
  tieTop: '2007-03', // EX-125 — rooms A, B (60 min each), D (nothing)
  tieBoundary: '2008-05', // EX-126 — rooms F (60 min), G (59), H (58)
  tieClosed: '2010-07', // EX-127 — rooms A, B (60 min each), C (nothing), E closed all month
} as const;

const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-c', sql], { encoding: 'utf8' }).trim();

const TITLE = 'E2E RPT fixture';
export const ROOM_NAME = {
  A: 'E2E Rpt A', B: 'E2E Rpt B', C: 'E2E Rpt C', D: 'E2E Rpt D', E: 'E2E Rpt E', F: 'E2E Rpt F', G: 'E2E Rpt G', H: 'E2E Rpt H',
} as const;
type Letter = keyof typeof ROOM_NAME;
const roomKey = (l: Letter) => `rpt${l}`;

type Status = 'CONFIRMED' | 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED' | 'CANCELLED';
interface Booking { room: Letter; month: string; day: number; from: string; to: string; status: Status }

const pad = (n: number) => String(n).padStart(2, '0');
const isWeekday = (month: string, day: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  return d >= 1 && d <= 5;
};
const daysOf = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
export const weekdays = (month: string) => Array.from({ length: daysOf(month) }, (_, i) => i + 1).filter((d) => isWeekday(month, d));

const at = (month: string, day: number, hhmm: string) => `${month}-${pad(day)} ${hhmm}:00+07`;
const sqlText = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Every weekday of the month, `from`–`to`, one booking each. */
const everyWeekday = (room: Letter, month: string, from: string, to: string, status: Status, skip: number[] = []): Booking[] =>
  weekdays(month).filter((d) => !skip.includes(d)).map((day) => ({ room, month, day, from, to, status }));

function bookings(): Booking[] {
  const M = MONTHS;
  return [
    // EX-084 — A: 09:00–12:20 on every weekday (200 × 22 = 4,400) + two of the three that do not count (the pending one: see withPendingBooking)
    ...everyWeekday('A', M.rank, '09:00', '12:20', 'CONFIRMED'),
    { room: 'A', month: M.rank, day: 5, from: '13:00', to: '15:00', status: 'CANCELLED' },
    { room: 'A', month: M.rank, day: 7, from: '13:00', to: '14:00', status: 'REJECTED' },
    // B: 08:00–14:40 on every weekday (400 × 22 = 8,800); half of them approved, half needing no approval
    ...everyWeekday('B', M.rank, '08:00', '14:40', 'CONFIRMED').filter((_, i) => i % 2 === 0),
    ...everyWeekday('B', M.rank, '08:00', '14:40', 'APPROVED').filter((_, i) => i % 2 === 1),
    // EX-085 — C: Fri 30/10 17:00–19:00 and Sat 31/10 10:00–12:00
    { room: 'C', month: M.boundary, day: 30, from: '17:00', to: '19:00', status: 'CONFIRMED' },
    { room: 'C', month: M.boundary, day: 31, from: '10:00', to: '12:00', status: 'CONFIRMED' },
    // EX-086 — D: closed 19–23/10 (below); kept booking 21/10 10:00–11:00; the other 17 weekdays 08:00–13:00 (300 × 17 = 5,100)
    { room: 'D', month: M.maintenance, day: 21, from: '10:00', to: '11:00', status: 'CONFIRMED' },
    ...everyWeekday('D', M.maintenance, '08:00', '13:00', 'CONFIRMED', [19, 20, 21, 22, 23]),
    // EX-087 — E: closed all month (below); kept booking 5/10 10:00–11:00
    { room: 'E', month: M.closed, day: 5, from: '10:00', to: '11:00', status: 'CONFIRMED' },
    // EX-047–049 · 072 — A one hour, B four hours (so B stays rank 1 whatever case 047/049 do to A)
    { room: 'A', month: M.issues, day: 15, from: '10:00', to: '11:00', status: 'CONFIRMED' },
    { room: 'B', month: M.issues, day: 15, from: '10:00', to: '14:00', status: 'CONFIRMED' },
    // EX-125 — A 5th 10:00–11:00 and B 6th 10:00–11:00 (60 min each = 0.45%); D has no booking (0.00%)
    { room: 'A', month: M.tieTop, day: 5, from: '10:00', to: '11:00', status: 'CONFIRMED' },
    { room: 'B', month: M.tieTop, day: 6, from: '10:00', to: '11:00', status: 'CONFIRMED' },
    // EX-126 — F 60, G 59, H 58 minutes on the 5th: 0.4545 and 0.4469 both round to 0.45, 0.4393 to 0.44
    { room: 'F', month: M.tieBoundary, day: 5, from: '10:00', to: '11:00', status: 'CONFIRMED' },
    { room: 'G', month: M.tieBoundary, day: 5, from: '10:00', to: '10:59', status: 'CONFIRMED' },
    { room: 'H', month: M.tieBoundary, day: 5, from: '10:00', to: '10:58', status: 'CONFIRMED' },
    // EX-127 — A and B 60 minutes each; C nothing; E is closed all month (below) and has no booking
    { room: 'A', month: M.tieClosed, day: 5, from: '10:00', to: '11:00', status: 'CONFIRMED' },
    { room: 'B', month: M.tieClosed, day: 5, from: '10:00', to: '11:00', status: 'CONFIRMED' },
  ];
}

/** Closed periods, [from, to) as Bangkok midnights. */
const closures = [
  { room: 'D' as Letter, from: `${MONTHS.maintenance}-19 00:00:00+07`, to: `${MONTHS.maintenance}-24 00:00:00+07` }, // 19–23, Mon–Fri
  { room: 'E' as Letter, from: `${MONTHS.closed}-01 00:00:00+07`, to: `2019-09-01 00:00:00+07` }, // the whole month
  { room: 'E' as Letter, from: `${MONTHS.tieClosed}-01 00:00:00+07`, to: `2010-08-01 00:00:00+07` }, // EX-127: the whole month
];

const roomId = (l: Letter) => world.rooms[roomKey(l)];

/** Puts the fixture back to its starting data. Safe to run again and again. */
export function seedReportFixture() {
  const rooms = (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as Letter[]).map((l) => sqlText(roomId(l))).join(',');
  psql(`delete from bookings where room_id in (${rooms}) and title = ${sqlText(TITLE)}`);
  psql(`delete from room_maintenance_periods where room_id in (${rooms})`);

  const rows = bookings().map(
    (b) =>
      `(${sqlText(roomId(b.room))}, ${sqlText(at(b.month, b.day, b.from))}, ${sqlText(at(b.month, b.day, b.to))}, '${b.status}')`,
  );
  psql(
    `insert into bookings (room_id, room_version_id, booked_by, title, start_at, end_at, status) ` +
      `select r.id, r.current_version_id, ${sqlText(world.users.rpt.id)}, ${sqlText(TITLE)}, v.s::timestamptz, v.e::timestamptz, v.st ` +
      `from (values ${rows.join(',')}) as v(room, s, e, st) join meeting_rooms r on r.id = v.room::uuid`,
  );
  for (const c of closures) {
    psql(
      `insert into room_maintenance_periods (room_id, start_at, end_at, set_by) values ` +
        `(${sqlText(roomId(c.room))}, ${sqlText(c.from)}::timestamptz, ${sqlText(c.to)}::timestamptz, ${sqlText(world.users.ra1.id)})`,
    );
  }
}

/** EX-047/049: "booking data changed after an issue" — A's one-hour meeting of the `issues` month becomes two hours. */
export function changeIssuesBooking() {
  psql(
    `update bookings set end_at = start_at + interval '120 minutes' where title = ${sqlText(TITLE)} ` +
      `and room_id = ${sqlText(roomId('A'))} and start_at = ${sqlText(at(MONTHS.issues, 15, '10:00'))}::timestamptz`,
  );
}

/** Back to the one hour the fixture starts with. */
export function resetIssuesBooking() {
  psql(
    `update bookings set end_at = start_at + interval '60 minutes' where title = ${sqlText(TITLE)} ` +
      `and room_id = ${sqlText(roomId('A'))} and start_at = ${sqlText(at(MONTHS.issues, 15, '10:00'))}::timestamptz`,
  );
}

/** Raw statement for the "the table itself refuses" checks. */
export const sql = psql;

/**
 * EX-084's third booking that does not count, 'รออนุมัติ' 6/10 13:00–14:00. A pending booking whose start has passed is
 * cancelled by the api's own timer within a minute (BR-mrr-016) — and mailed about — so it exists only for the moment
 * the report is issued: `during` runs with it in place and it is removed afterwards, whatever happens.
 */
export async function withPendingBooking<T>(during: () => Promise<T>): Promise<T> {
  const where = `title = ${sqlText(TITLE)} and room_id = ${sqlText(roomId('A'))} and start_at = ${sqlText(at(MONTHS.rank, 6, '13:00'))}::timestamptz`;
  psql(`delete from bookings where ${where}`);
  psql(
    `insert into bookings (room_id, room_version_id, booked_by, title, start_at, end_at, status) ` +
      `select r.id, r.current_version_id, ${sqlText(world.users.rpt.id)}, ${sqlText(TITLE)}, ${sqlText(at(MONTHS.rank, 6, '13:00'))}::timestamptz, ` +
      `${sqlText(at(MONTHS.rank, 6, '14:00'))}::timestamptz, 'PENDING_APPROVAL' from meeting_rooms r where r.id = ${sqlText(roomId('A'))}`,
  );
  try {
    return await during();
  } finally {
    psql(`delete from bookings where ${where}`);
  }
}
