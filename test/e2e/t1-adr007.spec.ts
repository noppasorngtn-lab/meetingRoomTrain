import { execFileSync } from 'node:child_process';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { as, stateOf, world } from './support/world';
import { uiDate } from './support/ui-format';

/**
 * ADR-007 (GAP-mrr-011 · 012 · 016 · 018) — คำตัดสิน: ปฏิทินเลื่อนวันได้ · ปุ่มจองบอกว่าไปหน้าจอง · ไม่มีรูปภาพในฟอร์มห้อง ·
 * ผู้ดูแลห้องเห็น facility ทั้งหมดและเปิดกลับได้ (API-036). ผ่านหน้าจอจริงและ API จริง; ข้อมูลสังเคราะห์ ขึ้นต้น `E2E ADR7`.
 * facility ลบผ่าน API ไม่ได้ จึงลบด้วย SQL หลังเคส (ไม่มีห้องไหนอ้างถึง).
 */

const RUN = Date.now().toString(36);
const NAME = (s: string) => `E2E ADR7 ${s} ${RUN}`;
const SAVED = 'บันทึกสิ่งอำนวยความสะดวกสำเร็จ';
const REFUSED = 'เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้';

const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-c', sql], { encoding: 'utf8' }).trim();

let ra: APIRequestContext;
let user: APIRequestContext;
test.beforeAll(async () => {
  ra = await as('ra1');
  user = await as('u1');
});
test.afterAll(async () => {
  await ra.dispose();
  await user.dispose();
  // facilities made here: no room names them, so they can go
  psql(`delete from facilities where name like 'E2E ADR7 %' and id not in (select facility_id from room_version_facilities)`);
});

// ------------------------------------------------------------------ ปฏิทิน: เลื่อนวัน (GAP-mrr-011) · ปุ่มจอง (GAP-mrr-012)
test.describe('ปฏิทินห้อง (UI-mrr-005)', () => {
  test.use({ storageState: stateOf('u1') });
  const url = (date: string, view = 'week') => `/UI-mrr-005?room=${world.rooms.open}&date=${date}&view=${view}`;
  const asked = (page: import('@playwright/test').Page) => {
    const urls: string[] = [];
    page.on('request', (r) => r.url().includes('/calendar?') && urls.push(new URL(r.url()).search));
    return urls;
  };

  test('[real] ADR7-011 ก่อนหน้า · ถัดไป · วันนี้ เลื่อนช่วงที่ดูตามมุมมอง และถามช่วงนั้นจาก API (GAP-mrr-011)', async ({ page }) => {
    const urls = asked(page);
    await page.goto(url('2026-10-17'));
    await expect(page.getByLabel(/วันที่/)).toHaveValue('17/10/2026');

    await page.getByTestId('ui-mrr-005-next').click();
    await expect(page.getByLabel(/วันที่/)).toHaveValue('24/10/2026'); // สัปดาห์ = +7 วัน
    await page.getByTestId('ui-mrr-005-previous').click();
    await page.getByTestId('ui-mrr-005-previous').click();
    await expect(page.getByLabel(/วันที่/)).toHaveValue('10/10/2026');
    expect(urls.at(-1)).toBe('?view=week&date=2026-10-10');

    await page.getByTestId('ui-mrr-005-today').click();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
    await expect(page.getByLabel(/วันที่/)).toHaveValue(uiDate(today));
  });

  test('[real] ADR7-011b เลือกวันจากช่องวันที่ และมุมมองเดือนเลื่อนทีละเดือน (GAP-mrr-011)', async ({ page }) => {
    await page.goto(url('2026-01-31', 'month'));
    await page.getByTestId('ui-mrr-005-next').click();
    await expect(page.getByLabel(/วันที่/)).toHaveValue('28/02/2026'); // 31 ม.ค. + 1 เดือน = สิ้นเดือน ก.พ.
    await page.getByLabel(/วันที่/).fill('09/03/2027');
    await expect(page).toHaveURL(/date=2027-03-09/);
    await expect(page).toHaveURL(/view=month/);
  });

  test('[real] ADR7-012 ปุ่มจองชื่อ "ไปหน้าจองห้อง" และพาไปหน้าจองพร้อมห้องกับวันที่ที่ดูอยู่ (GAP-mrr-012)', async ({ page }) => {
    await page.goto(url('2026-10-17', 'day'));
    await expect(page.getByTestId('ui-mrr-005-book-slot')).toHaveText('ไปหน้าจองห้อง');
    await expect(page.getByText('จองช่วงที่ว่าง')).toHaveCount(0);
    await page.getByTestId('ui-mrr-005-book-slot').click();
    await expect(page).toHaveURL(new RegExp(`/UI-mrr-006\\?room=${world.rooms.open}&date=2026-10-17`));
  });
});

// ------------------------------------------------------------------ ฟอร์มห้อง: ไม่มีรูปภาพรอบนี้ (GAP-mrr-016 B)
test.describe('ฟอร์มข้อมูลห้อง (UI-mrr-013)', () => {
  test.use({ storageState: stateOf('ra1') });

  test('[real] ADR7-016 ฟอร์มไม่มีช่องรูปภาพ ทั้งตอนเพิ่มห้องและตอนแก้ห้อง (GAP-mrr-016)', async ({ page }) => {
    for (const path of ['/UI-mrr-013', `/UI-mrr-013?room=${world.rooms.open}`]) {
      await page.goto(path);
      await expect(page.getByTestId('ui-mrr-013-ent-003-name')).toBeVisible();
      await expect(page.getByTestId('ui-mrr-013-ent-003-photos')).toHaveCount(0);
      await expect(page.getByText('รูปภาพ', { exact: true })).toHaveCount(0);
    }
  });
});

// ------------------------------------------------------------------ สิ่งอำนวยความสะดวก: เห็นทั้งหมด เปิดกลับได้ (GAP-mrr-018)
test.describe('สิ่งอำนวยความสะดวก (UI-mrr-014 · API-036)', () => {
  const make = async (name: string, active = true) => {
    const made = (await (await ra.post('/facilities', { data: { name } })).json()).facility as { id: string };
    if (!active) expect((await ra.patch(`/facilities/${made.id}`, { data: { active: false } })).status()).toBe(200);
    return made.id;
  };
  const rowOf = (page: import('@playwright/test').Page, name: string) =>
    page.locator('tr', { has: page.locator(`input[data-testid="ui-mrr-014-ent-004-name"]`) }).filter({
      has: page.locator(`input[value="${name}"]`),
    });

  test('[real] ADR7-018a API-036: ผู้ดูแลห้องเห็นทุกรายการรวมที่ปิดใช้ · ผู้ใช้ทั่วไปถูกปฏิเสธ · API-002 เห็นเฉพาะที่ใช้งาน (GAP-mrr-018)', async () => {
    const on = NAME('เปิด'), off = NAME('ปิด');
    await make(on);
    await make(off, false);

    const all = await ra.get('/facilities?active=all');
    expect(all.status()).toBe(200);
    const mine = ((await all.json()) as { name: string; active: boolean }[]).filter((f) => f.name.startsWith('E2E ADR7 ') && f.name.endsWith(RUN));
    expect(mine.map((f) => [f.name, f.active]).sort()).toEqual([[off, false], [on, true]].sort());

    const refused = await user.get('/facilities?active=all');
    expect(refused.status()).toBe(403);
    expect((await refused.json()).message).toBe(REFUSED);

    const offered = ((await (await user.get('/facilities?active=true')).json()) as { name: string }[]).map((f) => f.name);
    expect(offered).toContain(on);
    expect(offered).not.toContain(off);
  });

  test.describe('หน้าจอ', () => {
    test.use({ storageState: stateOf('ra1') });

    test('[real] ADR7-018b รายการที่ปิดใช้ยังอยู่ในหน้า (ไม่ติ๊กใช้งาน) และติ๊กเปิดกลับแล้วบันทึกได้ — ผู้ใช้ทั่วไปเลือกได้อีกครั้ง (GAP-mrr-018)', async ({ page }) => {
      const name = NAME('เปิดกลับ');
      const id = await make(name, false);

      await page.goto('/UI-mrr-014');
      const row = rowOf(page, name);
      await expect(row).toHaveCount(1); // ยังอยู่ แม้ปิดใช้แล้วและโหลดหน้าใหม่
      await expect(row.getByTestId('ui-mrr-014-ent-004-active')).not.toBeChecked();

      await row.getByTestId('ui-mrr-014-ent-004-active').check();
      await row.getByTestId('ui-mrr-014-save').click();
      await expect(page.getByText(SAVED, { exact: true })).toBeVisible();

      expect(psql(`select active from facilities where id = '${id}'`)).toBe('t');
      const offered = ((await (await user.get('/facilities?active=true')).json()) as { name: string }[]).map((f) => f.name);
      expect(offered).toContain(name);
    });
  });
});
