import { execFileSync } from 'node:child_process';
import { expect, request, test, type APIRequestContext } from '@playwright/test';
import { resetClock, setClock } from './support/clock';
import { as, book, nearSlot, stateOf, world } from './support/world';

/**
 * เคสจาก T1 ที่ต้องควบคุมเวลา (OQ-T1-01) — ใช้ /__test/clock ของ api (เปิดเฉพาะ dev stack · support/clock.ts).
 * หลักการ: สร้างการจอง/รหัสด้วยเวลาจริง แล้วเลื่อนนาฬิกาของ api ไปที่ขอบเขตที่ต้องการ ("ก่อนเริ่ม 1 นาที", "เริ่มพอดี",
 * "รหัสหมดอายุพอดี") แล้วค่อยลงมือ. ทุกเคส [real]; afterEach คืนนาฬิกา.
 * เคสที่ต้องการงานตามเวลา (เตือน 15 นาที / ยกเลิกอัตโนมัติ) ไม่อยู่ที่นี่: ยังไม่มีงานเหล่านั้นรันใน api (ดู t1-test-cases.md §D).
 */

const RUN = Date.now().toString(36);
const title = (s: string) => `E2E ${s} ${RUN}`;
const MAIL = 'http://localhost:8025/api/v1/messages';
const REQUESTED = 'หากเป็น Email ในระบบ เราได้ส่งรหัสเข้าสู่ระบบไปแล้ว กรุณาตรวจสอบ Email';

const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-c', sql], { encoding: 'utf8' }).trim();

const clients: Record<string, APIRequestContext> = {};
test.beforeAll(async () => {
  for (const k of ['u1', 'u2', 'u3', 'ra1', 'ra2']) clients[k] = await as(k);
});
test.afterEach(resetClock);
test.afterAll(async () => {
  await resetClock();
  await Promise.all(Object.values(clients).map((c) => c.dispose()));
  // ลบเฉพาะแถวที่ไม่มีร่องรอย (ร่องรอยเป็นแบบเพิ่มอย่างเดียว · BR-mrr-018) และไม่มีคำขอแก้ไขค้าง
  const mine = `select id from bookings where title like 'E2E%${RUN}' and id not in (select booking_id from booking_audit_entries) and id not in (select booking_id from booking_adjustment_requests)`;
  for (const t of ['booking_attendees', 'booking_equipment_requests']) psql(`delete from ${t} where booking_id in (${mine})`);
  psql(`delete from bookings where id in (${mine})`);
});

const msgOf = async (res: { json(): Promise<{ message: string }> }) => (await res.json()).message;
const statusOf = async (id: string) => (await (await clients.ra1.get(`/bookings/${id}`)).json()).status as string;
const startOf = (slot: { startAt: string }) => new Date(slot.startAt);
const at = (d: Date, ms: number) => new Date(d.getTime() + ms);

interface Mail { ID: string; Subject: string; To: { Address: string }[] }
const mails = async (): Promise<Mail[]> => ((await (await fetch(MAIL)).json()).messages ?? []) as Mail[];
async function waitMail(match: (m: Mail) => boolean): Promise<Mail | undefined> {
  for (let i = 0; i < 20; i++) {
    const m = (await mails()).find(match);
    if (m) return m;
    await new Promise((r) => setTimeout(r, 500));
  }
  return undefined;
}
const addressesOf = (m: Mail) => m.To.map((t) => t.Address).sort();

// ------------------------------------------------------------------ จุดตัดเวลาเริ่มประชุม (BR-mrr-009 · BR-mrr-011)
test.describe('จุดตัดเวลาเริ่มประชุม', () => {
  test('[real] TC-MYB-UI007-104 ก่อนเริ่ม 1 นาที ผู้จองยกเลิกเองได้ (EX-mrr-026 · BR-mrr-009)', async () => {
    const slot = nearSlot();
    const b = await book(clients.u1, 'open', slot, title('ยกเลิกก่อนเริ่ม 1 นาที'));
    await setClock(at(startOf(slot), -60_000));
    const res = await clients.u1.post(`/bookings/${b.id}/cancel`);
    expect(res.status(), await res.text()).toBeLessThan(300);
    expect(await msgOf(res)).toBe('ยกเลิกการจองสำเร็จ');
    expect(await statusOf(b.id)).toBe('CANCELLED');
  });

  test('[real] TC-MYB-UI007-105 ถึงเวลาเริ่มพอดี ผู้จองยกเลิกเองไม่ได้ (EX-mrr-027 · BR-mrr-009)', async () => {
    const slot = nearSlot();
    const b = await book(clients.u1, 'open', slot, title('ยกเลิกตอนเริ่มพอดี'));
    await setClock(startOf(slot));
    const res = await clients.u1.post(`/bookings/${b.id}/cancel`);
    expect(res.status()).toBe(409);
    expect(await msgOf(res)).toBe('การประชุมเริ่มแล้ว กรุณาติดต่อผู้ดูแลห้องเพื่อแก้ไขหรือยกเลิก');
    expect(await statusOf(b.id)).toBe('CONFIRMED');
  });

  test('[real] TC-APR-UI010-101 เริ่มแล้ว RA ยกเลิกแทนผู้จองพร้อมเหตุผล → ยกเลิกสำเร็จ (EX-mrr-028 · BR-mrr-009)', async () => {
    const slot = nearSlot();
    const b = await book(clients.u1, 'open', slot, title('RA ยกเลิกแทน'));
    await setClock(startOf(slot));
    const res = await clients.ra1.post(`/bookings/${b.id}/admin-cancel`, { data: { reason: 'ห้องต้องใช้จัดงานด่วน' } });
    expect(res.status(), await res.text()).toBeLessThan(300);
    expect(await msgOf(res)).toBe('ยกเลิกการจองสำเร็จ');
    expect(await statusOf(b.id)).toBe('CANCELLED');
  });

  test('[real] TC-AUD-UI010-102 RA ยกเลิกแทน → ร่องรอย 1 รายการ "ยกเลิกแทนผู้จอง" พร้อมเหตุผล และ RA คนอื่นเห็น (EX-mrr-055 · 058 · BR-mrr-017)', async () => {
    const slot = nearSlot();
    const b = await book(clients.u1, 'open', slot, title('ร่องรอยยกเลิกแทน'));
    await setClock(startOf(slot));
    expect((await clients.ra1.post(`/bookings/${b.id}/admin-cancel`, { data: { reason: 'ห้องต้องใช้จัดงานด่วน' } })).status()).toBeLessThan(300);
    for (const who of ['ra1', 'ra2']) {
      const trail = await (await clients[who].get(`/bookings/${b.id}/audit`)).json();
      expect(trail).toHaveLength(1);
      expect(trail[0]).toMatchObject({ action: 'CANCEL_ON_BEHALF', reason: 'ห้องต้องใช้จัดงานด่วน' });
      expect(trail[0].actor.id).toBe(world.users.ra1.id);
    }
  });

  test('[real] TC-APR-UI010-105 ก่อนเริ่ม 1 นาที RA เปลี่ยนผลได้ (EX-mrr-037 · BR-mrr-011)', async () => {
    const slot = nearSlot();
    const b = await book(clients.u1, 'appr', slot, title('เปลี่ยนผลก่อนเริ่ม 1 นาที'));
    expect((await clients.ra1.post(`/bookings/${b.id}/reject`)).status()).toBeLessThan(300);
    expect(await statusOf(b.id)).toBe('REJECTED');
    await setClock(at(startOf(slot), -60_000));
    const res = await clients.ra1.post(`/bookings/${b.id}/decision`, { data: { decision: 'APPROVED', reason: 'ปฏิเสธผิดคน' } });
    expect(res.status(), await res.text()).toBeLessThan(300);
    expect(await msgOf(res)).toBe('เปลี่ยนผลการอนุมัติสำเร็จ');
    expect(await statusOf(b.id)).toBe('APPROVED');
  });

  test('[real] TC-APR-UI010-106 ถึงเวลาเริ่มพอดี RA เปลี่ยนผลไม่ได้ (EX-mrr-038 · BR-mrr-011)', async () => {
    const slot = nearSlot();
    const b = await book(clients.u1, 'appr', slot, title('เปลี่ยนผลตอนเริ่มพอดี'));
    expect((await clients.ra1.post(`/bookings/${b.id}/approve`)).status()).toBeLessThan(300);
    await setClock(startOf(slot));
    const res = await clients.ra1.post(`/bookings/${b.id}/decision`, { data: { decision: 'REJECTED', reason: 'อนุมัติผิดห้อง' } });
    expect(res.status()).toBe(409);
    expect(await msgOf(res)).toBe('การประชุมเริ่มแล้ว ไม่สามารถเปลี่ยนผลการอนุมัติได้');
    expect(await statusOf(b.id)).toBe('APPROVED');
  });
});

// ------------------------------------------------------------------ แก้การจองหลังประชุมจบ (BR-mrr-014)
test.describe.serial('แก้การจองที่ประชุมจบแล้ว = คำขอแก้ไข (BR-mrr-014)', () => {
  const slot = nearSlot();
  const original = title('ประชุมทีม');
  const edited = title('ประชุมวางแผน');
  let id: string;
  let requestId: string;
  const afterEnd = () => at(new Date(slot.endAt), 60_000);

  const pendingFor = async (who: APIRequestContext) => {
    const page = await (await who.get('/adjustment-requests?status=PENDING')).json();
    return (page.items as { id: string; booking: { id: string }; canDecide: boolean }[]).find((r) => r.booking.id === id);
  };

  test.beforeAll(async () => {
    id = (await book(clients.u1, 'open', slot, original)).id;
  });

  test('[real] TC-APR-UI010-107 หลังจบประชุม RA1 แก้หัวข้อ → สร้างคำขอแก้ไข หัวข้อเดิมคงอยู่ (EX-mrr-043)', async () => {
    await setClock(afterEnd());
    const res = await clients.ra1.post(`/bookings/${id}/admin-edit`, { data: { title: edited, reason: 'ผู้จองพิมพ์หัวข้อผิด' } });
    expect(res.status(), await res.text()).toBeLessThan(300);
    expect(await msgOf(res)).toBe('ส่งคำขอแก้ไขแล้ว รอผู้ดูแลห้องคนอื่นอนุมัติ');
    expect((await (await clients.ra1.get(`/bookings/${id}`)).json()).title).toBe(original);
    const req = await pendingFor(clients.ra2);
    expect(req, 'ต้องมีคำขอแก้ไขที่รออนุมัติ').toBeDefined();
    requestId = req!.id;
  });

  test('[real] TC-APR-UI011-102 RA1 อนุมัติคำขอของตัวเอง → ปฏิเสธ คำขอยังรออนุมัติ (EX-mrr-046)', async () => {
    await setClock(afterEnd());
    const res = await clients.ra1.post(`/adjustment-requests/${requestId}/approve`);
    expect(res.status()).toBe(403);
    expect(await msgOf(res)).toBe('ผู้แก้ไขอนุมัติคำขอของตัวเองไม่ได้ ต้องให้ผู้ดูแลห้องคนอื่นอนุมัติ');
    expect((await (await clients.ra1.get(`/bookings/${id}`)).json()).title).toBe(original);
    expect(await pendingFor(clients.ra2)).toBeDefined();
  });

  test('[real] TC-APR-UI011-101 RA2 อนุมัติคำขอ → หัวข้อเปลี่ยน (EX-mrr-045)', async () => {
    await setClock(afterEnd());
    const res = await clients.ra2.post(`/adjustment-requests/${requestId}/approve`);
    expect(res.status(), await res.text()).toBeLessThan(300);
    expect(await msgOf(res)).toBe('อนุมัติคำขอแก้ไขสำเร็จ');
    expect((await (await clients.ra1.get(`/bookings/${id}`)).json()).title).toBe(edited);
    expect(await pendingFor(clients.ra2)).toBeUndefined();
  });

  test('[real] TC-APR-UI010-108 ระหว่างประชุม (ยังไม่จบ) RA1 แก้หัวข้อ → มีผลทันที ไม่มีคำขอ (EX-mrr-044)', async () => {
    const s = nearSlot();
    const b = await book(clients.u1, 'open', s, title('ประชุมทีมระหว่างประชุม'));
    await setClock(at(startOf(s), 10 * 60_000));
    const newTitle = title('ประชุมวางแผนระหว่างประชุม');
    const res = await clients.ra1.post(`/bookings/${b.id}/admin-edit`, { data: { title: newTitle, reason: 'ผู้จองพิมพ์หัวข้อผิด' } });
    expect(res.status(), await res.text()).toBeLessThan(300);
    expect(await msgOf(res)).toBe('บันทึกการแก้ไขสำเร็จ');
    expect((await (await clients.ra1.get(`/bookings/${b.id}`)).json()).title).toBe(newTitle);
    const page = await (await clients.ra2.get('/adjustment-requests?status=PENDING')).json();
    expect((page.items as { booking: { id: string } }[]).some((r) => r.booking.id === b.id)).toBe(false);
  });
});

// ------------------------------------------------------------------ แจ้งเตือน (BR-mrr-007 · BR-mrr-008)
test.describe('แจ้งเตือนทาง Email', () => {
  test('[real] TC-NTF-UI006-101 จองเมื่อเหลือ < 15 นาทีก่อนเริ่ม → ได้อีเมลจองสำเร็จ และเตือนทันทีถึงผู้จองกับผู้เข้าร่วม (EX-mrr-024 · BR-mrr-008)', async () => {
    const slot = nearSlot();
    const t = title('ประชุมด่วน');
    await setClock(at(startOf(slot), -10 * 60_000));
    await book(clients.u1, 'open', slot, t, [world.users.u2.id]);
    const confirmed = await waitMail((m) => m.Subject.startsWith(`[จองห้องประชุม] จองสำเร็จ: ${t}`));
    const reminder = await waitMail((m) => m.Subject.startsWith(`[จองห้องประชุม] ใกล้ถึงเวลาประชุม: ${t}`));
    expect(confirmed, 'ไม่พบอีเมลจองสำเร็จ').toBeDefined();
    expect(reminder, 'ไม่พบอีเมลเตือนทันที').toBeDefined();
    expect(addressesOf(confirmed!)).toEqual([world.users.u1.email]);
    expect(addressesOf(reminder!)).toEqual([world.users.u1.email, world.users.u2.email].sort());
  });

  test('[real] ส่วนที่ TC-BKG-UI006-026 ยังไม่คลุม: จองสำเร็จ → Email ถึงผู้จองคนเดียว ผู้เข้าร่วมไม่ได้รับ (EX-mrr-019 · BR-mrr-007)', async () => {
    const t = title('จองสำเร็จถึงผู้จองเท่านั้น');
    await book(clients.u1, 'open', nearSlot(), t, [world.users.u2.id, world.users.u3.id]);
    const m = await waitMail((x) => x.Subject.startsWith(`[จองห้องประชุม] จองสำเร็จ: ${t}`));
    expect(m).toBeDefined();
    expect(addressesOf(m!)).toEqual([world.users.u1.email]);
  });

  test('[real] TC-NTF-UI008-101 เปลี่ยนเวลา → Email ถึงผู้จองและผู้เข้าร่วมทุกคน (EX-mrr-021 · BR-mrr-007)', async () => {
    const slot = nearSlot(10);
    const t = title('เปลี่ยนเวลา');
    const b = await book(clients.u1, 'open', slot, t, [world.users.u2.id, world.users.u3.id]);
    const later = nearSlot(15);
    const res = await clients.u1.patch(`/bookings/${b.id}`, {
      data: { startAt: slot.startAt.replace('T10:', 'T14:'), endAt: slot.endAt.replace('T11:', 'T15:'), title: t, attendeeIds: [world.users.u2.id, world.users.u3.id] },
    });
    expect(later).toBeDefined();
    expect(res.status(), await res.text()).toBeLessThan(300);
    const m = await waitMail((x) => x.Subject.startsWith(`[จองห้องประชุม] เปลี่ยนเวลา: ${t}`));
    expect(m, 'ไม่พบอีเมลเปลี่ยนเวลา').toBeDefined();
    expect(addressesOf(m!)).toEqual([world.users.u1.email, world.users.u2.email, world.users.u3.email].sort());
  });
});

// ------------------------------------------------------------------ ค่าตั้งห้องมีผลกับการจอง (BR-mrr-010@v2)
test.describe.serial('แก้ค่าตั้งห้อง E2E-FLIP (BR-mrr-010@v2)', () => {
  const room = () => world.rooms.flip;
  const settings = async (patch: { requiresApproval?: boolean; capacity?: number }) => {
    const cur = await (await clients.ra1.get(`/rooms/${room()}`)).json();
    const res = await clients.ra1.post(`/rooms/${room()}/versions`, {
      data: {
        name: cur.name, capacity: patch.capacity ?? cur.capacity, photos: cur.photos ?? [], facilityIds: cur.facilityIds ?? [],
        requiresApproval: patch.requiresApproval ?? cur.requiresApproval, approverId: null,
      },
    });
    expect(res.status(), await res.text()).toBeLessThan(300);
    return msgOf(res);
  };
  test.beforeEach(() => settings({ requiresApproval: false, capacity: 99 }));
  test.afterAll(() => settings({ requiresApproval: false, capacity: 99 }));

  const pendingIds = async () => ((await (await clients.ra1.get('/bookings?status=PENDING_APPROVAL')).json()).items as { id: string }[]).map((x) => x.id);

  test('[real] TC-RMM-UI013-105 แก้ห้องเป็นต้องอนุมัติ → การจองเดิมที่ยังไม่เริ่มกลับเป็นรออนุมัติ ไม่ส่ง Email (EX-mrr-078)', async () => {
    const b = await book(clients.u1, 'flip', nearSlot(), title('กลับไปรออนุมัติ'));
    expect(b.status).toBe('CONFIRMED');
    await fetch(MAIL, { method: 'DELETE' });
    expect(await settings({ requiresApproval: true })).toBe('บันทึกข้อมูลห้องสำเร็จ');
    expect(await statusOf(b.id)).toBe('PENDING_APPROVAL');
    expect(await pendingIds()).toContain(b.id);
    await new Promise((r) => setTimeout(r, 2500));
    expect((await mails()).filter((m) => m.Subject.includes(title('กลับไปรออนุมัติ')))).toHaveLength(0);
  });

  test('[real] TC-RMM-UI013-106 แก้ห้องเป็นไม่ต้องอนุมัติ → การจองที่รออนุมัติใช้ได้ทันที (ไม่ขึ้น "อนุมัติแล้ว") และได้ Email (EX-mrr-079)', async () => {
    await settings({ requiresApproval: true });
    const t = title('ใช้ได้ทันที');
    const b = await book(clients.u1, 'flip', nearSlot(), t);
    expect(b.status).toBe('PENDING_APPROVAL');
    await fetch(MAIL, { method: 'DELETE' });
    expect(await settings({ requiresApproval: false })).toBe('บันทึกข้อมูลห้องสำเร็จ');
    expect(await statusOf(b.id)).toBe('CONFIRMED');
    expect(await pendingIds()).not.toContain(b.id);
    const m = await waitMail((x) => x.Subject.startsWith(`[จองห้องประชุม] จองสำเร็จ: ${t}`));
    expect(m, 'ผู้จองต้องได้อีเมลจองสำเร็จ').toBeDefined();
    expect(addressesOf(m!)).toEqual([world.users.u1.email]);
  });

  test('[real] TC-RMM-UI013-107 แก้ห้องตอนเวลาเริ่มของการจองหนึ่งพอดี → รายการนั้นถือว่าเริ่มแล้วไม่กลับไปรออนุมัติ รายการที่เริ่มทีหลังกลับ (EX-mrr-080)', async () => {
    const slot = nearSlot(10);
    const first = await book(clients.u1, 'flip', slot, title('เริ่มพอดี'));
    const later = { startAt: slot.startAt.replace('T10:', 'T11:'), endAt: slot.endAt.replace('T11:', 'T12:') };
    const second = await book(clients.u2, 'flip', later, title('เริ่มทีหลัง'));
    await setClock(startOf(slot));
    await settings({ requiresApproval: true });
    expect(await statusOf(first.id)).toBe('CONFIRMED');
    expect(await statusOf(second.id)).toBe('PENDING_APPROVAL');
    const pending = await pendingIds();
    expect(pending).not.toContain(first.id);
    expect(pending).toContain(second.id);
  });

  test('[real] TC-BKG-UI006-101 หลังแก้ห้องเป็นต้องอนุมัติ ผู้ใช้อีกคนจอง → รออนุมัติ ใช้ค่าตั้งใหม่ (EX-mrr-030)', async () => {
    await settings({ requiresApproval: true });
    const b = await book(clients.u2, 'flip', nearSlot(), title('จองหลังแก้ห้อง'));
    expect(b.status).toBe('PENDING_APPROVAL');
    expect(b.message).toBe('ส่งคำขอจองแล้ว รอการอนุมัติ');
  });

  test('[real] TC-BKG-UI006-102 เปิดฟอร์มไว้ ห้องถูกแก้เป็นต้องอนุมัติ แล้วกดยืนยัน → นับตามเวลากดยืนยัน ได้รออนุมัติ (EX-mrr-033)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: stateOf('u2'), baseURL: 'http://localhost:4173', locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    // ฟอร์มจองตรง ๆ ไม่มีการเลื่อนวันเหมือน book() และห้อง E2E-FLIP เก็บการจองไว้ถาวร — เลือกช่วงที่ยังว่างก่อน
    let slot = nearSlot();
    while (Number(psql(`select count(*) from bookings where room_id = '${world.rooms.flip}' and status in ('CONFIRMED','APPROVED','PENDING_APPROVAL') and tstzrange(start_at, end_at) && tstzrange('${slot.startAt}', '${slot.endAt}')`)) > 0) slot = nearSlot();
    const local = (iso: string) => iso.slice(0, 16);
    await page.goto(`/UI-mrr-006?room=${room()}`);
    await expect(page.getByTestId('ui-mrr-006-ent-007-room')).not.toHaveText(/กำลังโหลด|—/);
    await settings({ requiresApproval: true }); // แก้ระหว่างที่ฟอร์มเปิดอยู่
    await page.getByTestId('ui-mrr-006-ent-007-start-at').fill(local(slot.startAt));
    await page.getByTestId('ui-mrr-006-ent-007-end-at').fill(local(slot.endAt));
    await page.getByTestId('ui-mrr-006-ent-007-title').fill(title('ประชุมย่อย'));
    await page.getByTestId('ui-mrr-006-ent-008-user').fill('admin');
    await page.getByRole('list', { name: 'ผลการค้นหาผู้ใช้' }).getByRole('button').first().click();
    const created = page.waitForResponse((r) => r.url().endsWith('/bookings') && r.request().method() === 'POST');
    await page.getByTestId('ui-mrr-006-confirm').click();
    const body = await (await created).json();
    expect(body.status).toBe('PENDING_APPROVAL');
    await expect(page.getByText('ส่งคำขอจองแล้ว รอการอนุมัติ', { exact: true })).toBeVisible();
    await ctx.close();
  });

  test('[real] TC-BKG-UI006-103 ความจุไม่บังคับจำนวนผู้เข้าร่วม ทั้งการจองเดิมและการจองหลังแก้ความจุ (EX-mrr-034)', async () => {
    const four = [world.users.ra1.id, world.users.ra2.id, world.users.u3.id, world.users.u2.id];
    const before = await book(clients.u1, 'flip', nearSlot(), title('ผู้เข้าร่วมเกินความจุเดิม'), four);
    await settings({ capacity: 2 });
    const after = await book(clients.u2, 'flip', nearSlot(), title('ผู้เข้าร่วมเกินความจุใหม่'), four);
    expect(after.status).toBe('CONFIRMED');
    expect(after.message).toBe('จองห้องสำเร็จ');
    expect(await statusOf(before.id)).toBe('CONFIRMED');
  });
});

// ------------------------------------------------------------------ รหัสเข้าสู่ระบบ: อายุ 10 นาที (BR-mrr-025 · 027 · 028)
test.describe('อายุรหัสเข้าสู่ระบบ', () => {
  const EMAIL = 'tester@mrr.local';
  let api: APIRequestContext;
  test.beforeEach(async () => {
    psql("update login_codes set status='EXPIRED' where status='ISSUED'");
    await fetch(MAIL, { method: 'DELETE' });
    api = await request.newContext({ baseURL: 'http://localhost:4173' });
  });
  test.afterEach(async () => {
    await api.dispose();
    await resetClock(); // codes issued while the clock was ahead are stamped in the future; drop them
    psql('delete from login_codes where issued_at > now()');
    psql("update login_codes set status='EXPIRED' where status='ISSUED'");
    await fetch(MAIL, { method: 'DELETE' });
  });

  const ask = () => api.post('/auth/otp/request', { data: { email: EMAIL } });
  const verify = (code: string) => api.post('/auth/otp/verify', { data: { email: EMAIL, code } });
  const expiryOfLatest = () => new Date(psql("select expires_at from login_codes lc join users u on u.id = lc.user_id where u.email = 'tester@mrr.local' order by lc.issued_at desc limit 1"));
  async function codeFromMail(): Promise<string> {
    const m = await waitMail((x) => x.To.some((t) => t.Address === EMAIL) && x.Subject.includes('รหัสเข้าสู่ระบบ'));
    expect(m, 'ไม่พบอีเมลรหัสใน mailpit').toBeDefined();
    return /(\d{6})/.exec((await (await fetch(`http://localhost:8025/api/v1/message/${m!.ID}`)).json()).Text as string)![1];
  }

  test('[real] TC-AUTH-UI002-101 กรอกรหัสก่อนหมดอายุ 1 วินาที → เข้าสู่ระบบได้ (EX-mrr-100 · BR-mrr-027)', async () => {
    expect((await ask()).status()).toBeLessThan(300);
    const code = await codeFromMail();
    await setClock(at(expiryOfLatest(), -1000));
    const res = await verify(code);
    expect(res.status(), await res.text()).toBeLessThan(300);
    expect((await api.get('/auth/me')).status()).toBe(200);
  });

  test('[real] TC-AUTH-UI002-102 กรอกรหัสตอนหมดอายุพอดี → รหัสหมดอายุ ไม่สร้าง session (EX-mrr-101 · BR-mrr-027 · BR-mrr-028)', async () => {
    await ask();
    const code = await codeFromMail();
    await setClock(expiryOfLatest());
    const res = await verify(code);
    expect(res.status()).toBe(410);
    expect(await msgOf(res)).toBe('รหัสหรือลิงก์เข้าสู่ระบบหมดอายุแล้ว กรุณาขอรหัสใหม่');
    expect((await api.get('/auth/me')).status()).toBe(401);
  });

  test('[real] TC-AUTH-UI001-105 ขอรหัสซ้ำก่อนรหัสเดิมหมดอายุ 1 วินาที → error ไม่ออกรหัสใหม่ รหัสเดิมยังใช้ได้ (EX-mrr-095 · BR-mrr-025)', async () => {
    await ask();
    const code = await codeFromMail();
    const before = (await mails()).length;
    await setClock(at(expiryOfLatest(), -1000));
    const again = await ask();
    expect(again.status()).toBe(409);
    expect(await msgOf(again)).toBe('ส่งรหัสไปแล้ว กรุณาใช้รหัสเดิมใน Email หรือรอให้รหัสหมดอายุก่อนขอใหม่');
    expect((await verify(code)).status(), 'รหัสเดิมต้องยังใช้ได้').toBeLessThan(300); // ทันที — นาฬิกาเดินต่อจากที่ตั้งไว้
    await new Promise((r) => setTimeout(r, 1500));
    expect((await mails()).length, 'ต้องไม่มีอีเมลฉบับใหม่').toBe(before);
  });

  test('[real] TC-AUTH-UI001-106 ขอรหัสใหม่ตอนรหัสเดิมหมดอายุพอดี → ได้รหัสใหม่ (EX-mrr-096 · BR-mrr-025)', async () => {
    await ask();
    const first = await codeFromMail();
    await fetch(MAIL, { method: 'DELETE' });
    await setClock(expiryOfLatest());
    const again = await ask();
    expect(again.status(), await again.text()).toBeLessThan(300);
    expect(await msgOf(again)).toBe(REQUESTED);
    const second = await codeFromMail();
    expect(second).not.toBe(first);
  });
});
