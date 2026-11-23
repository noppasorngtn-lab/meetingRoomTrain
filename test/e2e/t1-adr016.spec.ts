import { expect, test } from '@playwright/test';
import { stateOf, world } from './support/world';
import { uiDate } from './support/ui-format';

/**
 * ADR-016 / UI-mrr-005 "ไม่ระบุ = วันนี้" — T1 รอบ 2026-11-23 (TC-CAL-UI005-105).
 * ช่องวันที่ของปฏิทินเว้นว่างแล้วออกจากช่อง = วันนี้ (เขตเวลา Asia/Bangkok) และคงมุมมองเดิม; ระหว่างพิมพ์ยังไม่เลื่อนวัน.
 * vitest มีแล้ว (calendar.test.tsx) — เคสนี้พิสูจน์กับ API จริง. ไม่แตะข้อมูล: อ่านปฏิทินอย่างเดียว.
 */
test.describe('ปฏิทินห้อง (UI-mrr-005) — ช่องวันที่ว่าง', () => {
  test.use({ storageState: stateOf('u1') });

  test('[real] TC-CAL-UI005-105 ล้างช่องวันที่แล้วออกจากช่อง = วันนี้ คงมุมมองสัปดาห์ (ADR-016)', async ({ page }) => {
    const urls: string[] = [];
    page.on('request', (r) => r.url().includes('/calendar?') && urls.push(new URL(r.url()).search));

    await page.goto(`/UI-mrr-005?room=${world.rooms.open}&date=2026-10-17&view=week`);
    const box = page.getByLabel(/วันที่/);
    await expect(box).toHaveValue('17/10/2026');

    await box.fill('');
    expect(urls.at(-1)).toBe('?view=week&date=2026-10-17'); // ระหว่างพิมพ์ยังไม่เลื่อน

    await box.blur();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
    await expect(page).toHaveURL(new RegExp(`date=${today}`));
    await expect(page).toHaveURL(/view=week/);
    await expect(box).toHaveValue(uiDate(today));
    expect(urls.at(-1)).toBe(`?view=week&date=${today}`);
  });

  // Q-ADR016-1 (design ตอบ 2026-11-23 = ตามโค้ดปัจจุบัน): ค่าผิดรูปแบบ/ไม่มีจริงนับเป็นค่าว่าง ปฏิทินไม่เลื่อนวัน ไม่มีข้อความ error ใหม่
  // บรรทัดช่วยเหลือบอกรูปแบบแสดงอยู่เสมอ
  for (const bad of ['11/23/2026', '31/02/2026']) {
    test(`[real] TC-CAL-UI005-107 พิมพ์ "${bad}" ปฏิทินไม่เลื่อนวัน (ADR-016 · Q-ADR016-1)`, async ({ page }) => {
      const urls: string[] = [];
      page.on('request', (r) => r.url().includes('/calendar?') && urls.push(new URL(r.url()).search));

      await page.goto(`/UI-mrr-005?room=${world.rooms.open}&date=2026-10-17&view=week`);
      const box = page.getByLabel(/วันที่/);
      await expect(box).toHaveValue('17/10/2026');
      const asked = urls.length;

      await box.fill(bad);
      await box.blur();
      await expect(page).toHaveURL(/date=2026-10-17/);
      await expect(page).toHaveURL(/view=week/);
      await expect(page.getByText('รูปแบบ วว/ดด/ปปปป (ปี ค.ศ.)')).toBeVisible();
      expect(urls.slice(asked).every((u) => u === '?view=week&date=2026-10-17')).toBe(true);
    });
  }
});
