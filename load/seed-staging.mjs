// Seeds the staging-like stack (docker/docker-compose.staging.yml) for the NFR-mrr-002 load cases.
// Synthetic data only: users load001..loadNNN@mrr.local, rooms LOADRM-NN, bookings titled "LOAD ...".
// Writes load/.seed.json (session tokens + room ids; git-ignored). Sessions idle out after 30 minutes
// (sessions.service.ts), so re-run with --sessions-only right before each k6 run.
//   node load/seed-staging.mjs [--users 201] [--rooms 50] [--bookings 50000] [--sessions-only]
// Volume defaults follow the design's NFR-mrr-002 condition (.aeon/design/nfr.json): 50 rooms and about 50,000 accumulated
// bookings over 2 years. The real staging's own size is still [TBD]. The current week is filled densely (the calendar view reads it);
// the other ~730 days before it are filled thinly so the table reaches the target size.
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const USERS = Number(arg('users', 201));
const ROOMS = Number(arg('rooms', 50));
const TARGET = Number(arg('bookings', 50000));
const WEEK_FILL = 0.6; // share of the 8 one-hour slots (09-17) taken in the current week
const HISTORY_DAYS = 730;
const HISTORY_FILL = Math.max(0, (TARGET - ROOMS * 7 * 8 * WEEK_FILL) / (ROOMS * HISTORY_DAYS * 8));
const SESSIONS_ONLY = process.argv.includes('--sessions-only');
const CONTAINER = process.env.STG_DB_CONTAINER ?? 'mrr-staging-db-1';

const psql = (sql) =>
  execFileSync('docker', ['exec', '-i', CONTAINER, 'psql', '-U', 'mrr', '-d', 'mrr', '-v', 'ON_ERROR_STOP=1', '-At', '-F', '|'], { input: sql, encoding: 'utf8' }).trim();

if (!SESSIONS_ONLY) {
  psql(`
BEGIN;
DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'load%@mrr.local');
DELETE FROM booking_attendees WHERE booking_id IN (SELECT b.id FROM bookings b JOIN meeting_rooms r ON r.id=b.room_id WHERE r.code LIKE 'LOADRM-%');
DELETE FROM booking_audit_entries WHERE booking_id IN (SELECT b.id FROM bookings b JOIN meeting_rooms r ON r.id=b.room_id WHERE r.code LIKE 'LOADRM-%');
DELETE FROM bookings WHERE room_id IN (SELECT id FROM meeting_rooms WHERE code LIKE 'LOADRM-%');
DELETE FROM meeting_room_versions WHERE room_id IN (SELECT id FROM meeting_rooms WHERE code LIKE 'LOADRM-%');
DELETE FROM meeting_rooms WHERE code LIKE 'LOADRM-%';
SELECT setseed(0.42);
INSERT INTO users (email, full_name, role)
  SELECT 'load' || lpad(i::text, 3, '0') || '@mrr.local', 'Load User ' || i, 'GENERAL_USER' FROM generate_series(1, ${USERS}) i
  ON CONFLICT (email) DO NOTHING;
INSERT INTO users (email, full_name, role) VALUES ('load-admin@mrr.local', 'Load Admin', 'ROOM_ADMINISTRATOR') ON CONFLICT (email) DO NOTHING;
WITH r AS (SELECT gen_random_uuid() rid, gen_random_uuid() vid, i FROM generate_series(1, ${ROOMS}) i),
     mr AS (INSERT INTO meeting_rooms (id, code, current_version_id, status)
            SELECT rid, 'LOADRM-' || lpad(i::text, 2, '0'), vid, 'ACTIVE' FROM r RETURNING id)
INSERT INTO meeting_room_versions (id, room_id, version_no, name, capacity, requires_approval, created_by)
  SELECT vid, rid, 1, 'Load Room ' || i, 4 + (i % 12) * 2, false, (SELECT id FROM users WHERE email = 'load-admin@mrr.local') FROM r;
-- One-hour slots 09:00-17:00 (Asia/Bangkok), never overlapping. Current week (Mon-Sun): ${WEEK_FILL * 100}% of slots; the ${HISTORY_DAYS} days before it: ${(HISTORY_FILL * 100).toFixed(2)}%.
INSERT INTO bookings (room_id, room_version_id, booked_by, title, start_at, end_at, status)
  SELECT m.id, m.current_version_id,
         u.a[1 + floor(random() * cardinality(u.a))::int],
         'LOAD ' || m.code || ' ' || d.d || ' ' || h.h,
         ((d.d + make_interval(hours => h.h)) AT TIME ZONE 'Asia/Bangkok'),
         ((d.d + make_interval(hours => h.h + 1)) AT TIME ZONE 'Asia/Bangkok'),
         'CONFIRMED'
  FROM meeting_rooms m
  CROSS JOIN (SELECT array_agg(id ORDER BY email) a FROM users WHERE email ~ '^load[0-9]{3}@mrr.local$') u
  CROSS JOIN (SELECT (date_trunc('week', (now() AT TIME ZONE 'Asia/Bangkok'))::date + g)::timestamp d, g FROM generate_series(-${HISTORY_DAYS}, 6) g) d
  CROSS JOIN generate_series(9, 16) h
  WHERE m.code LIKE 'LOADRM-%' AND random() < (CASE WHEN d.g >= 0 THEN ${WEEK_FILL} ELSE ${HISTORY_FILL} END);
COMMIT;`);
}

// Sessions: tokens are chosen here, only their sha256 is stored (tokens.ts). Written fresh so last_seen_at is within 30 minutes.
const rooms = psql(`SELECT id FROM meeting_rooms WHERE code LIKE 'LOADRM-%' ORDER BY code`).split('\n').filter(Boolean);
if (rooms.length === 0) throw new Error('no LOADRM rooms - run without --sessions-only first');
const users = psql(`SELECT id || '|' || email FROM users WHERE email ~ '^load[0-9]{3}@mrr.local$' ORDER BY email`).split('\n').filter(Boolean);
const tokens = users.map((u) => ({ email: u.split('|')[1], token: randomBytes(32).toString('base64url'), id: u.split('|')[0] }));
const values = tokens.map((t) => `('${createHash('sha256').update(t.token).digest('hex')}','${t.id}',now(),now())`).join(',');
psql(`BEGIN; DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email ~ '^load[0-9]{3}@mrr.local$'); INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at) VALUES ${values}; COMMIT;`);

const monday = psql(`SELECT date_trunc('week', (now() AT TIME ZONE 'Asia/Bangkok'))::date`);
const counts = psql(`SELECT (SELECT count(*) FROM bookings b JOIN meeting_rooms r ON r.id=b.room_id WHERE r.code LIKE 'LOADRM-%'), (SELECT count(*) FROM sessions)`);
writeFileSync(new URL('./.seed.json', import.meta.url), JSON.stringify({ seededAt: new Date().toISOString(), date: monday, rooms, tokens: tokens.map((t) => t.token) }));
console.log(`users ${tokens.length} · rooms ${rooms.length} · date ${monday} · bookings|sessions ${counts}`);
