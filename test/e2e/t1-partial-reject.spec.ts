import { expect, test, type APIRequestContext } from '@playwright/test';
import { resetClock, setClock } from './support/clock';
import { ensureMailUp } from './support/mail';
import { rejectedByFixture, startPartialRejectMail, stopPartialRejectMail } from './support/partial-reject-mail';
import { as, book, nearSlot, world } from './support/world';

/**
 * DEF-05 · BR-mrr-019 ขยายตามคำตัดสิน Q2(ก) (2026-11-20): ผู้เข้าร่วมบางคนถูก SMTP ปฏิเสธ → การกระทำที่ส่งเมลถึงหลายคนล้มทั้งหมด
 * (503 · ข้อความเดิมของ BR-019 · สถานะ/เวลาไม่เปลี่ยน) และผู้ใช้ติดอยู่ไม่ได้: แก้เฉพาะรายชื่อผู้เข้าร่วมไม่ส่งเมล จึงเอา U3 ออกได้ (Q3)
 * ทุกเคส [real]. ใช้ SMTP fixture ของ TC-NTF-JOB-110 (support/partial-reject-mail.ts) ที่ปฏิเสธเฉพาะ U3
 * ยังไม่มี EX ใน wiki รองรับเคสเหล่านี้ — [TBD] ให้ req เพิ่ม EX ตามคำตัดสิน (ดู docs/qa/po-decision-def-05-scope-2026-11-20.md)
 */
const RUN = Date.now().toString(36);
let counter = 0;
const token = () => `${RUN}p${++counter}`;
const FAILED_MAIL = 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง';
const clients: Record<string, APIRequestContext> = {};
const both = () => [world.users.u2.id, world.users.u3.id];

test.beforeAll(async () => {
  for (const k of ['u1', 'ra1']) clients[k] = await as(k);
});
test.afterEach(async () => {
  await resetClock();
  stopPartialRejectMail();
  await ensureMailUp();
});
test.afterAll(async () => {
  await Promise.all(Object.values(clients).map((c) => c.dispose()));
});

const detail = async (id: string) => (await (await clients.ra1.get(`/bookings/${id}`)).json()) as { status: string; startAt: string; attendees?: unknown };
const msgOf = async (res: { json(): Promise<{ message?: string }> }) => (await res.json().catch(() => ({}))).message;

/** ล้มเพราะ U3 ถูกปฏิเสธจริง (ไม่ใช่เพราะต่อ SMTP ไม่ติด) แล้วสถานะ/เวลาต้องไม่เปลี่ยน */
async function expectRefusedAndUnchanged(res: { status(): number; json(): Promise<{ message?: string }> }, id: string, before: { status: string; startAt: string }) {
  expect(res.status()).toBe(503);
  expect(await msgOf(res)).toBe(FAILED_MAIL);
  expect(rejectedByFixture()).toEqual([world.users.u3.email]);
  const after = await detail(id);
  expect(after.status).toBe(before.status);
  expect(after.startAt).toBe(before.startAt);
}

test.describe('ผู้เข้าร่วม U3 ถูก SMTP ปฏิเสธ (DEF-05 · BR-mrr-019 · Q2(ก))', () => {
  test('[real] TC-NTF-UI007-101 ผู้จองยกเลิก แต่ U3 ถูกปฏิเสธ → ล้มทั้งหมด การจองยังอยู่ (BR-mrr-019 · BR-mrr-003)', async () => {
    const b = await book(clients.u1, 'open', nearSlot(), `E2E ยกเลิกเมลปฏิเสธบางคน ${token()}`, both());
    const before = await detail(b.id);
    startPartialRejectMail(world.users.u3.email);
    await expectRefusedAndUnchanged(await clients.u1.post(`/bookings/${b.id}/cancel`), b.id, before);
  });

  test('[real] TC-NTF-UI010-103 RA ยกเลิกแทนหลังเริ่มประชุม แต่ U3 ถูกปฏิเสธ → ล้มทั้งหมด การจองยังอยู่ (BR-mrr-019 · BR-mrr-005)', async () => {
    const slot = nearSlot(10, 6);
    const b = await book(clients.u1, 'open', slot, `E2E RA ยกเลิกเมลปฏิเสธบางคน ${token()}`, both());
    const before = await detail(b.id);
    await setClock(new Date(new Date(slot.startAt).getTime() + 30 * 60_000)); // ประชุมเริ่มแล้ว RA จึงยกเลิกแทนได้
    startPartialRejectMail(world.users.u3.email);
    await expectRefusedAndUnchanged(await clients.ra1.post(`/bookings/${b.id}/admin-cancel`, { data: { reason: 'E2E ยกเลิกแทน' } }), b.id, before);
  });

  test('[real] TC-NTF-UI009-104 RA ปฏิเสธการจอง แต่ U3 ถูกปฏิเสธ → ล้มทั้งหมด ยังรออนุมัติ (BR-mrr-019 · BR-mrr-004)', async () => {
    const b = await book(clients.u1, 'appr', nearSlot(), `E2E ปฏิเสธเมลปฏิเสธบางคน ${token()}`, both());
    expect(b.status).toBe('PENDING_APPROVAL');
    const before = await detail(b.id);
    startPartialRejectMail(world.users.u3.email);
    await expectRefusedAndUnchanged(await clients.ra1.post(`/bookings/${b.id}/reject`, { data: { reason: 'E2E ห้องไม่เหมาะ' } }), b.id, before);
  });

  test('[real] TC-NTF-UI008-106 ผู้จองเปลี่ยนเวลา แต่ U3 ถูกปฏิเสธ → ล้มทั้งหมด เวลาเดิมคงอยู่ (BR-mrr-019 · BR-mrr-007@v2)', async () => {
    const slot = nearSlot(10, 6);
    const title = `E2E เปลี่ยนเวลาเมลปฏิเสธบางคน ${token()}`;
    const b = await book(clients.u1, 'open', slot, title, both());
    const before = await detail(b.id);
    startPartialRejectMail(world.users.u3.email);
    const res = await clients.u1.patch(`/bookings/${b.id}`, {
      data: { startAt: slot.startAt.replace('T10:', 'T14:'), endAt: slot.endAt.replace('T11:', 'T15:'), title, attendeeIds: both(), equipmentIds: [] },
    });
    await expectRefusedAndUnchanged(res, b.id, before);
  });

  test('[real] TC-NTF-UI008-107 U3 ถูกปฏิเสธ ผู้จองเอา U3 ออกจากรายชื่อโดยไม่เปลี่ยนเวลา → สำเร็จ ไม่ส่งเมล (ทางออกของ Q3 · EX-mrr-065)', async () => {
    const slot = nearSlot(10, 6);
    const title = `E2E เอาผู้เข้าร่วมออกเมลปฏิเสธ ${token()}`;
    const b = await book(clients.u1, 'open', slot, title, both());
    startPartialRejectMail(world.users.u3.email);
    const res = await clients.u1.patch(`/bookings/${b.id}`, {
      data: { startAt: slot.startAt, endAt: slot.endAt, title, attendeeIds: [world.users.u2.id], equipmentIds: [] },
    });
    expect(res.status(), await res.text()).toBe(200);
    expect(await msgOf(res)).toBe('บันทึกการแก้ไขสำเร็จ');
    expect(rejectedByFixture()).toEqual([]); // ไม่มีเมลออก จึงไม่มีการปฏิเสธ
  });
});
