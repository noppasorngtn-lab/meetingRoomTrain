import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { as, stateOf, world } from './support/world';

/**
 * BR-mrr-002@v1 — อุปกรณ์เสริม "เลือกหรือไม่เลือกก็ได้" (technique: EP). EX-mrr-005 (ไม่เลือก) มีเคส real แล้วใน booking.spec.ts;
 * EX ไม่มีตัวอย่างฝั่ง "เลือก" และมีเคส [stub] เดียวที่ตรวจว่าคำขอพก equipmentIds — ไฟล์นี้พิสูจน์กับ API/DB จริง.
 * ทุกเคส [Recommended]: ไม่มี EX รองรับ ข้อความ/สถานะที่ตรวจในเคส 106 มาจากโค้ด ไม่ใช่ BR/EX ([TBD] ดู t1-test-cases.md §B4).
 * Data: E2E Projector / E2E Whiteboard (global-setup · FACILITIES) · ห้อง E2E Open Room · หัวข้อขึ้นต้น E2E.
 */
const RUN = Date.now().toString(36);
const pad = (n: number) => String(n).padStart(2, '0');
const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-c', sql], { encoding: 'utf8' }).trim();

/** A free hour on a random day 30–730 days ahead (same range as booking.spec.ts, so slots do not meet nearSlot's 2–29). */
function farSlot(hour: number) {
  const d = new Date(Date.now() + (30 + Math.floor(Math.random() * 700)) * 86_400_000);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { date, start: `${date}T${pad(hour)}:00`, end: `${date}T${pad(hour + 1)}:00` };
}
const facilityId = (name: string) => psql(`select id from facilities where name = '${name}'`);
const equipmentOf = (title: string) =>
  psql(`select f.name from booking_equipment_requests e join facilities f on f.id = e.facility_id join bookings b on b.id = e.booking_id where b.title = '${title}' order by f.name`)
    .split('\n').filter(Boolean);

test.use({ storageState: stateOf('u1') });

async function book(page: Page, title: string, equipment: string[]) {
  const s = farSlot(10 + Math.floor(Math.random() * 8));
  await page.goto(`/UI-mrr-006?room=${world.rooms.open}`);
  await page.getByTestId('ui-mrr-006-ent-007-start-at').fill(s.start);
  await page.getByTestId('ui-mrr-006-ent-007-end-at').fill(s.end);
  await page.getByTestId('ui-mrr-006-ent-007-title').fill(title);
  await page.getByTestId('ui-mrr-006-ent-008-user').fill('admin');
  await page.getByRole('list', { name: 'ผลการค้นหาผู้ใช้' }).getByRole('button').first().click();
  for (const name of equipment) await page.getByLabel(name).check();
  const created = page.waitForResponse((r) => r.url().endsWith('/bookings') && r.request().method() === 'POST');
  await page.getByTestId('ui-mrr-006-confirm').click();
  return { res: await created, slot: s };
}

test('[real] TC-BKG-UI006-104 เลือกอุปกรณ์เสริม 1 รายการแล้วจอง → รับการจอง และบันทึกอุปกรณ์ตรงที่เลือก (EX-mrr-119 · BR-mrr-002 · ฝั่ง "เลือก" ของ EP)', async ({ page }) => {
  const title = `E2E อุปกรณ์ 1 ${RUN}`;
  const { res } = await book(page, title, ['E2E Projector']);
  expect(res.status(), await res.text()).toBe(201);
  const created = (await res.json()) as { status: string; message: string };
  expect(created.status).toBe('CONFIRMED'); // E2E Open Room ไม่ต้องอนุมัติ
  expect(created.message).toBe('จองห้องสำเร็จ'); // EX-mrr-119
  await expect(page).toHaveURL(/\/UI-mrr-007/);
  expect(equipmentOf(title)).toEqual(['E2E Projector']); // บันทึกจริงในฐานข้อมูล ไม่ใช่แค่ส่งไปกับคำขอ
});

test('[real] TC-BKG-UI006-105 เลือกอุปกรณ์เสริมทั้ง 2 รายการแล้วจอง → รับการจอง และบันทึกครบทั้งสอง (BR-mrr-002 · [Recommended])', async ({ page }) => {
  const title = `E2E อุปกรณ์ 2 ${RUN}`;
  const { res } = await book(page, title, ['E2E Projector', 'E2E Whiteboard']);
  expect(res.status(), await res.text()).toBe(201);
  expect(equipmentOf(title)).toEqual(['E2E Projector', 'E2E Whiteboard']);
});

test('[real] TC-BKG-UI006-106 ส่งอุปกรณ์เสริมที่ไม่มีอยู่ (ยิงตรง) → ปฏิเสธ 400 และไม่เกิดการจอง (BR-mrr-002 · [Recommended] · ข้อความจากโค้ด [TBD])', async () => {
  const title = `E2E อุปกรณ์ผิด ${RUN}`;
  const s = farSlot(9);
  const u1 = await as('u1');
  const res = await u1.post('/bookings', {
    data: {
      roomId: world.rooms.open, startAt: `${s.date}T09:00:00+07:00`, endAt: `${s.date}T10:00:00+07:00`, title,
      attendeeIds: [world.users.ra1.id], equipmentIds: [facilityId('E2E Projector'), '00000000-0000-4000-8000-000000000000'],
    },
  });
  expect(res.status()).toBe(400);
  expect(await res.text()).toContain('ไม่พบอุปกรณ์เสริมบางรายการ'); // ข้อความนี้เป็นของโค้ด ไม่มี EX
  expect(psql(`select count(*) from bookings where title = '${title}'`)).toBe('0'); // ไม่รับการจองครึ่งทาง: ไม่มีทั้งการจองและแถวอุปกรณ์
  await u1.dispose();
});
