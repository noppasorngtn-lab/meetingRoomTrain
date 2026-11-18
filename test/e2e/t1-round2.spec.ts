import { execFileSync } from 'node:child_process';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { resetClock, runJobs, setClock } from './support/clock';
import { ensureMailUp } from './support/mail';
import { as, book, nearSlot, stateOf, world } from './support/world';

/**
 * T1 รอบ 2 (CHG-mrr-003 · EX-mrr-111–122) — BR-mrr-007@v2 · 017@v2 · 019 · 020@v2.
 * ทุกเคส [real]. ข้อความ/หัวเรื่อง/ค่าช่อง "การกระทำ" ตรวจตามถ้อยคำของ EX ตรง ๆ (แหล่งความจริง) ไม่ใช่ตามโค้ดปัจจุบัน:
 * ถ้าโค้ดยังเป็นถ้อยคำของ v1 เคสจะล้ม และนั่นคือผลที่ต้องรายงาน (ไม่ปรับ assertion ให้ผ่าน).
 * EX-mrr-112 (ผู้รับล้มเฉพาะ U3) ยังไม่มี fixture → test.fixme (OQ-T1-15).
 * หัวข้อการจองขึ้นต้น E2E และมี token ต่อเคส; แถวที่มีร่องรอยลบไม่ได้ (trigger BR-mrr-018) จึงค้างในห้อง E2E.
 */
const RUN = Date.now().toString(36);
let counter = 0;
const token = () => `${RUN}r${++counter}`;
const MAIL = 'http://localhost:8025/api/v1/messages';
const FAILED_MAIL = 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง';
const P = '[จองห้องประชุม]';

const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-c', sql], { encoding: 'utf8' }).trim();

const clients: Record<string, APIRequestContext> = {};
test.beforeAll(async () => {
  for (const k of ['u1', 'u2', 'u3', 'ra1']) clients[k] = await as(k);
});
test.afterEach(async () => {
  await resetClock();
  await ensureMailUp();
});
test.afterAll(async () => {
  await Promise.all(Object.values(clients).map((c) => c.dispose()));
  const mine = `select id from bookings where title like 'E2E%${RUN}r%' and id not in (select booking_id from booking_audit_entries) and id not in (select booking_id from booking_adjustment_requests)`;
  for (const t of ['booking_attendees', 'booking_equipment_requests']) psql(`delete from ${t} where booking_id in (${mine})`);
  psql(`delete from bookings where id in (${mine})`);
});

interface Mail { Subject: string; To: { Address: string }[] }
const mails = async (): Promise<Mail[]> => ((await (await fetch(MAIL)).json()).messages ?? []) as Mail[];
const mailsFor = async (prefix: string, t: string) => (await mails()).filter((m) => m.Subject.startsWith(prefix) && m.Subject.includes(t));
async function mailsArrived(prefix: string, t: string, count = 1) {
  let got = await mailsFor(prefix, t);
  for (let i = 0; i < 20 && got.length < count; i++) {
    await new Promise((r) => setTimeout(r, 500));
    got = await mailsFor(prefix, t);
  }
  return got;
}
const settle = () => new Promise((r) => setTimeout(r, 2500)); // ให้จดหมายถึง mailpit ก่อนยืนยันว่า "ไม่มี"
const addresses = (m: Mail) => m.To.map((x) => x.Address).sort();
const emails = (...keys: string[]) => keys.map((k) => world.users[k].email).sort();
const startOf = (slot: { startAt: string }) => new Date(slot.startAt);
const at = (d: Date, ms: number) => new Date(d.getTime() + ms);
const msgOf = async (res: { json(): Promise<{ message: string }> }) => (await res.json()).message;
const statusOf = async (id: string) => (await (await clients.ra1.get(`/bookings/${id}`)).json()).status as string;
const reminderOf = (id: string) => psql(`select reminder_status from bookings where id = '${id}'`);
const trailOf = async (id: string) => (await (await clients.ra1.get(`/bookings/${id}/audit`)).json()) as { action: string; reason: string | null; at: string; actor: { id: string } }[];
const title = (name: string, t: string) => `E2E ${name} ${t}`;
const both = [world.users.u2.id, world.users.u3.id];

// ------------------------------------------------------------------ BR-mrr-020@v2 เตือนก่อนเริ่ม
test('[real] TC-NTF-JOB-109 งานเตือนส่งสำเร็จ → U1 U2 U3 ได้อีเมลเตือน และบันทึก "ส่งสำเร็จ" (EX-mrr-111 · BR-mrr-020@v2)', async () => {
  const t = token();
  const slot = nearSlot();
  const b = await book(clients.u1, 'open', slot, title('ประชุมทีม', t), both);
  await setClock(at(startOf(slot), -15 * 60_000));
  await runJobs(t);
  const got = await mailsArrived(`${P} ใกล้ถึงเวลาประชุม:`, t);
  expect(got).toHaveLength(1);
  expect(got[0].Subject.startsWith(`${P} ใกล้ถึงเวลาประชุม: ${title('ประชุมทีม', t)} · `)).toBe(true);
  expect(addresses(got[0])).toEqual(emails('u1', 'u2', 'u3'));
  expect(reminderOf(b.id)).toBe('SENT'); // OQ-T1-14: "บันทึก" = คอลัมน์ bookings.reminder_status
});

test.fixme('[real] TC-NTF-JOB-110 ผู้รับ U3 ส่งไม่สำเร็จ → บันทึก "ส่งไม่สำเร็จ" ทั้งการจอง งาน 09:50 ไม่ส่งซ้ำ (EX-mrr-112 · BR-mrr-020@v2) — รอ fixture OQ-T1-15', async () => {
  // ต้องทำให้ SMTP ปฏิเสธเฉพาะผู้รับ U3 (mailpit ที่ใช้อยู่ล้มทั้งตัวเท่านั้น → ซ้ำกับ TC-NTF-JOB-104).
  // เมื่อมี fixture: ตั้งนาฬิกา -15 นาที · runJobs · expect(reminderOf(id)).toBe('FAILED') · expect(status).toBe('CONFIRMED')
  //                 แล้ว setClock -10 นาที · runJobs · ไม่มีอีเมลเตือนเพิ่มให้ใคร · ยังเป็น 'FAILED'.
});

// ------------------------------------------------------------------ BR-mrr-019 / BR-mrr-007@v2 Email ตามเหตุการณ์
test('[real] TC-BKG-UI006-107 อีเมลปกติ → จองสำเร็จ ไม่มีข้อความ "ส่ง Email แจ้งเตือนไม่สำเร็จ" และ U1 ได้อีเมลจองสำเร็จ (EX-mrr-113 · BR-mrr-019)', async () => {
  const t = token();
  const res = await clients.u1.post('/bookings', {
    data: { roomId: world.rooms.open, ...(() => { const s = nearSlot(13); return { startAt: s.startAt, endAt: s.endAt }; })(), title: title('ประชุมทีม', t), attendeeIds: [world.users.u2.id], equipmentIds: [] },
  });
  expect(res.status(), await res.text()).toBe(201);
  const body = (await res.json()) as { status: string; message: string };
  expect(body.message).toBe('จองห้องสำเร็จ');
  expect(body.message).not.toBe(FAILED_MAIL);
  expect(body.status).toBe('CONFIRMED');
  const got = await mailsArrived(`${P} จองสำเร็จ:`, t);
  expect(got).toHaveLength(1);
  expect(got[0].Subject.startsWith(`${P} จองสำเร็จ: ${title('ประชุมทีม', t)} · `)).toBe(true);
  expect(addresses(got[0])).toContain(world.users.u1.email);
});

test('[real] TC-NTF-UI006-102 ห้องต้องอนุมัติ → การจองรออนุมัติ ยังไม่มีใครได้อีเมล "จองสำเร็จ" (EX-mrr-114 · BR-mrr-007@v2)', async () => {
  const t = token();
  const b = await book(clients.u1, 'appr', nearSlot(10), title('ประชุมลูกค้า', t), [world.users.u2.id]);
  expect(b.status).toBe('PENDING_APPROVAL');
  await settle();
  expect(await mailsFor(`${P} จองสำเร็จ:`, t)).toHaveLength(0);
});

test('[real] TC-NTF-UI009-102 RA อนุมัติ → อนุมัติแล้ว · อีเมล "อนุมัติแล้ว" ถึง U1 เท่านั้น U2 ไม่ได้รับ (EX-mrr-115 · BR-mrr-007@v2)', async () => {
  const t = token();
  const b = await book(clients.u1, 'appr', nearSlot(10), title('ประชุมลูกค้า', t), [world.users.u2.id]);
  const res = await clients.ra1.post(`/bookings/${b.id}/approve`);
  expect(res.status(), await res.text()).toBeLessThan(300);
  expect(await msgOf(res)).toBe('อนุมัติการจองสำเร็จ');
  expect(await statusOf(b.id)).toBe('APPROVED');
  const got = await mailsArrived(`${P} อนุมัติแล้ว:`, t);
  expect(got).toHaveLength(1);
  expect(got[0].Subject.startsWith(`${P} อนุมัติแล้ว: ${title('ประชุมลูกค้า', t)} · `)).toBe(true);
  expect(addresses(got[0])).toEqual(emails('u1'));
});

test('[real] TC-NTF-UI008-105 ผู้จองยกเลิกก่อนเริ่ม → ยกเลิก · อีเมล "ยกเลิกการจอง" ถึง U1 U2 U3 (EX-mrr-116 · BR-mrr-007@v2)', async () => {
  const t = token();
  const b = await book(clients.u1, 'open', nearSlot(10), title('ประชุมทีม', t), both);
  const res = await clients.u1.post(`/bookings/${b.id}/cancel`);
  expect(res.status(), await res.text()).toBeLessThan(300);
  expect(await msgOf(res)).toBe('ยกเลิกการจองสำเร็จ');
  expect(await statusOf(b.id)).toBe('CANCELLED');
  const got = await mailsArrived(`${P} ยกเลิกการจอง:`, t);
  expect(got).toHaveLength(1);
  expect(got[0].Subject.startsWith(`${P} ยกเลิกการจอง: ${title('ประชุมทีม', t)} · `)).toBe(true);
  expect(addresses(got[0])).toEqual(emails('u1', 'u2', 'u3'));
});

test('[real] TC-NTF-UI010-101 RA ยกเลิกแทนตอน 10:30 (เริ่มไปแล้ว) → ยกเลิก · อีเมล "ยกเลิกการจอง" ถึง U1 U2 U3 (EX-mrr-117 · BR-mrr-007@v2)', async () => {
  const t = token();
  const slot = nearSlot(10);
  const b = await book(clients.u1, 'open', slot, title('ประชุมทีม', t), both);
  await setClock(at(startOf(slot), 30 * 60_000));
  const res = await clients.ra1.post(`/bookings/${b.id}/admin-cancel`, { data: { reason: 'ห้องต้องใช้จัดงานด่วน' } });
  expect(res.status(), await res.text()).toBeLessThan(300);
  expect(await msgOf(res)).toBe('ยกเลิกการจองสำเร็จ');
  expect(await statusOf(b.id)).toBe('CANCELLED');
  const got = await mailsArrived(`${P} ยกเลิกการจอง:`, t);
  expect(got).toHaveLength(1);
  expect(addresses(got[0])).toEqual(emails('u1', 'u2', 'u3'));
});

// ------------------------------------------------------------------ ปฏิเสธ + ร่องรอย (BR-mrr-007@v2 · BR-mrr-017@v2)
const REJECT_REASON = 'ห้องไม่เหมาะกับการประชุมนี้';

test('[real] TC-NTF-UI009-103 RA ปฏิเสธ → ปฏิเสธแล้ว · อีเมล "ปฏิเสธการจอง" ถึง U1 U2 · ร่องรอย 1 รายการ พร้อมเหตุผล (EX-mrr-118 · BR-mrr-007@v2 · BR-mrr-017@v2)', async () => {
  const t = token();
  const slot = nearSlot(10);
  const b = await book(clients.u1, 'appr', slot, title('ประชุมลูกค้า', t), [world.users.u2.id]);
  const now = at(startOf(slot), -(19 * 60 + 50) * 60_000); // ก่อนเริ่มประมาณ 20 ชั่วโมง (EX: 16/10 14:10 ก่อนการประชุม 17/10 10:00)
  await setClock(now);
  const res = await clients.ra1.post(`/bookings/${b.id}/reject`, { data: { reason: REJECT_REASON } });
  expect(res.status(), await res.text()).toBeLessThan(300);
  expect(await msgOf(res)).toBe('ปฏิเสธการจองสำเร็จ'); // เจ้าของตอบ 2026-11-18 · EX-118/120 เขียน 'ปฏิเสธการจอง' — req ต้องแก้ EX
  expect(await statusOf(b.id)).toBe('REJECTED');
  const got = await mailsArrived(`${P} ปฏิเสธการจอง:`, t);
  expect(got).toHaveLength(1);
  expect(got[0].Subject.startsWith(`${P} ปฏิเสธการจอง: ${title('ประชุมลูกค้า', t)} · `)).toBe(true);
  expect(addresses(got[0])).toEqual(emails('u1', 'u2'));
  const trail = await trailOf(b.id);
  expect(trail).toHaveLength(1);
  expect(trail[0].actor.id).toBe(world.users.ra1.id);
  expect(trail[0].reason).toBe(REJECT_REASON);
  expect(Math.abs(Date.parse(trail[0].at) - now.getTime())).toBeLessThan(120_000);
});

test.describe('ค่าช่อง "การกระทำ" ของร่องรอย (BR-mrr-017@v2)', () => {
  const open = async (browser: import('@playwright/test').Browser, id: string) => {
    const ctx = await browser.newContext({ storageState: stateOf('ra1'), baseURL: 'http://localhost:4173', locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    await page.goto(`/UI-mrr-010?booking=${id}`);
    return { page, close: () => ctx.close() };
  };

  test('[real] TC-AUD-UI010-109 RA ปฏิเสธ → ปฏิเสธแล้ว · ร่องรอยใหม่ 1 รายการ การกระทำ "ปฏิเสธการจอง" พร้อมเหตุผล (EX-mrr-120 · BR-mrr-017@v2)', async ({ browser }) => {
    const t = token();
    const slot = nearSlot(10);
    const b = await book(clients.u1, 'appr', slot, title('ปฏิเสธ', t));
    const now = at(startOf(slot), -(19 * 60 + 50) * 60_000);
    await setClock(now);
    const res = await clients.ra1.post(`/bookings/${b.id}/reject`, { data: { reason: REJECT_REASON } });
    expect(res.status(), await res.text()).toBeLessThan(300);
    expect(await msgOf(res)).toBe('ปฏิเสธการจองสำเร็จ'); // เจ้าของตอบ 2026-11-18 · EX-118/120 เขียน 'ปฏิเสธการจอง' — req ต้องแก้ EX
    expect(await statusOf(b.id)).toBe('REJECTED');
    const trail = await trailOf(b.id);
    expect(trail).toHaveLength(1);
    expect(trail[0]).toMatchObject({ reason: REJECT_REASON });
    expect(trail[0].actor.id).toBe(world.users.ra1.id);
    const v = await open(browser, b.id);
    await expect(v.page.getByTestId('ui-mrr-010-ent-010-action')).toHaveText('ปฏิเสธการจอง');
    await v.close();
  });

  test('[real] TC-AUD-UI010-110 RA เปลี่ยนผลอนุมัติ → ปฏิเสธ · ร่องรอยใหม่ 1 รายการ การกระทำ "ถอยผล" พร้อมเหตุผล (EX-mrr-121 · BR-mrr-017@v2)', async ({ browser }) => {
    const t = token();
    const slot = nearSlot(10);
    const b = await book(clients.u1, 'appr', slot, title('ถอยผล', t));
    expect((await clients.ra1.post(`/bookings/${b.id}/approve`)).status()).toBeLessThan(300);
    expect(await trailOf(b.id)).toHaveLength(1); // รายการอนุมัติเดิม — "ใหม่ 1 รายการ" คือรายการถัดมา
    await setClock(at(startOf(slot), -(19 * 60) * 60_000));
    const res = await clients.ra1.post(`/bookings/${b.id}/decision`, { data: { decision: 'REJECTED', reason: 'อนุมัติผิดห้อง' } });
    expect(res.status(), await res.text()).toBeLessThan(300);
    expect(await msgOf(res)).toBe('เปลี่ยนผลการอนุมัติสำเร็จ');
    expect(await statusOf(b.id)).toBe('REJECTED');
    const trail = await trailOf(b.id);
    expect(trail).toHaveLength(2);
    expect(trail.filter((e) => e.reason === 'อนุมัติผิดห้อง')).toHaveLength(1);
    const v = await open(browser, b.id);
    await expect(v.page.getByTestId('ui-mrr-010-ent-010-action').filter({ hasText: /^ถอยผล$/ })).toHaveCount(1);
    await v.close();
  });

  test('[real] TC-AUD-UI010-111 RA แก้หัวข้อแทนผู้จอง → ร่องรอยใหม่ 1 รายการ การกระทำ "แก้แทนผู้จอง" พร้อมเหตุผล (EX-mrr-122 · BR-mrr-017@v2)', async ({ browser }) => {
    const t = token();
    const slot = nearSlot(10);
    const b = await book(clients.u1, 'open', slot, title('ประชุมทีม', t));
    await setClock(at(startOf(slot), 30 * 60_000));
    const res = await clients.ra1.post(`/bookings/${b.id}/admin-edit`, { data: { title: title('ประชุมวางแผน', t), reason: 'ผู้จองพิมพ์หัวข้อผิด' } });
    expect(res.status(), await res.text()).toBeLessThan(300);
    expect(await msgOf(res)).toBe('บันทึกการแก้ไขสำเร็จ'); // เจ้าของตอบ 2026-11-18 · EX-122 เขียน 'บันทึกการแก้ไข' — req ต้องแก้ EX
    expect((await (await clients.ra1.get(`/bookings/${b.id}`)).json()).title).toBe(title('ประชุมวางแผน', t));
    const trail = await trailOf(b.id);
    expect(trail).toHaveLength(1);
    expect(trail[0].reason).toBe('ผู้จองพิมพ์หัวข้อผิด');
    expect(trail[0].actor.id).toBe(world.users.ra1.id);
    const v = await open(browser, b.id);
    await expect(v.page.getByTestId('ui-mrr-010-ent-010-action')).toHaveText('แก้แทนผู้จอง');
    await v.close();
  });
});
