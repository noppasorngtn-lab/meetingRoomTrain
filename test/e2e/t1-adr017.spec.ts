import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test';
import { as, book, nearSlot, stateOf, world } from './support/world';

/**
 * ADR-017 / DQ-mrr-017 (PDPA) — T1 รอบ 2026-11-24 · docs/qa/t1-adr017-2026-11-24.md (QA review ผ่านทั้ง 8 เคส)
 * ผู้ดูแลปิดบังบัญชีที่ไม่ active "นอกระบบ" (ไม่มีหน้าจอ/API) → เคสนี้แทนขั้นตอนนั้นด้วย psql:
 *   active=false · full_name=ผู้ใช้ที่ถูกปิดบังชื่อ · email=masked-<uuid>@mrr.invalid
 * ทุกเคสสร้างผู้ใช้สังเคราะห์ใหม่ (e2e.mask.*@mrr.local) ในเคสเอง — ห้ามแตะ u1/tester และบัญชีใน support/accounts.ts
 * (global-setup upsert ตาม email: ถ้าปิดบังบัญชีที่ seed ไว้ รอบหน้าจะได้แถวใหม่และแถวที่ปิดบังค้าง).
 * ผู้ใช้ที่ปิดบังแล้ว email เปลี่ยน จึงใช้ email เดิมสร้างใหม่ได้ทุกรอบ.
 * การจอง/รายงานที่สร้างค้างใน DB (ร่องรอยและรายงานเป็นแบบเพิ่มอย่างเดียว) — หัวข้อขึ้นต้น `E2E ADR017`.
 * TC-APR-UI011-103 ยังไม่เขียน: รอ Q-ADR017-3.
 * ชื่อสังเคราะห์เป็น ASCII (Thai ผ่าน `docker exec psql` กลายเป็น "????" บน Windows) ส่วนชื่อที่ปิดบังเป็นไทย — ส่งเป็น U&'\XXXX'.
 */

const MASKED_NAME = 'ผู้ใช้ที่ถูกปิดบังชื่อ';
const MAIL = 'http://localhost:8025/api/v1';
const OPTIONS_LABEL = 'ผลการค้นหาผู้ใช้';
const BASE = 'http://localhost:4173';
const RUN = Date.now().toString(36);

const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-F', '|', '-c', sql], { encoding: 'utf8' }).trim();
/** A SQL string literal that survives the Windows command line: every character as a \XXXX escape. */
const uni = (s: string) => `U&'${[...s].map((c) => '\\' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}'`;
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

type Role = 'GENERAL_USER' | 'ROOM_ADMINISTRATOR' | 'SYSTEM_ADMINISTRATOR';
interface Synthetic { id: string; email: string; fullName: string }

/** A new active user, made by SQL like global-setup does. `email` is e2e.mask.<name>@mrr.local. */
function makeUser(name: string, role: Role): Synthetic {
  const email = `e2e.mask.${name}@mrr.local`;
  const fullName = `E2E Mask ${name.toUpperCase()}`;
  psql(`insert into users (email, full_name, role, active) values (${lit(email)}, ${lit(fullName)}, '${role}', true)`);
  return { id: psql(`select id from users where email = ${lit(email)}`), email, fullName };
}

/** The admin's out-of-system step (DQ-mrr-017): returns the masked email. */
function mask(u: Synthetic): string {
  const masked = `masked-${randomUUID()}@mrr.invalid`;
  psql(`update users set active = false, full_name = ${uni(MASKED_NAME)}, email = ${lit(masked)} where id = ${lit(u.id)}`);
  expect(psql(`select active || '|' || email from users where id = ${lit(u.id)}`)).toBe(`false|${masked}`);
  return masked;
}

interface Mail { ID: string; Subject: string; To: { Address: string }[] }
async function mailsTo(address: string): Promise<Mail[]> {
  const list = (await (await fetch(`${MAIL}/messages`)).json()) as { messages?: Mail[] };
  return (list.messages ?? []).filter((m) => m.To.some((t) => t.Address === address));
}
async function codeFromMail(address: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const m = (await mailsTo(address)).find((x) => x.Subject.includes('รหัสเข้าสู่ระบบ'));
    if (m) return /(\d{6})/.exec(((await (await fetch(`${MAIL}/message/${m.ID}`)).json()) as { Text: string }).Text)![1];
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no sign-in email for ${address}`);
}

/** Signs the synthetic user in over the api (request code → read it from mailpit → verify) and returns its client. */
async function signInAs(u: Synthetic): Promise<APIRequestContext> {
  psql("update login_codes set status='EXPIRED' where status='ISSUED'");
  const api = await request.newContext({ baseURL: BASE });
  const ask = await api.post('/auth/otp/request', { data: { email: u.email } });
  expect(ask.status(), await ask.text()).toBeLessThan(300);
  const verify = await api.post('/auth/otp/verify', { data: { email: u.email, code: await codeFromMail(u.email) } });
  expect(verify.status(), await verify.text()).toBeLessThan(300);
  return api;
}

const clients: Record<string, APIRequestContext> = {};
test.beforeAll(async () => {
  for (const k of ['u1', 'u2', 'ra1', 'sa']) clients[k] = await as(k);
});
test.afterAll(async () => {
  await Promise.all(Object.values(clients).map((c) => c.dispose()));
});

const openAs = async (browser: import('@playwright/test').Browser, key: string) =>
  browser.newContext({ storageState: stateOf(key), baseURL: BASE, locale: 'th-TH', timezoneId: 'Asia/Bangkok' });

// ------------------------------------------------------------------ ปิดบังแล้ว ข้อมูลที่อ้างถึงยังอยู่ แสดงชื่อที่ปิดบัง (DQ-mrr-017)
test.describe('หลังปิดบังชื่อผู้ใช้ (DQ-mrr-017)', () => {
  test('[real] TC-AUD-UI010-115 ผู้กระทำในร่องรอยถูกปิดบังชื่อแล้ว → ร่องรอยครบ แสดงชื่อที่ปิดบัง (BR-mrr-017@v3 · ADR-017)', async ({ browser }) => {
    const ra = makeUser(`ra.${RUN}`, 'ROOM_ADMINISTRATOR');
    const raApi = await signInAs(ra);
    const b = await book(clients.u1, 'appr', nearSlot(), `E2E ADR017 audit ${RUN}`);
    expect((await raApi.post(`/bookings/${b.id}/approve`)).status()).toBeLessThan(300);
    await raApi.dispose();

    const trail = async () => (await (await clients.ra1.get(`/bookings/${b.id}/audit`)).json()) as { actor: { id: string; fullName: string } }[];
    const before = await trail();
    expect(before.length).toBeGreaterThanOrEqual(1);
    expect(before[0].actor.id).toBe(ra.id);

    const masked = mask(ra);
    expect(await trail()).toHaveLength(before.length);

    // ผู้ดู = ra1: ร่องรอยอ่านได้เฉพาะ RA/SA (booking-audit.service.ts READS_TRAIL) — ผู้จอง u1 เปิดไม่ได้ (ดูหมายเหตุในรายงาน)
    const ctx = await openAs(browser, 'ra1');
    const page = await ctx.newPage();
    await page.goto(`/UI-mrr-010?booking=${b.id}`);
    await expect(page.getByTestId('ui-mrr-010-ent-010-actor')).toHaveCount(before.length);
    await expect(page.getByTestId('ui-mrr-010-ent-010-actor').first()).toHaveText(MASKED_NAME);
    const body = await page.locator('body').innerText();
    expect(body).not.toContain(ra.fullName);
    expect(body).not.toContain(ra.email);
    expect(body).not.toContain(masked);
    await ctx.close();
  });

  test('[real] TC-APR-UI009-107 การจองรออนุมัติของผู้จองที่ถูกปิดบังชื่อ → ยังอยู่ PENDING_APPROVAL แสดงชื่อที่ปิดบัง (BR-mrr-026@v1 · ADR-017)', async ({ browser }) => {
    const gu = makeUser(`gu.${RUN}`, 'GENERAL_USER');
    const guApi = await signInAs(gu);
    const title = `E2E ADR017 pending ${RUN}`;
    const b = await book(guApi, 'appr', nearSlot(), title);
    expect(b.status).toBe('PENDING_APPROVAL');
    await guApi.dispose();

    mask(gu);

    // คิวแบ่งหน้า เรียงเริ่มใกล้สุดก่อน — หาหน้าที่การจองนี้อยู่
    let pageNo = 0;
    for (let n = 1; n <= 30 && !pageNo; n++) {
      const list = (await (await clients.ra1.get(`/bookings?status=PENDING_APPROVAL&page=${n}`)).json()) as { items: { id: string }[] };
      if (list.items.some((x) => x.id === b.id)) pageNo = n;
      if (!list.items.length) break;
    }
    expect(pageNo, 'การจองต้องยังอยู่ในคิวรออนุมัติ').toBeGreaterThan(0);

    const ctx = await openAs(browser, 'ra1');
    const page = await ctx.newPage();
    await page.goto(`/UI-mrr-009?page=${pageNo}`);
    const row = page.locator('tr', { hasText: title }).first();
    await expect(row.getByTestId('ui-mrr-009-ent-007-booked-by')).toHaveText(MASKED_NAME);
    expect((await (await clients.ra1.get(`/bookings/${b.id}`)).json()).status).toBe('PENDING_APPROVAL');
    await ctx.close();
  });

  test('[real] TC-CAL-UI005-108 ผู้เข้าร่วมในการจองของฉันถูกปิดบังชื่อ → รายชื่อมีชื่อที่ปิดบังและ u2 การจองยังแสดง (BR-mrr-026@v1 · ADR-017)', async ({ browser }) => {
    const att = makeUser(`att.${RUN}`, 'GENERAL_USER');
    const slot = nearSlot();
    const title = `E2E ADR017 cal ${RUN}`;
    const b = await book(clients.u1, 'open', slot, title, [att.id, world.users.u2.id]);
    expect(b.status).toBe('CONFIRMED');

    mask(att);

    const ctx = await openAs(browser, 'u1');
    const page = await ctx.newPage();
    await page.goto(`/UI-mrr-005?room=${world.rooms.open}&date=${slot.date}&view=day`);
    const card = page.locator('.slot', { has: page.getByText(title, { exact: true }) });
    await expect(card).toHaveCount(1);
    const people = card.getByTestId('ui-mrr-005-ent-008-user');
    await expect(people).toContainText(MASKED_NAME);
    await expect(people).toContainText('E2E User Two');
    await expect(people).not.toContainText(att.fullName);
    await ctx.close();
  });

  test('[real] TC-RPT-RPT001-115 รายงานที่ออกโดยผู้ใช้ที่ถูกปิดบังชื่อ → รายงานและตัวเลขเท่าเดิม ผู้ออก = ชื่อที่ปิดบัง (BR-mrr-015 · ADR-017)', async () => {
    const ra = makeUser(`rpt.${RUN}`, 'ROOM_ADMINISTRATOR');
    const raApi = await signInAs(ra);
    // เดือนที่ไม่ชนเดือนของ fixture ใน support/report-fixture.ts (รายงานลบไม่ได้ เลขฉบับเพิ่มทุกรอบ — อ่านจากคำตอบ)
    const month = '2005-05';
    const issued = await raApi.post('/reports/utilization', { data: { periodType: 'MONTH', periodStart: `${month}-01` } });
    expect(issued.status(), await issued.text()).toBe(201);
    const { report } = (await issued.json()) as { report: { id: string; issueNo: number; lines: unknown[]; issuedBy: { id: string; fullName: string } } };
    await raApi.dispose();
    expect(report.issuedBy.id).toBe(ra.id);

    const read = async () => {
      const res = await clients.ra1.get(`/reports/utilization?periodType=MONTH&periodStart=${month}-01&issueNo=${report.issueNo}`);
      expect(res.status(), await res.text()).toBe(200);
      return (await res.json()) as { id: string; issueNo: number; lines: unknown[]; issuedBy: { id: string; fullName: string } };
    };
    const before = await read();
    expect(before.issuedBy.fullName).toBe(ra.fullName);

    mask(ra); // แก้ users ไม่ใช่ utilization_reports จึงไม่ชน trigger เพิ่มอย่างเดียว

    const after = await read();
    expect(after.id).toBe(before.id);
    expect(after.issueNo).toBe(before.issueNo);
    expect(after.lines).toEqual(before.lines); // ตัวเลขทุกแถวเท่าเดิม
    expect(after.issuedBy.id).toBe(ra.id);
    expect(after.issuedBy.fullName).toBe(MASKED_NAME);
  });
});

// ------------------------------------------------------------------ email และ fullName เห็นได้ทั้ง 3 role (rbac fieldRules ENT-001)
test.describe('ช่องเลือกผู้ใช้แสดง fullName (email)', () => {
  const U2 = 'E2E User Two (e2e.u2@mrr.local)';

  // UI-mrr-006 เปิดได้ทุก role หรือไม่ ตรวจจากผลรัน: ถ้า RA/SA เข้าไม่ได้ เคสจะล้มที่ช่องผู้เข้าร่วมไม่ปรากฏ ไม่ใช่ที่ข้อความ
  for (const [key, label] of [['u1', 'ROLE-001 General User'], ['ra1', 'ROLE-002 Room Administrator'], ['sa', 'ROLE-003 System Administrator']] as const) {
    test(`[real] TC-BKG-UI006-110 ${label}: ช่องผู้เข้าร่วมแสดง fullName (email) (rbac fieldRules ENT-001 · ADR-017)`, async ({ browser }) => {
      const ctx = await openAs(browser, key);
      const page = await ctx.newPage();
      await page.goto(`/UI-mrr-006?room=${world.rooms.open}`);
      await page.getByTestId('ui-mrr-006-ent-008-user').fill('E2E User');
      const options = page.getByRole('list', { name: OPTIONS_LABEL });
      await expect(options.getByRole('button', { name: U2, exact: true })).toBeVisible();
      await ctx.close();
    });
  }

  test('[real] TC-RMM-UI013-113 ช่องเลือกผู้อนุมัติห้องแสดง fullName (email) ไม่บันทึกห้อง (rbac fieldRules ENT-001 · ADR-017)', async ({ browser }) => {
    const rooms = () => psql('select count(*) from meeting_rooms');
    const roomsBefore = rooms();
    const ctx = await openAs(browser, 'ra1');
    const page: Page = await ctx.newPage();
    await page.goto('/UI-mrr-013');
    await page.getByTestId('ui-mrr-013-ent-003-requires-approval').check();
    await page.getByTestId('ui-mrr-013-ent-003-approver').fill('E2E Room');
    await expect(
      page.getByRole('list', { name: OPTIONS_LABEL }).getByRole('button', { name: 'E2E Room Admin Two (e2e.ra2@mrr.local)', exact: true }),
    ).toBeVisible();
    await ctx.close();
    expect(rooms()).toBe(roomsBefore);
  });
});

// ------------------------------------------------------------------ ผู้ใช้ที่ถูกปิดบังเข้าสู่ระบบไม่ได้ (BR-mrr-026@v1 · EX-mrr-098/099)
test('[real] TC-AUTH-UI001-110 ขอรหัสด้วย email เดิมและ email ที่ปิดบัง → ข้อความเหมือนปกติ ไม่ส่ง Email ไม่ออกรหัสใหม่ (BR-mrr-026@v1 · EX-mrr-098 · EX-mrr-099 · ADR-017)', async ({ browser }) => {
  const NOTICE = 'หากเป็น Email ในระบบ เราได้ส่งรหัสเข้าสู่ระบบไปแล้ว กรุณาตรวจสอบ Email';
  const u = makeUser(`auth.${RUN}`, 'GENERAL_USER');
  const original = u.email;
  const masked = mask(u);
  psql("update login_codes set status='EXPIRED' where status='ISSUED'");
  await fetch(`${MAIL}/messages`, { method: 'DELETE' });
  const codesBefore = psql(`select count(*) from login_codes where user_id = ${lit(u.id)}`);

  const ctx = await browser.newContext({ baseURL: BASE, locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
  const page = await ctx.newPage();
  for (const email of [original, masked]) {
    await page.goto('/UI-mrr-001');
    await page.getByTestId('ui-mrr-001-org-email').fill(email);
    await page.getByTestId('ui-mrr-001-request-code').click();
    await expect(page.getByText(NOTICE, { exact: true })).toBeVisible();
  }
  await ctx.close();

  await new Promise((r) => setTimeout(r, 3000)); // เวลาให้จดหมายถึง mailpit ก่อนยืนยันว่า "ไม่มี"
  expect(await mailsTo(original)).toHaveLength(0);
  expect(await mailsTo(masked)).toHaveLength(0);
  expect(psql(`select count(*) from login_codes where user_id = ${lit(u.id)}`)).toBe(codesBefore);
});
