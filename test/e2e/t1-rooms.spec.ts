import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { stateOf } from './support/world';

/**
 * EX-mrr-015 — Room Administrator เพิ่มห้องใหม่ผ่านหน้าจอ UI-mrr-013.
 * ห้องที่สร้างจากหน้าจอแล้วลบผ่าน API ไม่ได้ (DQ-mrr-003 ยัง open — ไม่มีการลบ/เก็บถาวร) ถ้าสร้างห้องใหม่ทุกรอบ ห้องจะสะสม
 * และดันห้องท้ายรายการของรายงาน (แบ่งหน้า 50 ห้อง) ออกจากหน้าแรก จึงใช้รหัสคงที่ E2E-NEWROOM แล้วลบทิ้งด้วย SQL ก่อน/หลังเคส:
 * "ยังไม่มีห้อง C" จึงเป็นจริงทุกรอบ. ลบได้เพราะห้องนี้ไม่มีการจอง · ถ้ามีรายงานออกขณะห้องนี้ยังอยู่ แถวรายงานที่ห้ามแก้
 * (BR-mrr-015) จะอ้างห้องนี้ ลบไม่ได้ และ beforeAll จะล้มดัง ๆ แทนที่จะปล่อยให้ห้องค้าง.
 */
const CODE = 'E2E-NEWROOM';
const NAME = 'E2E Room C';

const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-c', sql], { encoding: 'utf8' }).trim();

/** One statement, so the circular room ↔ version reference never stands half-deleted. */
function removeRoom() {
  const room = `(select id from meeting_rooms where code = '${CODE}')`;
  psql(
    `with f as (delete from room_version_facilities where room_version_id in (select id from meeting_room_versions where room_id = ${room})), ` +
      `r as (delete from meeting_rooms where code = '${CODE}'), ` +
      `v as (delete from meeting_room_versions where room_id = ${room}) select 1`,
  );
  expect(psql(`select count(*) from meeting_rooms where code = '${CODE}'`)).toBe('0');
}

test.beforeAll(removeRoom);
test.afterAll(removeRoom);
test.use({ storageState: stateOf('ra1') });

test('[real] TC-RMM-UI013-101 Room Administrator เพิ่มห้อง C ความจุ 10 คน แล้วกดบันทึก → สร้างห้องและแสดงข้อความสำเร็จ (EX-mrr-015 · BR-mrr-005)', async ({ page }) => {
  expect(psql(`select count(*) from meeting_rooms where code = '${CODE}'`)).toBe('0'); // ยังไม่มีห้อง C

  await page.goto('/UI-mrr-013');
  await page.getByTestId('ui-mrr-013-ent-002-code').fill(CODE);
  await page.getByTestId('ui-mrr-013-ent-003-name').fill(NAME);
  await page.getByTestId('ui-mrr-013-ent-003-capacity').fill('10');
  await page.getByTestId('ui-mrr-013-save').click();

  await expect(page.getByText('บันทึกข้อมูลห้องสำเร็จ', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/UI-mrr-012/); // กลับหน้ารายการห้อง

  // ห้องถูกสร้างจริง: เวอร์ชัน 1 ชื่อ/ความจุตามที่กรอก ใช้งานได้ ไม่ต้องอนุมัติ (ค่าเริ่มต้นของฟอร์ม)
  expect(
    psql(
      `select v.version_no, v.name, v.capacity, v.requires_approval, r.status from meeting_rooms r ` +
        `join meeting_room_versions v on v.id = r.current_version_id where r.code = '${CODE}'`,
    ),
  ).toBe(`1|${NAME}|10|f|ACTIVE`);
});
