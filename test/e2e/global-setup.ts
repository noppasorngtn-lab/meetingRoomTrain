import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, type FullConfig } from '@playwright/test';

const MAILPIT = 'http://localhost:8025';
const EMAIL = 'tester@mrr.local';

const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-F', '|', '-c', sql], { encoding: 'utf8' }).trim();

async function codeFromMail(): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/messages`)).json();
    if (list.messages?.length) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json();
      const m = /(\d{6})/.exec(msg.Text as string);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('no sign-in email reached mailpit');
}

/** Signs in once as the general user through the real screens and saves the session for the specs. */
export default async function globalSetup(config: FullConfig) {
  mkdirSync('.auth', { recursive: true });
  // An unused code blocks a new request (409 · BR-mrr-025); a run that stopped half-way leaves one.
  psql("update login_codes set status='EXPIRED' where status='ISSUED'");
  await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });

  // Rooms by their settings, not by name: the specs read them from here.
  const rooms = psql(
    'select r.id, v.capacity, v.requires_approval from meeting_rooms r join meeting_room_versions v on v.id = r.current_version_id ' +
      "where r.status = 'ACTIVE' order by v.requires_approval, v.capacity",
  )
    .split('\n')
    .map((row) => row.split('|'))
    .map(([id, capacity, approval]) => ({ id, capacity: Number(capacity), requiresApproval: approval === 't' }));
  writeFileSync('.auth/rooms.json', JSON.stringify(rooms));

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: config.projects[0].use.baseURL, timezoneId: 'Asia/Bangkok' });
  await page.goto('/UI-mrr-001');
  await page.getByTestId('ui-mrr-001-org-email').fill(EMAIL);
  await page.getByTestId('ui-mrr-001-request-code').click();
  await page.getByTestId('ui-mrr-002-otp-code').waitFor();
  await page.getByTestId('ui-mrr-002-otp-code').fill(await codeFromMail());
  await page.getByTestId('ui-mrr-002-verify').click();
  await page.waitForURL('**/UI-mrr-004');
  await page.context().storageState({ path: '.auth/tester.json' });
  await browser.close();
}
