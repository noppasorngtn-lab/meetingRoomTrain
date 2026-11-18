import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { as, nearSlot, stateOf } from './support/world';
import { SEARCH_ROOMS as R, ensureRoom, holdEveryRoom, holdSlot, roomStatus, setMaintenance } from './support/search-fixture';

/**
 * T1 round 2026-11-18 — room search (UC-mrr-001 · UI-mrr-004 · EX-mrr-106..108) and room delete (UC-mrr-015 · UI-mrr-012 ·
 * EX-mrr-109..110). Fixture: support/search-fixture.ts. [real]: every case talks to the real API and database.
 *
 * Assert on the fixture rooms by NAME only. The search lists every room of the system that fits (20 to a page, by
 * name), so a full list is never asserted; the E2E Search rooms sort among the other E2E rooms on page 1 while the
 * system holds fewer than 20 rooms that fit — if it grows past that, a miss here is a Test Data Issue, not a Product Bug.
 */
const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-c', sql], { encoding: 'utf8' }).trim();

const name = (n: string) => new RegExp(`^${n}$`);

async function search(page: Page, slot: { date?: string }, attendees: number) {
  await page.goto('/UI-mrr-004');
  await page.getByTestId('ui-mrr-004-search-date').fill(slot.date!);
  await page.getByTestId('ui-mrr-004-search-start-time').fill('13:00');
  await page.getByTestId('ui-mrr-004-search-end-time').fill('14:00');
  await page.getByTestId('ui-mrr-004-attendee-count').fill(String(attendees));
  await page.getByTestId('ui-mrr-004-search').click();
  await expect(page.getByRole('heading', { name: 'ผลการค้นหา' })).toBeVisible();
  await expect(page.getByText('กำลังค้นหาห้องว่าง…')).toHaveCount(0);
}
const roomRows = (page: Page, n: string) => page.getByTestId('ui-mrr-004-ent-003-name').filter({ hasText: name(n) });

test.describe('room search · UI-mrr-004', () => {
  test.use({ storageState: stateOf('u1') });
  const ids: Record<string, string> = {};

  test.beforeAll(async () => {
    const ra1 = await as('ra1');
    for (const [k, r] of Object.entries(R)) ids[k] = await ensureRoom(ra1, r);
    await setMaintenance(ra1, R.c.code, ids.c, 'ACTIVE'); // each case sets what it needs
    await ra1.dispose();
  });

  test('[real] TC-BKG-UI004-101 ค้นหา 6 คน → เห็นห้อง A (ความจุ 10) พร้อมปุ่ม ไม่เห็นห้อง B (ความจุ 4) (EX-mrr-106 · BR-mrr-001, BR-mrr-012)', async ({ page }) => {
    const slot = nearSlot(13);
    await search(page, slot, 6);

    const a = page.getByRole('row').filter({ has: roomRows(page, R.a.name) });
    await expect(a).toHaveCount(1);
    await expect(a.getByTestId('ui-mrr-004-ent-003-capacity')).toHaveText('10 คน');
    await expect(a.getByTestId('ui-mrr-004-book')).toHaveText('ไปหน้าจอง');
    await expect(roomRows(page, R.b.name)).toHaveCount(0); // ความจุไม่พอ
  });

  test('[real] TC-BKG-UI004-102 ทุกห้องในระบบถูกจองทับช่วงนั้น → "ไม่พบห้องว่าง" + คำแนะนำ (EX-mrr-107 · BR-mrr-001, BR-mrr-012)', async ({ page }) => {
    const ra1 = await as('ra1');
    await setMaintenance(ra1, R.c.code, ids.c, 'UNDER_MAINTENANCE'); // ห้องปิดปรับปรุงอยู่แล้ว ไม่ต้องจอง
    await ra1.dispose();
    const slot = nearSlot(13);
    const tried = await holdEveryRoom(await as('u1'), slot); // OQ-T1-11: ทุกห้องในระบบ
    expect(tried).toBeGreaterThan(0);
    await search(page, slot, 1);

    await expect(page.getByText('ไม่พบห้องว่าง', { exact: true })).toBeVisible();
    await expect(page.getByText('ลองเปลี่ยนเวลา จำนวนคน หรือตัวกรอง', { exact: true })).toBeVisible();
    await expect(page.getByTestId('ui-mrr-004-ent-003-name')).toHaveCount(0);
  });

  test('[real] TC-BKG-UI004-103 ห้อง B มีการจองรออนุมัติทับช่วงนั้น + ห้อง C ปิดปรับปรุง → ทั้งสองไม่แสดง (EX-mrr-108 · BR-mrr-001, BR-mrr-012)', async ({ page }) => {
    const ra1 = await as('ra1');
    await setMaintenance(ra1, R.c.code, ids.c, 'UNDER_MAINTENANCE');
    await ra1.dispose();
    const slot = nearSlot(13);
    const held = await holdSlot(await as('u1'), ids.bPending, slot, 'E2E SRCH pending');
    expect(held.status).toBe('PENDING_APPROVAL'); // กันช่วงเวลาทั้งที่ยังรออนุมัติ (BR-mrr-001)
    await search(page, slot, 6);

    await expect(roomRows(page, R.a.name)).toHaveCount(1); // ห้องที่ว่างจริงยังแสดง: การค้นหาทำงานอยู่
    await expect(roomRows(page, R.bPending.name)).toHaveCount(0); // ไม่ว่าง (รออนุมัติกันช่วงเวลา)
    await expect(roomRows(page, R.c.name)).toHaveCount(0); // ปิดปรับปรุง
  });
});

test.describe('room delete · UI-mrr-012', () => {
  const CODE = `E2E-DEL-${Date.now().toString(36).toUpperCase()}`;
  const NAME = `E2E Delete ${CODE.slice(8)}`;
  let roomId = '';

  // ห้องที่ ARCHIVED เปิดกลับไม่ได้ (STM-mrr-003) จึงสร้างใหม่ทุกรอบ แล้วลบแถวด้วย SQL เมื่อห้องไม่มีการจอง/รายงานอ้างถึง
  test.beforeAll(async () => {
    const ra1 = await as('ra1');
    const res = await ra1.post('/rooms', { data: { code: CODE, name: NAME, capacity: 8, photos: [], facilityIds: [], requiresApproval: false, approverId: null } });
    expect(res.status(), await res.text()).toBeLessThan(300);
    roomId = psql(`select id from meeting_rooms where code = '${CODE}'`);
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
      console.log(`E2E delete room ${CODE} stays in dev (still referenced) — see t1-test-cases.md §C`);
    }
  });

  test.describe('General User', () => {
    test.use({ storageState: stateOf('u1') });
    test('[real] TC-RMM-UI013-111 ผู้ใช้ทั่วไปสั่งลบห้อง A ตรง ๆ → ปฏิเสธด้วยประโยคของ BR-mrr-005 ห้องไม่เปลี่ยน (EX-mrr-110 · BR-mrr-005)', async () => {
      const before = roomStatus(CODE);
      const u1 = await as('u1'); // ปุ่มถูกซ่อนสำหรับบทบาทนี้ จึงยิงคำสั่งด้วย session ของ u1 โดยตรง (OQ-T1-04)
      const res = await u1.post(`/rooms/${roomId}/archive`);
      expect([401, 403]).toContain(res.status());
      expect(await res.text()).toContain('เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้');
      expect(roomStatus(CODE)).toBe(before); // ห้อง A ไม่เปลี่ยน
      expect(before).toBe('ACTIVE');
      await u1.dispose();
    });
  });

  test.describe('Room Administrator', () => {
    test.use({ storageState: stateOf('ra1') });
    test('[real] TC-RMM-UI013-110 Room Administrator ลบห้องที่ไม่มีการจอง → "ลบห้องแล้ว" ห้องเป็น ARCHIVED ไม่แสดงในการค้นหาและการจอง (EX-mrr-109 · BR-mrr-005)', async ({ page }) => {
      // ข้อความยืนยันตามโค้ด (ตัดสิน 2026-11-18 · ยังไม่มี EX) — ตรวจตามนั้น และรับ dialog
      page.on('dialog', async (d) => {
        expect(d.message()).toContain('การลบจะเลิกใช้ห้องถาวรและเปิดกลับไม่ได้ การจองเดิมคงไว้ ยืนยันลบหรือไม่');
        await d.accept();
      });
      await page.goto(`/UI-mrr-012?query=${CODE}`);
      const row = page.getByRole('row').filter({ has: page.getByTestId('ui-mrr-012-ent-002-code').filter({ hasText: CODE }) });
      await expect(row).toHaveCount(1);
      await row.getByTestId('ui-mrr-012-archive').click();

      await expect(page.getByText('ลบห้องแล้ว', { exact: true })).toBeVisible();
      expect(roomStatus(CODE)).toBe('ARCHIVED');

      // ไม่แสดงในการค้นหา: ค้นหาด้วยตัวกรองกว้างที่สุด (1 คน) ห้องที่ ARCHIVED ต้องไม่อยู่ในผล
      const slot = nearSlot(13);
      await search(page, slot, 1);
      await expect(page.getByTestId('ui-mrr-004-ent-003-name').filter({ hasText: NAME })).toHaveCount(0);
      // ไม่แสดงในการจอง: API ไม่รับการจองห้องที่เลิกใช้
      const u1 = await as('u1');
      const res = await u1.post('/bookings', {
        data: { roomId, startAt: slot.startAt, endAt: slot.endAt, title: 'E2E DEL booking', attendeeIds: [], equipmentIds: [] },
      });
      expect(res.status()).toBeGreaterThanOrEqual(400);
      await u1.dispose();
    });
  });
});
