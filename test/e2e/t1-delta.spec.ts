import { execFileSync } from 'node:child_process';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { as, book, nearSlot, world } from './support/world';

/**
 * เคสจาก T1 delta (t1-test-cases.md §B17) ที่ยิง API ตรง · ทุกเคส [real]: คุยกับ API/DB/mailpit จริง.
 * TC-NTF-UI006-103 (เหลือ 15 นาทีพอดี) ไม่อยู่ที่นี่: /__test/clock เก็บแค่ offset นาฬิกายังเดิน จึงตรึงเวลาไม่ได้
 * — อยู่ใน apps/api/test/notification/booking-notifier.spec.ts.
 */

const RUN = Date.now().toString(36);
const title = (s: string) => `E2E ${s} ${RUN}`;
const MAILPIT = 'http://localhost:8025/api/v1/messages';

const psql = (sql: string) => execFileSync('docker', ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-c', sql], { encoding: 'utf8' });

const clients: Record<string, APIRequestContext> = {};
test.beforeAll(async () => {
  clients.u1 = await as('u1');
});
test.afterAll(async () => {
  await Promise.all(Object.values(clients).map((c) => c.dispose()));
  const mine = `select id from bookings where title like 'E2E%${RUN}' and id not in (select booking_id from booking_audit_entries)`;
  for (const t of ['booking_attendees', 'booking_equipment_requests', 'booking_adjustment_requests']) psql(`delete from ${t} where booking_id in (${mine})`);
  psql(`delete from bookings where id in (${mine})`);
});

interface Mail { Subject: string; To: { Address: string }[] }
/** Only this case's mail: every subject carries the booking title, which carries RUN. */
const mailsAbout = async (t: string) =>
  (((await (await fetch(`${MAILPIT}?limit=200`)).json()).messages ?? []) as Mail[]).filter((m) => m.Subject.includes(t));
const clearMail = async () => {
  expect((await fetch(MAILPIT, { method: 'DELETE' })).ok).toBe(true);
};
const waitFor = async (t: string, event: string) => {
  await expect
    .poll(async () => (await mailsAbout(t)).filter((m) => m.Subject.startsWith(`[จองห้องประชุม] ${event}: `)).length, { timeout: 10_000 })
    .toBe(1);
  return (await mailsAbout(t)).find((m) => m.Subject.startsWith(`[จองห้องประชุม] ${event}: `))!;
};
const detail = async (id: string) => (await (await clients.u1.get(`/bookings/${id}`)).json()) as { status: string; attendees: { id: string }[] };

test('[real] TC-NTF-UI008-110 แก้เฉพาะรายชื่อผู้เข้าร่วม (เพิ่มคนใหม่) → บันทึกสำเร็จ และไม่มีใครได้รับ Email (BR-mrr-007)', async () => {
  const { u2, u3, u1 } = world.users;
  const t = title('แก้เฉพาะผู้เข้าร่วม');
  const slot = nearSlot(10);
  const b = await book(clients.u1, 'open', slot, t, [u2.id]);
  await waitFor(t, 'จองสำเร็จ');
  await clearMail();

  const edit = (startAt: string, endAt: string) =>
    clients.u1.patch(`/bookings/${b.id}`, { data: { startAt, endAt, title: t, attendeeIds: [u2.id, u3.id] } });
  const res = await edit(slot.startAt, slot.endAt);
  expect(res.status(), await res.text()).toBe(200);
  expect((await res.json()).message).toBe('บันทึกการแก้ไขสำเร็จ');
  expect((await detail(b.id)).attendees.map((a) => a.id).sort()).toEqual([u2.id, u3.id].sort());
  await new Promise((r) => setTimeout(r, 3000)); // เผื่อเวลาส่งจดหมาย ก่อนยืนยันว่า "ไม่มี"
  expect(await mailsAbout(t), 'การแก้เฉพาะรายชื่อผู้เข้าร่วมต้องไม่ส่ง Email').toHaveLength(0);

  // ตัวควบคุม: การจองเดียวกัน พอเปลี่ยนเวลา อีเมลต้องมาจริง — พิสูจน์ว่าการตรวจ "ไม่มี" ข้างบนมองเห็นอีเมลได้
  const moved = await edit(slot.startAt.replace('T10:', 'T11:'), slot.endAt.replace('T11:', 'T12:'));
  expect(moved.status(), await moved.text()).toBe(200);
  const m = await waitFor(t, 'เปลี่ยนเวลา');
  expect(m.To.map((x) => x.Address).sort()).toEqual([u1.email, u2.email, u3.email].sort());
});

test('[real] TC-BKG-UI006-111 จองใหม่ที่จบตรงเวลาเริ่มของการจองเดิม → จองได้ (BR-mrr-001)', async () => {
  const slot = nearSlot(8, 2); // กันไว้สองชั่วโมง: 08:mm–09:mm ของเคส และ 09:mm–10:mm ของการจองเดิม
  const later = { ...slot, startAt: slot.startAt.replace('T08:', 'T09:'), endAt: slot.endAt.replace('T09:', 'T10:') };
  const first = await book(clients.u1, 'open', later, title('การจองเดิม'));
  // book() อาจย้ายวันของ `later` ถ้าชน จึงยึดวันจากค่าที่จองได้จริง และยิงตรงเพื่อไม่ให้การจองที่สองถูกย้ายวัน
  const before = { startAt: later.date + slot.startAt.slice(10), endAt: later.startAt };
  expect(Date.parse(before.startAt)).toBeGreaterThan(Date.now());

  const res = await clients.u1.post('/bookings', {
    data: { roomId: world.rooms.open, ...before, title: title('จองต่อหน้า'), attendeeIds: [world.users.ra1.id], equipmentIds: [] },
  });
  expect(res.status(), await res.text()).toBe(201);
  const second = await res.json();
  expect(second.status).toBe('CONFIRMED');
  expect(second.message).toBe('จองห้องสำเร็จ');
  expect((await detail(first.id)).status).toBe('CONFIRMED');
});
