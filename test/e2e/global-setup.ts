import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, request, type Browser, type FullConfig } from '@playwright/test';
import { ACCOUNTS, FACILITIES, ROOMS } from './support/accounts';
import { ensureMailUp } from './support/mail';

const MAILPIT = 'http://localhost:8025';
const BASE = 'http://localhost:4173';
const EMAIL = 'tester@mrr.local';

const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-F', '|', '-c', sql], { encoding: 'utf8' }).trim();

/** The six digits of the newest sign-in email sent to `to`. */
async function codeFromMail(to: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/messages`)).json();
    const mine = (list.messages ?? []).find((m: { To: { Address: string }[] }) => m.To.some((t) => t.Address === to));
    if (mine) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${mine.ID}`)).json();
      const m = /(\d{6})/.exec(msg.Text as string);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no sign-in email for ${to} reached mailpit`);
}

/** Signs in through the real screens (ask for a code → read it from mailpit → verify) and saves the session. */
async function signIn(browser: Browser, email: string, stateFile: string) {
  // A time-travel test (support/clock.ts) can leave codes stamped in the future; sign-in reads the newest by issued_at.
  psql('delete from login_codes where issued_at > now()');
  psql("update login_codes set status='EXPIRED' where status='ISSUED'");
  await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });
  const page = await browser.newPage({ baseURL: BASE, timezoneId: 'Asia/Bangkok' });
  await page.goto('/UI-mrr-001');
  await page.getByTestId('ui-mrr-001-org-email').fill(email);
  await page.getByTestId('ui-mrr-001-request-code').click();
  await page.getByTestId('ui-mrr-002-otp-code').waitFor();
  await page.getByTestId('ui-mrr-002-otp-code').fill(await codeFromMail(email));
  await page.getByTestId('ui-mrr-002-verify').click();
  await page.waitForURL('**/UI-mrr-004');
  await page.context().storageState({ path: stateFile });
  await page.close();
}

const sqlText = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Signs in once as the general user (and the T1 role accounts) through the real screens and saves the sessions for the specs. */
export default async function globalSetup(_config: FullConfig) {
  mkdirSync('.auth', { recursive: true });
  await ensureMailUp(); // a run that stopped inside a mail-down case leaves mailpit stopped
  // A run that stopped halfway can leave the app's clock moved (support/clock.ts); put it back before signing in.
  await fetch('http://localhost:3000/__test/clock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"now":null}' }).catch(() => undefined);

  // The 51 report-paging rooms (support/report-fixture.ts, EX-mrr-128) are ACTIVE only while their case runs; a run that stopped halfway
  // would leave them ACTIVE and push other cases' room lists past one page.
  psql("update meeting_rooms set status = 'ARCHIVED' where code like 'E2E-PGR-%'");
  // Bookings made by earlier runs cannot be deleted (their audit trail is append-only, BR-mrr-018), so on the E2E rooms
  // they pile up until no free hour is left — then `book()` has to move days and the cases that set the clock first
  // break. Cancelling them (a status change; the audit rows stay) gives the hours back. Only synthetic rows (title
  // starts with E2E), and not the report fixture, which lives in the past and is re-seeded by its own spec.
  psql(
    "update bookings set status = 'CANCELLED', cancel_reason = coalesce(cancel_reason, 'E2E cleanup') " +
      "where title like 'E2E%' and title not like 'E2E RPT%' and end_at > now() and status in ('CONFIRMED', 'APPROVED', 'PENDING_APPROVAL')",
  );

  // Rooms by their settings, not by name: the specs read them from here. The E2E rooms are left out so
  // "the first room" stays what it was before they existed.
  const rooms = psql(
    'select r.id, v.capacity, v.requires_approval from meeting_rooms r join meeting_room_versions v on v.id = r.current_version_id ' +
      "where r.status = 'ACTIVE' and r.code not like 'E2E-%' order by v.requires_approval, v.capacity",
  )
    .split('\n')
    .map((row) => row.split('|'))
    .map(([id, capacity, approval]) => ({ id, capacity: Number(capacity), requiresApproval: approval === 't' }));
  writeFileSync('.auth/rooms.json', JSON.stringify(rooms));

  // The T1 accounts (docs/qa/t1-test-cases.md §C). Idempotent: an existing row keeps its id and is brought to this state.
  for (const a of ACCOUNTS.filter((x) => x.seed)) {
    psql(
      `insert into users (email, full_name, role, active) values (${sqlText(a.email)}, ${sqlText(a.fullName)}, '${a.role}', ${a.active}) ` +
        `on conflict (email) do update set full_name = excluded.full_name, role = excluded.role, active = excluded.active`,
    );
  }

  const browser = await chromium.launch();
  await signIn(browser, EMAIL, '.auth/tester.json');
  for (const a of ACCOUNTS.filter((x) => x.signIn)) await signIn(browser, a.email, `.auth/${a.key}.json`);
  await browser.close();

  const users: Record<string, { id: string; email: string }> = {};
  for (const a of ACCOUNTS) users[a.key] = { id: psql(`select id from users where email = ${sqlText(a.email)}`), email: a.email };

  // The E2E rooms are made once, through the admin API as ra1, so they are rooms like any other.
  const admin = await request.newContext({ baseURL: BASE, storageState: '.auth/ra1.json' });
  const roomIds: Record<string, string> = {};
  for (const r of ROOMS) {
    let id = psql(`select id from meeting_rooms where code = ${sqlText(r.code)}`);
    if (!id) {
      const res = await admin.post('/rooms', {
        data: {
          code: r.code, name: r.name, capacity: 99, photos: [], facilityIds: [], requiresApproval: r.requiresApproval,
          approverId: r.approver ? users[r.approver].id : null,
        },
      });
      if (res.status() >= 300) throw new Error(`could not create room ${r.code}: ${res.status()} ${await res.text()}`);
      id = psql(`select id from meeting_rooms where code = ${sqlText(r.code)}`);
    }
    roomIds[r.key] = id;
  }
  // Facilities for the cases that need equipment (BR-mrr-002; docs/qa/t1-test-cases.md §C item 6). Dev has none of its own, and a
  // facility cannot be deleted — only taken out of use — so these two stay. Made once by name, through the admin API as ra1.
  for (const name of FACILITIES) {
    if (psql(`select count(*) from facilities where name = ${sqlText(name)}`) !== '0') continue;
    const res = await admin.post('/facilities', { data: { name } });
    if (res.status() >= 300) throw new Error(`could not create facility ${name}: ${res.status()} ${await res.text()}`);
  }
  await admin.dispose();
  writeFileSync('.auth/world.json', JSON.stringify({ users, rooms: roomIds }));

  // Leave nothing behind for the specs: an unused code blocks a new request (409 · BR-mrr-025).
  psql("update login_codes set status='EXPIRED' where status='ISSUED'");
  await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });
}
