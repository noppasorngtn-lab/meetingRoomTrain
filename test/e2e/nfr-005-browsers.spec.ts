import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/**
 * NFR-mrr-005: Chrome, Safari, Edge, Firefox and a layout that works on mobile.
 * The NFR gives no measurable threshold ("พิสูจน์ด้วย" is empty), so the checks below are QA's operational
 * reading of it [Recommended · TBD: PO to confirm]:
 *   1. the main screens render their heading and the page never scrolls sideways (overflow);
 *   2. the booking form works in the engine: date-time inputs accept a value, the attendee picker opens,
 *      validation shows, and the request carries the Bangkok offset (+07:00);
 *   3. on a touch device the actions can be tapped: at least 24 x 24 CSS px (WCAG 2.2 · 2.5.8, AA).
 * It runs once per project in playwright.config.ts (chromium, firefox, webkit, msedge, Pixel 7, iPhone 14) and
 * writes nothing to the database: the booking request is answered in the browser.
 */

interface RoomRow { id: string; capacity: number; requiresApproval: boolean }
const rooms: RoomRow[] = JSON.parse(readFileSync('.auth/rooms.json', 'utf8'));
const open = rooms.find((r) => !r.requiresApproval)!;

const T = {
  start: 'ui-mrr-006-ent-007-start-at',
  end: 'ui-mrr-006-ent-007-end-at',
  title: 'ui-mrr-006-ent-007-title',
  attendee: 'ui-mrr-006-ent-008-user',
  confirm: 'ui-mrr-006-confirm',
};

const MIN_TARGET_PX = 24;

/** True when the page is wider than the window — the user would have to scroll sideways. */
const scrollsSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

async function expectTappable(page: Page, testId: string) {
  const el = page.getByTestId(testId);
  await el.scrollIntoViewIfNeeded();
  const box = await el.boundingBox();
  expect(box, `${testId} has no box`).not.toBeNull();
  expect(box!.width, `${testId} width`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
  expect(box!.height, `${testId} height`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
  const vw = page.viewportSize()!.width;
  expect(box!.x, `${testId} left edge`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${testId} right edge`).toBeLessThanOrEqual(vw + 1);
}

test.describe('หน้าที่ต้องเข้าสู่ระบบ', () => {
  test.use({ storageState: '.auth/tester.json' });

  for (const [name, path] of [
    ['UI-mrr-004 ค้นหาห้องว่าง', '/UI-mrr-004'],
    ['UI-mrr-006 จองห้องประชุม', `/UI-mrr-006?room=${open.id}`],
    ['UI-mrr-007 การจองของฉัน', '/UI-mrr-007'],
  ] as const) {
    test(`[real] ${name} แสดงหัวข้อและไม่เลื่อนซ้ายขวา`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(await scrollsSideways(page), 'หน้าเลื่อนซ้ายขวาได้ (overflow)').toBe(false);
    });
  }

  test('[stub] ฟอร์มจอง: ช่องวันเวลารับค่า เลือกผู้เข้าร่วมได้ และคำขอส่งเวลาเป็น +07:00', async ({ page }) => {
    let body: any;
    await page.route('**/bookings', (r) => {
      if (r.request().method() !== 'POST') return r.fallback();
      body = r.request().postDataJSON();
      return r.fulfill({ status: 201, json: { id: 'x', status: 'CONFIRMED', message: 'จองสำเร็จ' } });
    });
    await page.goto(`/UI-mrr-006?room=${open.id}`);
    await page.getByTestId(T.start).fill('2031-03-05T09:00');
    await page.getByTestId(T.end).fill('2031-03-05T10:00');
    await expect(page.getByTestId(T.start)).toHaveValue('2031-03-05T09:00');
    await page.getByTestId(T.title).fill('ทดสอบเบราว์เซอร์');
    await page.getByTestId(T.attendee).fill('admin');
    await page.getByRole('list', { name: 'ผลการค้นหาผู้ใช้' }).getByRole('button').first().click();
    await page.getByTestId(T.confirm).click();
    await expect(page).toHaveURL(/\/UI-mrr-007/);
    expect(body.startAt).toBe('2031-03-05T09:00:00+07:00');
    expect(body.endAt).toBe('2031-03-05T10:00:00+07:00');
  });

  test('[real] ฟอร์มจอง: กดยืนยันทั้งที่ว่าง แจ้งทุกช่องที่ขาด', async ({ page }) => {
    await page.goto(`/UI-mrr-006?room=${open.id}`);
    await page.getByTestId(T.confirm).click();
    for (const m of ['กรุณาระบุเวลาเริ่ม', 'กรุณาระบุเวลาสิ้นสุด', 'กรุณาระบุหัวข้อการประชุม', 'กรุณาระบุผู้เข้าร่วมอย่างน้อย 1 คน']) {
      await expect(page.getByText(m)).toBeVisible();
    }
    expect(await scrollsSideways(page), 'ข้อความแจ้งทำให้หน้าเลื่อนซ้ายขวา').toBe(false);
  });

  test('[real] อุปกรณ์สัมผัส: ปุ่มยืนยันและยกเลิกกดได้ (≥ 24 px) และอยู่ในจอ', async ({ page, hasTouch }) => {
    test.skip(!hasTouch, 'ตรวจเฉพาะอุปกรณ์สัมผัส');
    await page.goto(`/UI-mrr-006?room=${open.id}`);
    await expectTappable(page, T.confirm);
    await expectTappable(page, 'ui-mrr-006-cancel-form');
  });
});

test.describe('หน้าเข้าสู่ระบบ (ยังไม่ล็อกอิน)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('[real] UI-mrr-001 ช่อง Email และปุ่มขอรหัสมองเห็น ไม่เลื่อนซ้ายขวา', async ({ page }) => {
    await page.goto('/UI-mrr-001');
    await expect(page.getByTestId('ui-mrr-001-org-email')).toBeVisible();
    await expect(page.getByTestId('ui-mrr-001-request-code')).toBeVisible();
    expect(await scrollsSideways(page), 'หน้าเลื่อนซ้ายขวา').toBe(false);
  });
});
