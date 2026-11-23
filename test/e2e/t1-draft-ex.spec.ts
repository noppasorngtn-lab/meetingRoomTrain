import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { as, nearSlot, stateOf } from './support/world';
import { uiDate } from './support/ui-format';

/**
 * ร่าง EX A, B, C ใน docs/qa/req-request-ex-validation-delete-2026-11-18.md — ทุกเคส [Recommended]: req ยังไม่ได้ออก EX
 * ประโยคมาจากคำตัดสินของ PO/BA 2026-11-18 (ใช้ตามโค้ด) ไม่ใช่ BR/EX จึงยังไม่ใช่ [Explicit] · เมื่อ req ออก EX ให้ผูก TC เข้ากับ EX นั้น
 * D (กดไม่ยืนยันตอนลบ) และ E (ลบห้องที่มีการจอง) ยังไม่มีคำตอบ จึงไม่มีเคส — ห้ามเดาผล
 */
const MESSAGE = 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม';
const CONFIRM = 'การลบจะเลิกใช้ห้องถาวรและเปิดกลับไม่ได้ การจองเดิมคงไว้ ยืนยันลบหรือไม่';
const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-c', sql], { encoding: 'utf8' }).trim();

test.describe('ค้นหาห้องว่าง: ตรวจเวลา · ร่าง EX A/B', () => {
  test.use({ storageState: stateOf('u1') });

  async function fill(page: import('@playwright/test').Page, date: string, start: string, end: string) {
    await page.goto('/UI-mrr-004');
    await page.getByTestId('ui-mrr-004-search-date').fill(uiDate(date));
    await page.getByTestId('ui-mrr-004-search-start-time').fill(start);
    await page.getByTestId('ui-mrr-004-search-end-time').fill(end);
    await page.getByTestId('ui-mrr-004-attendee-count').fill('1');
  }
  const searches = (page: import('@playwright/test').Page) => {
    const seen: string[] = [];
    page.on('request', (r) => r.url().includes('/rooms/available') && seen.push(r.url()));
    return seen;
  };

  for (const [tc, label, start, end] of [
    ['104', 'เวลาสิ้นสุดก่อนเวลาเริ่ม (14:00 → 13:00) · ร่าง EX A', '14:00', '13:00'],
    ['105', 'เวลาเริ่มเท่ากับเวลาสิ้นสุด (14:00 → 14:00) · ร่าง EX B · ขอบ [start, end)', '14:00', '14:00'],
  ] as const) {
    test(`[real] TC-BKG-UI004-${tc} ${label} → ไม่ค้นหา แสดง "${MESSAGE}" ([Recommended] · BR [TBD] OQ-T1-11)`, async ({ page }) => {
      const slot = nearSlot(13);
      const seen = searches(page);
      await fill(page, slot.date!, start, end);
      await page.getByTestId('ui-mrr-004-search').click();

      await expect(page.getByText(MESSAGE, { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'ผลการค้นหา' })).toHaveCount(0); // ไม่ได้ค้นหา
      expect(seen).toHaveLength(0); // ไม่มีคำขอไป API

      // ฝั่ง API ใช้ประโยคเดียวกัน (ยิงตรง)
      const u1 = await as('u1');
      const res = await u1.get(`/rooms/available?date=${slot.date}&start=${start}&end=${end}&attendees=1`);
      expect(res.status()).toBe(400);
      expect(await res.text()).toContain(MESSAGE);
      await u1.dispose();
    });
  }

  test('[real] TC-BKG-UI004-106 สิ้นสุดมากกว่าเริ่ม 1 นาที (14:00 → 14:01) → ค้นหาได้ ไม่มีข้อความตรวจเวลา · ขอบ BVA ฝั่งผ่าน ([Recommended] · OQ-T1-11)', async ({ page }) => {
    const slot = nearSlot(14);
    await fill(page, slot.date!, '14:00', '14:01');
    await page.getByTestId('ui-mrr-004-search').click();

    await expect(page.getByRole('heading', { name: 'ผลการค้นหา' })).toBeVisible();
    await expect(page.getByText(MESSAGE, { exact: true })).toHaveCount(0);
  });
});

test.describe('ลบห้อง: ข้อความยืนยัน · ร่าง EX C', () => {
  test.use({ storageState: stateOf('ra1') });
  const CODE = `E2E-CNF-${Date.now().toString(36).toUpperCase()}`;
  const NAME = `E2E Confirm ${CODE.slice(8)}`;

  test.beforeAll(async () => {
    const ra1 = await as('ra1');
    const res = await ra1.post('/rooms', { data: { code: CODE, name: NAME, capacity: 8, photos: [], facilityIds: [], requiresApproval: false, approverId: null } });
    expect(res.status(), await res.text()).toBeLessThan(300);
    await ra1.dispose();
  });
  test.afterAll(() => {
    const room = `(select id from meeting_rooms where code = '${CODE}')`;
    try {
      psql(
        `with f as (delete from room_version_facilities where room_version_id in (select id from meeting_room_versions where room_id = ${room})), ` +
          `r as (delete from meeting_rooms where code = '${CODE}'), v as (delete from meeting_room_versions where room_id = ${room}) select 1`,
      );
    } catch {
      console.log(`E2E room ${CODE} stays in dev (still referenced)`);
    }
  });

  test('[real] TC-RMM-UI013-112 RA กดลบห้อง → ระบบถามด้วยข้อความยืนยันตามตัวอักษร ก่อนที่ห้องจะถูกลบ ([Recommended] · ร่าง EX C · OQ-T1-12)', async ({ page }) => {
    let asked = '';
    let statusWhenAsked = '';
    page.on('dialog', async (d) => {
      asked = d.message();
      statusWhenAsked = psql(`select status from meeting_rooms where code = '${CODE}'`); // ยังไม่ลบตอนที่ถาม
      await d.accept(); // ผลของการกดไม่ยืนยันยังเป็น [TBD] (ร่าง EX D) จึงไม่ทดสอบทางนั้น — กดยืนยันเพื่อเก็บกวาดห้อง
    });
    await page.goto(`/UI-mrr-012?query=${CODE}`);
    const row = page.getByRole('row').filter({ has: page.getByTestId('ui-mrr-012-ent-002-code').filter({ hasText: CODE }) });
    await row.getByTestId('ui-mrr-012-archive').click();
    await expect(page.getByText('ลบห้องแล้ว', { exact: true })).toBeVisible();

    expect(asked).toBe(`ลบห้อง ${NAME}\n\n${CONFIRM}`); // ตรงตัวอักษร รวมชื่อห้องบรรทัดแรก (ชื่อห้องหน้าประโยคเป็นของโค้ด ไม่อยู่ในคำตัดสิน [TBD])
    expect(statusWhenAsked).toBe('ACTIVE'); // ถามก่อนลบ ไม่ใช่ลบแล้วค่อยถาม
  });
});
