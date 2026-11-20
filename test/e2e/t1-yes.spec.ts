import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { myBookingsPageOf } from './support/my-bookings';

/**
 * เคสจาก T1 (docs/qa/t1-test-cases.csv) ที่ Automation = Yes — เขียนสคริปต์ได้ด้วย dev stack ตอนนี้
 * (ผู้ใช้ล็อกอินคนเดียว = General User `tester@mrr.local`). ทุกเคสเป็น [real]: คุยกับ API/DB/mailpit จริง
 * ชื่อเคสขึ้นต้นด้วย TC ID ของ T1 และระบุ EX ที่พิสูจน์. ข้อมูลสังเคราะห์ หัวข้อขึ้นต้น `E2E`.
 */

const MAILPIT = 'http://localhost:8025';
const EMAIL = 'tester@mrr.local';
const UNLISTED = 'e2e.unlisted@mrr.local'; // ไม่อยู่ในรายชื่อ HR (BR-mrr-026)
const REQUESTED = 'หากเป็น Email ในระบบ เราได้ส่งรหัสเข้าสู่ระบบไปแล้ว กรุณาตรวจสอบ Email';

interface RoomRow { id: string; capacity: number; requiresApproval: boolean }
const rooms: RoomRow[] = JSON.parse(readFileSync('.auth/rooms.json', 'utf8'));
const open = rooms.find((r) => !r.requiresApproval)!;

const RUN = Date.now().toString(36);
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * วันใกล้ (2-29 วัน) ซึ่งเคสใน booking.spec ไม่ใช้ (30-730) — "การจองของฉัน" เรียงเริ่มล่าสุดก่อน
 * การจองของไฟล์นี้จึงอยู่ท้ายรายการ ไม่ไปบังแถวที่ booking.spec ต้องหาเจอในหน้าแรก. ชั่วโมงสุ่มลดโอกาสชนกัน.
 */
function nearSlot() {
  const hour = 6 + Math.floor(Math.random() * 14);
  const d = new Date(Date.now() + (2 + Math.floor(Math.random() * 28)) * 86_400_000);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { startAt: `${date}T${pad(hour)}:00:00+07:00`, endAt: `${date}T${pad(hour + 1)}:00:00+07:00` };
}

const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-c', sql], { encoding: 'utf8' }).trim();

interface Mail { ID: string; Subject: string; To: { Address: string }[] }
const mails = async (): Promise<Mail[]> => ((await (await fetch(`${MAILPIT}/api/v1/messages`)).json()).messages ?? []) as Mail[];
const clearMail = () => fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });
const mailText = async (id: string): Promise<string> => (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()).Text as string;

async function waitMail(match: (m: Mail) => boolean, tries = 20): Promise<Mail | undefined> {
  for (let i = 0; i < tries; i++) {
    const found = (await mails()).find(match);
    if (found) return found;
    await new Promise((r) => setTimeout(r, 500));
  }
  return undefined;
}

/** รหัส 6 หลัก + magic link จาก Email รหัสเข้าสู่ระบบฉบับล่าสุดของผู้ใช้ */
async function signInMail(to: string) {
  const m = await waitMail((x) => x.To.some((t) => t.Address === to) && x.Subject.includes('รหัสเข้าสู่ระบบ'));
  expect(m, `ไม่พบ Email รหัสเข้าสู่ระบบถึง ${to} ใน mailpit`).toBeDefined();
  const text = await mailText(m!.ID);
  return { code: /(\d{6})/.exec(text)![1], link: /(https?:\/\/\S+magic-link\?token=\S+)/.exec(text)![1] };
}

/** เครื่องใหม่ที่ยังไม่ล็อกอิน (ไม่ใช้ session ของ tester) */
async function newDevice(browser: Browser) {
  const ctx = await browser.newContext({ locale: 'th-TH', timezoneId: 'Asia/Bangkok', baseURL: 'http://localhost:4173' });
  return { ctx, page: await ctx.newPage() };
}

async function askCode(page: Page, email: string) {
  await page.goto('/UI-mrr-001');
  await page.getByTestId('ui-mrr-001-org-email').fill(email);
  await page.getByTestId('ui-mrr-001-request-code').click();
  await expect(page).toHaveURL(/\/UI-mrr-002/);
}

const verify = async (page: Page, code: string) => {
  await page.getByTestId('ui-mrr-002-otp-code').fill(code);
  await page.getByTestId('ui-mrr-002-verify').click();
};

const wrongCodeOf = (code: string) => [...code].map((d) => String((Number(d) + 1) % 10)).join('');

/** แต่ละเคสเริ่มจาก "ไม่มีรหัสที่ใช้ได้ค้างอยู่" และกล่องจดหมายว่าง (BR-mrr-025 กันการขอซ้ำ) */
async function cleanSignInState() {
  psql("update login_codes set status='EXPIRED' where status='ISSUED'");
  await clearMail();
}

// ---------------------------------------------------------------- ใช้ session ของ tester (General User)
test.describe('General User — การจองของฉัน / ห้อง / รายงาน', () => {
  test.use({ storageState: '.auth/tester.json' });

  // ลบการจองที่เคสในกลุ่มนี้สร้าง (หัวข้อมี RUN) — ไม่ทิ้งแถวไว้ดันแถวของ booking.spec ออกจากหน้าแรกของ UI-mrr-007
  test.afterAll(() => {
    const mine = `select id from bookings where title like 'E2E%${RUN}'`;
    for (const t of ['booking_attendees', 'booking_equipment_requests', 'booking_audit_entries', 'booking_adjustment_requests']) {
      psql(`delete from ${t} where booking_id in (${mine})`);
    }
    psql(`delete from bookings where title like 'E2E%${RUN}'`);
  });

  async function createBooking(page: Page, title: string) {
    const users = await (await page.request.get('/users?query=admin')).json();
    expect(users.length, 'dev ต้องมีผู้ใช้อย่างน้อยหนึ่งคนให้เลือกเป็นผู้เข้าร่วม').toBeGreaterThan(0);
    // A random slot can land on one an earlier run or another case already holds: on "room not free" (409) take a new
    // slot and try again, as `book()` in support/world.ts does. Any other answer fails the test with the response body.
    let res;
    for (let attempt = 1; ; attempt++) {
      const s = nearSlot();
      res = await page.request.post('/bookings', {
        data: { roomId: open.id, startAt: s.startAt, endAt: s.endAt, title, attendeeIds: [users[0].id], equipmentIds: [] },
      });
      if (res.status() === 409 && attempt < 10 && (await res.text()).includes('ไม่ว่าง')) continue;
      break;
    }
    expect(res.status(), await res.text()).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    return { id: body.id as string };
  }

  /** หน้าของ "การจองของฉัน" ที่การจองนี้อยู่ — เดินทุกหน้าตามจำนวนรวมที่ api บอก (ดู support/my-bookings.ts) */
  const pageOf = (page: Page, id: string) => myBookingsPageOf(page.request, id);

  test('[real] precondition: ผู้ใช้ที่ล็อกอินเป็น General User', async ({ page }) => {
    const me = await (await page.request.get('/auth/me')).json();
    expect(me.role).toBe('GENERAL_USER');
  });

  test('[real] TC-MYB-UI008-101 แก้หัวข้อการจองของตัวเอง → บันทึกสำเร็จ (EX-mrr-008 · BR-mrr-003)', async ({ page }) => {
    const { id } = await createBooking(page, `E2E แก้หัวข้อ ${RUN}`);
    const newTitle = `E2E ประชุมวางแผน ${RUN}`;
    await page.goto(`/UI-mrr-008?booking=${id}`);
    await page.getByTestId('ui-mrr-008-ent-007-title').fill(newTitle);
    const saved = page.waitForResponse((r) => r.url().endsWith(`/bookings/${id}`) && r.request().method() === 'PATCH');
    await page.getByTestId('ui-mrr-008-save').click();
    expect((await saved).status()).toBe(200);
    await expect(page).toHaveURL(/\/UI-mrr-007/);
    await expect(page.getByText('บันทึกการแก้ไขสำเร็จ', { exact: true })).toBeVisible();
    // การจองอยู่ท้ายรายการ (ไม่ใช่หน้าแรกของ UI-mrr-007) จึงตรวจค่าที่บันทึกผ่าน API
    expect((await (await page.request.get(`/bookings/${id}`)).json()).title).toBe(newTitle);
  });

  test('[real] TC-NTF-UI008-102 แก้เฉพาะหัวข้อ → บันทึกสำเร็จ และไม่มีใครได้รับ Email (EX-mrr-022 · BR-mrr-007)', async ({ page }) => {
    const { id } = await createBooking(page, `E2E แก้หัวข้อไม่ส่งเมล ${RUN}`);
    await waitMail((m) => m.Subject.includes('จองสำเร็จ')); // Email ตอนจองมาถึงก่อน แล้วค่อยล้างกล่อง
    await clearMail();
    await page.goto(`/UI-mrr-008?booking=${id}`);
    await page.getByTestId('ui-mrr-008-ent-007-title').fill(`E2E ประชุมวางแผน ${RUN}`);
    await page.getByTestId('ui-mrr-008-save').click();
    await expect(page.getByText('บันทึกการแก้ไขสำเร็จ', { exact: true })).toBeVisible();
    await new Promise((r) => setTimeout(r, 3000)); // เผื่อเวลาส่งจดหมาย ก่อนยืนยันว่า "ไม่มี"
    expect(await mails(), 'การแก้เฉพาะหัวข้อต้องไม่ส่ง Email').toHaveLength(0);
  });

  test('[real] TC-MYB-UI007-101 ผู้จองยกเลิกการจองของตัวเองก่อนเริ่ม → ยกเลิกสำเร็จ (EX-mrr-009 · BR-mrr-003)', async ({ page }) => {
    const title = `E2E ยกเลิกเอง ${RUN}`;
    const { id } = await createBooking(page, title);
    await page.goto(`/UI-mrr-007?page=${await pageOf(page, id)}`);
    const row = page.getByRole('row').filter({ hasText: title });
    await expect(row).toBeVisible();
    const cancelled = page.waitForResponse((r) => r.url().endsWith(`/bookings/${id}/cancel`));
    await row.getByTestId('ui-mrr-007-cancel').click();
    expect((await cancelled).status()).toBeLessThan(300);
    await expect(page.getByText('ยกเลิกการจองสำเร็จ', { exact: true })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: title }).getByTestId('ui-mrr-007-ent-007-status')).toHaveText('ยกเลิกแล้ว');
  });

  test('[real] TC-RMM-UI013-102 General User ส่งคำสั่งแก้ความจุห้อง → ถูกปฏิเสธ ความจุเดิมคงอยู่ (EX-mrr-017 · BR-mrr-005)', async ({ page }) => {
    const before = await (await page.request.get(`/rooms/${open.id}`)).json();
    const res = await page.request.post(`/rooms/${open.id}/versions`, {
      data: { name: before.name, capacity: before.capacity + 4, photos: [], facilityIds: [], requiresApproval: before.requiresApproval, approverId: null },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).message).toBe('เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้');
    const after = await (await page.request.get(`/rooms/${open.id}`)).json();
    expect(after.capacity).toBe(before.capacity);
  });

  test('[real] TC-RMM-UI014-101 General User เปิดหน้าสิ่งอำนวยความสะดวก → ไม่มีสิทธิ์ ไม่เห็นรายการ (EX-mrr-090 · BR-mrr-005)', async ({ page }) => {
    await page.goto('/UI-mrr-014');
    await expect(page.getByRole('alert').filter({ hasText: 'คุณไม่มีสิทธิ์เข้าหน้านี้' })).toBeVisible();
    await expect(page.getByTestId('ui-mrr-014-ent-004-name')).toHaveCount(0);
    await expect(page.getByTestId('ui-mrr-014-add')).toHaveCount(0);
  });

  test('[real] TC-RPT-RPT001-106 General User ขอรายงานการใช้ห้อง → ถูกปฏิเสธ ไม่เห็นตัวเลข (EX-mrr-074 · BR-mrr-022)', async ({ page }) => {
    const MSG = 'เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้';
    const api = await page.request.get('/reports/utilization?periodType=MONTH&periodStart=2026-10-01');
    expect(api.status()).toBe(403);
    expect((await api.json()).message).toBe(MSG);
    await page.goto('/RPT-mrr-001');
    await expect(page.getByRole('alert').filter({ hasText: MSG })).toBeVisible();
    await expect(page.getByTestId('rpt-mrr-001-ent-013-utilization-pct')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------- เข้าสู่ระบบ (เครื่องใหม่ ไม่มี session)
test.describe.serial('เข้าสู่ระบบด้วยรหัส / magic link (BR-mrr-025 · 026 · 027 · 028)', () => {
  test.beforeEach(cleanSignInState);
  test.afterEach(cleanSignInState);

  test('[real] TC-AUTH-UI001-101 ขอรหัสด้วย Email ในรายชื่อ → ข้อความกลาง และได้ Email ที่มีรหัส (EX-mrr-091 · BR-mrr-026)', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser);
    await askCode(page, EMAIL);
    await expect(page.getByRole('status').filter({ hasText: REQUESTED })).toBeVisible();
    const { code } = await signInMail(EMAIL);
    expect(code).toMatch(/^\d{6}$/);
    await ctx.close();
  });

  test('[real] TC-AUTH-UI001-108 Email นอกรายชื่อ → ข้อความเหมือนกรณีปกติทุกตัวอักษร แต่ไม่ส่ง Email (EX-mrr-098 · BR-mrr-026)', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser);
    await askCode(page, UNLISTED);
    await expect(page.getByRole('status').filter({ hasText: REQUESTED })).toHaveText(REQUESTED);
    await new Promise((r) => setTimeout(r, 3000));
    // เฉพาะจดหมายถึงอีเมลนี้ — กล่องเมลใช้ร่วมกับตัวจับเวลาเตือนของ api (เมลเตือนของการจองอื่นไม่ใช่ความผิดของเคสนี้)
    expect((await mails()).filter((m) => m.To.some((t) => t.Address === UNLISTED)), 'Email นอกรายชื่อต้องไม่ได้รับรหัส').toHaveLength(0);
    // เข้าสู่ระบบไม่ได้: ไม่มีรหัสให้กรอก ลองรหัสสมมติแล้วต้องไม่ผ่าน
    await verify(page, '123456');
    await expect(page).toHaveURL(/\/UI-mrr-002/);
    await ctx.close();
  });

  test('[real] TC-AUTH-UI002-101 กรอกรหัสถูกภายในอายุ → เข้าสู่ระบบ ไปหน้าค้นหาห้องว่างโดยไม่มีข้อความ (EX-mrr-100 · BR-mrr-027)', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser);
    await askCode(page, EMAIL);
    await verify(page, (await signInMail(EMAIL)).code);
    await expect(page).toHaveURL(/\/UI-mrr-004/);
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect((await (await page.request.get('/auth/me')).json()).role).toBeTruthy();
    await ctx.close();
  });

  test('[real] TC-AUTH-UI002-105 กรอกรหัสผิด → แจ้งรหัสไม่ถูกต้อง ไม่สร้าง session ยังอยู่หน้ากรอกรหัส (EX-mrr-104 · BR-mrr-028)', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser);
    await askCode(page, EMAIL);
    await verify(page, wrongCodeOf((await signInMail(EMAIL)).code));
    await expect(page.getByRole('alert').filter({ hasText: 'รหัสไม่ถูกต้อง กรุณาตรวจสอบรหัสใน Email แล้วกรอกใหม่' })).toBeVisible();
    await expect(page).toHaveURL(/\/UI-mrr-002/);
    expect((await page.request.get('/auth/me')).status()).toBe(401);
    await ctx.close();
  });

  test('[real] TC-AUTH-UI002-106 กรอกผิดแล้วกรอกรหัสเดิมที่ถูก → เข้าสู่ระบบได้ รหัสไม่เสียเพราะกรอกผิด (EX-mrr-105 · BR-mrr-028)', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser);
    await askCode(page, EMAIL);
    const { code } = await signInMail(EMAIL);
    await verify(page, wrongCodeOf(code));
    await expect(page.getByRole('alert')).toBeVisible();
    await verify(page, code);
    await expect(page).toHaveURL(/\/UI-mrr-004/);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await ctx.close();
  });

  test('[real] TC-AUTH-UI002-103 ใช้รหัสเข้าสู่ระบบแล้ว กรอกรหัสเดิมบนอีกเครื่อง → ใช้ไปแล้ว ไม่สร้าง session (EX-mrr-102 · BR-mrr-027)', async ({ browser }) => {
    const a = await newDevice(browser);
    await askCode(a.page, EMAIL);
    const { code } = await signInMail(EMAIL);
    await verify(a.page, code);
    await expect(a.page).toHaveURL(/\/UI-mrr-004/);

    const b = await newDevice(browser);
    await b.page.addInitScript((e) => sessionStorage.setItem('mrr.requestedEmail', e), EMAIL);
    await b.page.goto('/UI-mrr-002');
    await verify(b.page, code);
    await expect(b.page.getByRole('alert').filter({ hasText: 'รหัสหรือลิงก์นี้ถูกใช้เข้าสู่ระบบไปแล้ว กรุณาขอรหัสใหม่' })).toBeVisible();
    expect((await b.page.request.get('/auth/me')).status()).toBe(401);
    await a.ctx.close();
    await b.ctx.close();
  });

  test('[real] TC-AUTH-UI002-104 ใช้รหัสแล้ว กด magic link ในอีเมลฉบับเดียวกัน → ใช้ไปแล้ว ไม่สร้าง session (EX-mrr-103 · BR-mrr-027)', async ({ browser }) => {
    const a = await newDevice(browser);
    await askCode(a.page, EMAIL);
    const { code, link } = await signInMail(EMAIL);
    await verify(a.page, code);
    await expect(a.page).toHaveURL(/\/UI-mrr-004/);

    const b = await newDevice(browser);
    await b.page.goto(link);
    await expect(b.page).toHaveURL(/\/UI-mrr-002\?reason=used/);
    await expect(b.page.getByRole('alert').filter({ hasText: 'รหัสหรือลิงก์นี้ถูกใช้เข้าสู่ระบบไปแล้ว กรุณาขอรหัสใหม่' })).toBeVisible();
    expect((await b.page.request.get('/auth/me')).status()).toBe(401);
    await a.ctx.close();
    await b.ctx.close();
  });

  test('[real] TC-AUTH-UI001-107 รหัสเดิมถูกใช้ไปแล้ว → ขอรหัสใหม่ได้ ได้ Email ฉบับใหม่รหัสใหม่ (EX-mrr-097 · BR-mrr-025)', async ({ browser }) => {
    const a = await newDevice(browser);
    await askCode(a.page, EMAIL);
    const first = (await signInMail(EMAIL)).code;
    await verify(a.page, first);
    await expect(a.page).toHaveURL(/\/UI-mrr-004/);
    await clearMail();

    const b = await newDevice(browser);
    await askCode(b.page, EMAIL);
    await expect(b.page.getByRole('status').filter({ hasText: REQUESTED })).toBeVisible();
    const second = (await signInMail(EMAIL)).code;
    expect(second).toMatch(/^\d{6}$/);
    expect(second, 'รหัสใหม่ต้องไม่ซ้ำรหัสเดิม').not.toBe(first);
    await a.ctx.close();
    await b.ctx.close();
  });
});
