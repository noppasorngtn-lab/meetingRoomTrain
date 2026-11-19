import { expect, test, type APIRequestContext } from '@playwright/test';
import { as, book, nearSlot, stateOf, world } from './support/world';
import { myBookingIds } from './support/my-bookings';

/**
 * เคสจาก T1 (docs/qa/t1-test-cases.csv) ที่เคยเป็น Partial เพราะต้องมีหลายบทบาท — ตอนนี้ global-setup
 * สร้างผู้ใช้ u2–u5, ra2, sa และห้อง E2E-* ให้แล้ว (support/accounts.ts). ไม่ต้องควบคุมเวลา: ทุกการจองอยู่ 2–29 วันข้างหน้า.
 * ทุกเคส [real]. คำสั่งที่ "ปุ่มถูกซ่อน" ยิงตรงด้วย session ของบทบาทนั้น (OQ-T1-04) ส่วนที่มีหน้าจอตรวจผ่านหน้าจอด้วย.
 * หัวข้อการจองขึ้นต้น `E2E` และมี RUN; afterAll ลบแถวของรอบนี้ที่ "ไม่มีร่องรอย" — ร่องรอยเป็นแบบเพิ่มอย่างเดียว
 * (trigger ของ DB · BR-mrr-018) การจองที่มีรายการร่องรอยจึงลบไม่ได้และค้างอยู่ (อยู่ท้ายรายการ ไม่กระทบเคสอื่น).
 */

const RUN = Date.now().toString(36);
const title = (s: string) => `E2E ${s} ${RUN}`;

const clients: Record<string, APIRequestContext> = {};
test.beforeAll(async () => {
  for (const k of ['u1', 'u2', 'u3', 'u4', 'ra1', 'ra2', 'sa']) clients[k] = await as(k);
});
test.afterAll(async () => {
  await Promise.all(Object.values(clients).map((c) => c.dispose()));
  const { execFileSync } = await import('node:child_process');
  const psql = (sql: string) => execFileSync('docker', ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-c', sql], { encoding: 'utf8' });
  const mine = `select id from bookings where title like 'E2E%${RUN}' and id not in (select booking_id from booking_audit_entries)`;
  for (const t of ['booking_attendees', 'booking_equipment_requests', 'booking_adjustment_requests']) {
    psql(`delete from ${t} where booking_id in (${mine})`);
  }
  psql(`delete from bookings where id in (${mine})`);
});

const statusOf = async (who: APIRequestContext, id: string) => (await (await who.get(`/bookings/${id}`)).json()).status as string;
const msgOf = async (res: { json(): Promise<{ message: string }> }) => (await res.json()).message;

// ------------------------------------------------------------------ จองต่อจากผู้จองที่ยกเลิก · ขอบเขตผู้จอง
test.describe('ผู้ใช้หลายคน (BR-mrr-001 · BR-mrr-003)', () => {
  test('[real] TC-BKG-UI006-022 จองช่วงที่ผู้จองยกเลิกแล้ว → ผู้ใช้อีกคนจองได้ (EX-mrr-004 · BR-mrr-001)', async () => {
    const slot = nearSlot();
    const first = await book(clients.u1, 'open', slot, title('ยกเลิกแล้วจองต่อ'));
    expect((await clients.u1.post(`/bookings/${first.id}/cancel`)).status()).toBeLessThan(300);
    const second = await book(clients.u2, 'open', slot, title('จองต่อจากที่ยกเลิก'));
    expect(second.status).toBe('CONFIRMED');
    expect(second.message).toBe('จองห้องสำเร็จ');
  });

  test('[real] TC-MYB-UI007-102 ผู้ใช้อื่นยกเลิกการจองของคนอื่น (ยิงตรง) → ปฏิเสธ การจองคงเดิม (EX-mrr-010 · BR-mrr-003)', async () => {
    const b = await book(clients.u1, 'open', nearSlot(), title('ถูกคนอื่นยกเลิก'));
    const res = await clients.u2.post(`/bookings/${b.id}/cancel`);
    expect([403, 404]).toContain(res.status());
    expect(await msgOf(res)).toBe('เฉพาะผู้จองเท่านั้นที่แก้ไขหรือยกเลิกได้');
    expect(await statusOf(clients.u1, b.id)).toBe('CONFIRMED');
  });

  test('[real] TC-MYB-UI007-103 การจองของฉันแสดงเฉพาะที่ตัวเองสร้าง (EX-mrr-011 · BR-mrr-003)', async () => {
    const mineB = await book(clients.u1, 'open', nearSlot(), title('ของ U1'));
    const theirs = await book(clients.u2, 'open', nearSlot(), title('ของ U2'), [world.users.u1.id]); // U1 เป็นผู้เข้าร่วม ไม่ใช่ผู้จอง
    const seen = await myBookingIds(clients.u1); // ทุกหน้าที่ api บอก ไม่หยุดที่จำนวนหน้าตายตัว (เดิมหยุดที่ 50 หน้า = 1,000 แถว แต่ U1 มี 1,267)
    expect(seen.has(mineB.id)).toBe(true);
    expect(seen.has(theirs.id), 'การจองที่ตนเป็นแค่ผู้เข้าร่วมต้องไม่อยู่ในรายการ').toBe(false);
  });
});

// ------------------------------------------------------------------ อนุมัติ
test.describe('อนุมัติการจอง (BR-mrr-004 · BR-mrr-013)', () => {
  test('[real] TC-APR-UI009-101 Room Administrator อนุมัติ → อนุมัติแล้ว (EX-mrr-013 · BR-mrr-004)', async () => {
    const b = await book(clients.u1, 'appr', nearSlot(), title('รออนุมัติ'));
    expect(b.status).toBe('PENDING_APPROVAL');
    const res = await clients.ra1.post(`/bookings/${b.id}/approve`);
    expect(res.status()).toBeLessThan(300);
    expect(await msgOf(res)).toBe('อนุมัติการจองสำเร็จ');
    expect(await statusOf(clients.ra1, b.id)).toBe('APPROVED');
  });

  test('[real] TC-APR-UI009-102 ผู้จองอนุมัติของตัวเอง (ยิงตรง) → ปฏิเสธ ยังรออนุมัติ (EX-mrr-014 · BR-mrr-004)', async () => {
    const b = await book(clients.u1, 'appr', nearSlot(), title('อนุมัติเอง'));
    const res = await clients.u1.post(`/bookings/${b.id}/approve`);
    expect(res.status()).toBe(403);
    expect(await msgOf(res)).toBe('เฉพาะผู้ดูแลห้องเท่านั้นที่อนุมัติได้');
    expect(await statusOf(clients.ra1, b.id)).toBe('PENDING_APPROVAL');
  });

  test('[real] TC-APR-UI009-103 ห้องกำหนดผู้อนุมัติเป็น RA1 → RA1 อนุมัติได้ (EX-mrr-039 · BR-mrr-013)', async () => {
    const b = await book(clients.u1, 'appr1', nearSlot(), title('ผู้อนุมัติประจำห้อง ok'));
    const res = await clients.ra1.post(`/bookings/${b.id}/approve`);
    expect(res.status()).toBeLessThan(300);
    expect(await msgOf(res)).toBe('อนุมัติการจองสำเร็จ');
    expect(await statusOf(clients.ra1, b.id)).toBe('APPROVED');
  });

  test('[real] TC-APR-UI009-104 ห้องกำหนดผู้อนุมัติเป็น RA1 → RA2 อนุมัติไม่ได้ ยังรออนุมัติ (EX-mrr-040 · BR-mrr-013)', async () => {
    const b = await book(clients.u1, 'appr1', nearSlot(), title('ผู้อนุมัติประจำห้อง ไม่ใช่ RA2'));
    const res = await clients.ra2.post(`/bookings/${b.id}/approve`);
    expect(res.status()).toBe(403);
    expect(await msgOf(res)).toBe('เฉพาะผู้อนุมัติประจำห้องนี้เท่านั้นที่อนุมัติได้');
    expect(await statusOf(clients.ra1, b.id)).toBe('PENDING_APPROVAL');
  });

  test('[real] TC-APR-UI009-105 ห้องที่ยังไม่กำหนดผู้อนุมัติ → RA2 อนุมัติได้ (EX-mrr-041 · BR-mrr-013)', async () => {
    const b = await book(clients.u1, 'appr', nearSlot(), title('ไม่กำหนดผู้อนุมัติ'));
    const res = await clients.ra2.post(`/bookings/${b.id}/approve`);
    expect(res.status()).toBeLessThan(300);
    expect(await msgOf(res)).toBe('อนุมัติการจองสำเร็จ');
    expect(await statusOf(clients.ra1, b.id)).toBe('APPROVED');
  });

  test('[real] TC-RMM-UI013-104 RA กำหนดผู้อนุมัติประจำห้อง → บันทึกสำเร็จ กำหนดทีหลังได้ (EX-mrr-042 · BR-mrr-013)', async () => {
    const room = world.rooms.setapr;
    const before = await (await clients.ra1.get(`/rooms/${room}`)).json();
    const res = await clients.ra1.post(`/rooms/${room}/versions`, {
      data: {
        name: before.name, capacity: before.capacity, photos: before.photos ?? [], facilityIds: before.facilityIds ?? [],
        requiresApproval: true, approverId: world.users.ra1.id,
      },
    });
    expect(res.status(), await res.text()).toBeLessThan(300);
    expect(await msgOf(res)).toBe('บันทึกข้อมูลห้องสำเร็จ');
    expect((await (await clients.ra1.get(`/rooms/${room}`)).json()).approver?.id).toBe(world.users.ra1.id);
    // คืนค่าเดิม (ยังไม่กำหนดผู้อนุมัติ) เพื่อให้รันซ้ำได้
    await clients.ra1.post(`/rooms/${room}/versions`, {
      data: { name: before.name, capacity: before.capacity, photos: before.photos ?? [], facilityIds: before.facilityIds ?? [], requiresApproval: true, approverId: null },
    });
  });
});

// ------------------------------------------------------------------ ยกเลิกแทน · เปลี่ยนผล · เหตุผล
test.describe('Room Administrator ยกเลิกแทน / เปลี่ยนผล (BR-mrr-009 · BR-mrr-011)', () => {
  // TC-APR-UI010-101 (EX-028): RA ยกเลิกแทนได้เฉพาะการจองที่เริ่มแล้ว (409 ก่อนเริ่ม) → ต้องควบคุมเวลา · OQ-T1-01

  test('[real] TC-APR-UI010-102 RA ยกเลิกแทนโดยไม่ใส่เหตุผล → "กรุณาระบุเหตุผล" การจองคงเดิม (EX-mrr-029 · BR-mrr-009 · ตรวจก่อนเริ่มประชุม กรณีเริ่มแล้วรอ OQ-T1-01)', async () => {
    const b = await book(clients.u1, 'open', nearSlot(), title('ยกเลิกแทนไม่มีเหตุผล'));
    const res = await clients.ra1.post(`/bookings/${b.id}/admin-cancel`, { data: { reason: '' } });
    expect(res.status()).toBe(400);
    expect(await msgOf(res)).toBe('กรุณาระบุเหตุผล');
    expect(await statusOf(clients.ra1, b.id)).toBe('CONFIRMED');
  });

  async function approved(room = 'appr') {
    const b = await book(clients.u1, room, nearSlot(), title('อนุมัติแล้ว'));
    expect((await clients.ra1.post(`/bookings/${b.id}/approve`)).status()).toBeLessThan(300);
    return b;
  }

  test('[real] TC-APR-UI010-103 RA เปลี่ยนผลเป็นปฏิเสธพร้อมเหตุผล → ปฏิเสธแล้ว (EX-mrr-035 · BR-mrr-011)', async () => {
    const b = await approved();
    const res = await clients.ra1.post(`/bookings/${b.id}/decision`, { data: { decision: 'REJECTED', reason: 'อนุมัติผิดห้อง' } });
    expect(res.status(), await res.text()).toBeLessThan(300);
    expect(await msgOf(res)).toBe('เปลี่ยนผลการอนุมัติสำเร็จ');
    expect(await statusOf(clients.ra1, b.id)).toBe('REJECTED');
  });

  test('[real] TC-APR-UI010-104 RA เปลี่ยนผลโดยไม่ใส่เหตุผล → "กรุณาระบุเหตุผล" ยังอนุมัติแล้ว (EX-mrr-036 · BR-mrr-011)', async () => {
    const b = await approved();
    const res = await clients.ra1.post(`/bookings/${b.id}/decision`, { data: { decision: 'REJECTED', reason: '' } });
    expect(res.status()).toBe(400);
    expect(await msgOf(res)).toBe('กรุณาระบุเหตุผล');
    expect(await statusOf(clients.ra1, b.id)).toBe('APPROVED');
  });
});

// ------------------------------------------------------------------ ร่องรอย
test.describe('ร่องรอยการกระทำ (BR-mrr-017 · BR-mrr-018)', () => {
  const trailOf = async (who: APIRequestContext, id: string) => {
    const res = await who.get(`/bookings/${id}/audit`);
    return { status: res.status(), body: await res.json() };
  };

  test('[real] TC-AUD-UI010-101 RA อนุมัติ → ร่องรอยมีรายการใหม่ 1 รายการ ผู้ทำ RA1 การกระทำอนุมัติ เหตุผลว่าง (EX-mrr-054 · BR-mrr-017)', async () => {
    const b = await book(clients.u1, 'appr', nearSlot(), title('ร่องรอยอนุมัติ'));
    expect((await clients.ra1.post(`/bookings/${b.id}/approve`)).status()).toBeLessThan(300);
    const { status, body } = await trailOf(clients.ra1, b.id);
    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].actor.id).toBe(world.users.ra1.id);
    expect(body[0].action).toBe('APPROVE');
    expect(body[0].reason).toBeNull();
    expect(Number.isNaN(Date.parse(body[0].at))).toBe(false);
  });

  test('[real] TC-AUD-UI010-102 รายการอนุมัติของ RA แสดงบนหน้า UI-mrr-010 (EX-mrr-054 · BR-mrr-017 · ส่วนหน้าจอ; "ยกเลิกแทน" ของ EX-055 ต้องรอ OQ-T1-01)', async ({ browser }) => {
    const b = await book(clients.u1, 'appr', nearSlot(), title('ร่องรอยบนหน้าจอ'));
    expect((await clients.ra1.post(`/bookings/${b.id}/approve`)).status()).toBeLessThan(300);
    const ctx = await browser.newContext({ storageState: stateOf('ra1'), baseURL: 'http://localhost:4173', locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    await page.goto(`/UI-mrr-010?booking=${b.id}`);
    await expect(page.getByTestId('ui-mrr-010-ent-010-action')).toHaveText('อนุมัติ');
    const fullName = (await (await clients.ra1.get(`/bookings/${b.id}/audit`)).json())[0].actor.fullName;
    await expect(page.getByTestId('ui-mrr-010-ent-010-actor')).toHaveText(fullName);
    await ctx.close();
  });

  test('[real] TC-AUD-UI010-103 ผู้จองยกเลิกของตัวเอง → ไม่มีรายการร่องรอยใหม่ (EX-mrr-056 · BR-mrr-017)', async () => {
    const b = await book(clients.u1, 'open', nearSlot(), title('ผู้จองยกเลิกเอง'));
    expect((await clients.u1.post(`/bookings/${b.id}/cancel`)).status()).toBeLessThan(300);
    expect((await trailOf(clients.ra1, b.id)).body).toHaveLength(0);
  });

  test('[real] TC-AUD-UI010-104 RA ยกเลิกแทนโดยไม่ใส่เหตุผล → ล้มเหลว ไม่มีร่องรอยใหม่ (EX-mrr-057 · BR-mrr-017)', async () => {
    const b = await book(clients.u1, 'open', nearSlot(), title('ยกเลิกแทนล้มเหลว'));
    expect((await clients.ra1.post(`/bookings/${b.id}/admin-cancel`, { data: { reason: '' } })).status()).toBe(400);
    expect((await trailOf(clients.ra1, b.id)).body).toHaveLength(0);
  });

  test.describe.serial('ใครดูร่องรอยได้ (BR-mrr-018)', () => {
    let id: string;
    test.beforeAll(async () => {
      id = (await book(clients.u1, 'appr', nearSlot(), title('ใครดูร่องรอยได้'))).id;
      expect((await clients.ra1.post(`/bookings/${id}/approve`)).status()).toBeLessThan(300);
    });

    test('[real] TC-AUD-UI010-105 RA คนอื่นดูร่องรอยได้ (EX-mrr-058 · ใช้รายการอนุมัติแทนยกเลิกแทน)', async () => {
      const { status, body } = await trailOf(clients.ra2, id);
      expect(status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({ action: 'APPROVE', reason: null });
      expect(body[0].actor.id).toBe(world.users.ra1.id);
    });

    test('[real] TC-AUD-UI010-106 System Administrator ดูร่องรอยได้ (EX-mrr-059 · ใช้รายการอนุมัติแทนยกเลิกแทน)', async () => {
      const { status, body } = await trailOf(clients.sa, id);
      expect(status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0].action).toBe('APPROVE');
    });

    for (const [tc, ex, who] of [['107', '060', 'u1'], ['108', '061', 'u2']] as const) {
      test(`[real] TC-AUD-UI010-${tc} ${who === 'u1' ? 'ผู้จอง' : 'ผู้ใช้ทั่วไปอื่น'}ขอดูร่องรอย (ยิงตรง) → ปฏิเสธ (EX-mrr-${ex} · BR-mrr-018)`, async () => {
        const res = await clients[who].get(`/bookings/${id}/audit`);
        expect(res.status()).toBe(403);
        expect(await msgOf(res)).toBe('เฉพาะผู้ดูแลห้องและผู้ดูแลระบบเท่านั้นที่ดูร่องรอยได้');
      });
    }
  });
});

// ------------------------------------------------------------------ System Administrator
test.describe('System Administrator ไม่มีสิทธิ์ของ Room Administrator', () => {
  test('[real] TC-RMM-UI013-103 SA แก้ความจุห้อง (ยิงตรง) → ปฏิเสธ ความจุเดิม (EX-mrr-018 · BR-mrr-005)', async () => {
    const room = world.rooms.open;
    const before = await (await clients.sa.get(`/rooms/${room}`)).json();
    const res = await clients.sa.post(`/rooms/${room}/versions`, {
      data: { name: before.name, capacity: before.capacity + 4, photos: [], facilityIds: [], requiresApproval: before.requiresApproval, approverId: null },
    });
    expect(res.status()).toBe(403);
    expect(await msgOf(res)).toBe('เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้');
    expect((await (await clients.sa.get(`/rooms/${room}`)).json()).capacity).toBe(before.capacity);
  });

  test('[real] TC-RPT-RPT001-105 SA ขอรายงาน (ยิงตรง) → ปฏิเสธ (EX-mrr-073 · BR-mrr-022)', async () => {
    const res = await clients.sa.get('/reports/utilization?periodType=MONTH&periodStart=2026-10-01');
    expect(res.status()).toBe(403);
    expect(await msgOf(res)).toBe('เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้');
  });

  test('[real] TC-APR-UI010-109 SA เปิดหน้าจัดการการจอง → เห็นข้อมูลและร่องรอย ไม่เห็นปุ่มแก้/ยกเลิกแทน และยิงตรงถูกปฏิเสธ (EX-mrr-088 · BR-mrr-009)', async ({ browser }) => {
    const b = await book(clients.u1, 'open', nearSlot(), title('SA ดูหน้าจัดการ'));
    const ctx = await browser.newContext({ storageState: stateOf('sa'), baseURL: 'http://localhost:4173', locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    await page.goto(`/UI-mrr-010?booking=${b.id}`);
    await expect(page.getByTestId('ui-mrr-010-ent-007-title')).toHaveText(title('SA ดูหน้าจัดการ'));
    await expect(page.getByTestId('ui-mrr-010-edit-on-behalf')).toHaveCount(0);
    await expect(page.getByTestId('ui-mrr-010-cancel-on-behalf')).toHaveCount(0);
    await ctx.close();
    const res = await clients.sa.post(`/bookings/${b.id}/admin-cancel`, { data: { reason: 'ลองยกเลิก' } });
    expect(res.status()).toBe(403);
    expect(await statusOf(clients.ra1, b.id)).toBe('CONFIRMED');
  });

  test('[real] TC-APR-UI010-110 SA เปิดหน้าจัดการการจองที่อนุมัติแล้ว → ไม่เห็นปุ่มเปลี่ยนผล ยิงตรงถูกปฏิเสธ สถานะคงเดิม (EX-mrr-089 · BR-mrr-011)', async ({ browser }) => {
    const b = await book(clients.u1, 'appr', nearSlot(), title('SA ดูหน้าเปลี่ยนผล'));
    expect((await clients.ra1.post(`/bookings/${b.id}/approve`)).status()).toBeLessThan(300);
    const ctx = await browser.newContext({ storageState: stateOf('sa'), baseURL: 'http://localhost:4173', locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    await page.goto(`/UI-mrr-010?booking=${b.id}`);
    await expect(page.getByTestId('ui-mrr-010-ent-007-status')).toHaveText('อนุมัติแล้ว');
    await expect(page.getByTestId('ui-mrr-010-change-decision')).toHaveCount(0);
    await ctx.close();
    const res = await clients.sa.post(`/bookings/${b.id}/decision`, { data: { decision: 'REJECTED', reason: 'ลองเปลี่ยน' } });
    expect(res.status()).toBe(403);
    expect(await statusOf(clients.ra1, b.id)).toBe('APPROVED');
  });
});

// ------------------------------------------------------------------ ปฏิทิน
test.describe.serial('ปฏิทินห้อง (BR-mrr-021)', () => {
  const slot = nearSlot(10);
  const t = title('ปฏิทิน');
  const calendar = async (who: APIRequestContext, room: string) => {
    const res = await who.get(`/rooms/${world.rooms[room]}/calendar?view=day&date=${slot.date}`);
    expect(res.status()).toBe(200);
    return ((await res.json()).slots as { startAt: string; endAt: string; busy: boolean; details?: { bookedBy: string; title: string; attendees: string[] } }[]).filter(
      (s) => s.startAt === new Date(slot.startAt).toISOString(),
    );
  };

  test('[real] TC-CAL-UI005-101 ผู้จองเห็นผู้จอง หัวข้อ ผู้เข้าร่วมในช่อง (EX-mrr-068)', async () => {
    await book(clients.u1, 'open', slot, t, [world.users.u2.id, world.users.u3.id]);
    const s = await calendar(clients.u1, 'open');
    expect(s).toHaveLength(1);
    expect(s[0].details?.title).toBe(t);
    expect(s[0].details?.attendees.sort()).toEqual(['E2E User Three', 'E2E User Two']);
  });

  test('[real] TC-CAL-UI005-102 ผู้เข้าร่วมเห็นรายละเอียดเดียวกัน (EX-mrr-069)', async () => {
    const s = await calendar(clients.u2, 'open');
    expect(s).toHaveLength(1);
    expect(s[0].details?.title).toBe(t);
  });

  test('[real] TC-CAL-UI005-103 คนอื่นเห็นแค่ "ไม่ว่าง" ไม่มีผู้จอง/หัวข้อ/ผู้เข้าร่วม (EX-mrr-070)', async () => {
    const s = await calendar(clients.u4, 'open');
    expect(s).toHaveLength(1);
    expect(s[0].busy).toBe(true);
    expect(s[0].details).toBeUndefined();
    expect(JSON.stringify(s[0])).not.toContain(t);
  });

  test('[real] TC-CAL-UI005-104 ห้องที่ต้องอนุมัติ: การจองรออนุมัติของคนอื่นเห็นแค่ "ไม่ว่าง" ไม่เห็นสถานะ (EX-mrr-071)', async () => {
    const b = await book(clients.u1, 'appr', slot, t, [world.users.u2.id]);
    expect(b.status).toBe('PENDING_APPROVAL');
    const s = await calendar(clients.u4, 'appr');
    expect(s).toHaveLength(1);
    expect(s[0].details).toBeUndefined();
    expect(JSON.stringify(s[0])).not.toMatch(/PENDING|status|รออนุมัติ/);
  });
});

// ------------------------------------------------------------------ ห้องปิดปรับปรุง
test.describe.serial('ห้องปิดปรับปรุง (BR-mrr-012)', () => {
  const room = () => world.rooms.maint;
  const toggle = (status: number) => async () => {
    const res = await clients.ra1.post(`/rooms/${room()}/maintenance`);
    expect(res.status()).toBe(200);
    return res.json();
  };
  const slot = nearSlot();
  let existing: string;

  test.beforeAll(async () => {
    // ให้ห้องเปิดอยู่ก่อนเริ่ม (ถ้ารอบที่แล้วค้าง)
    const info = await (await clients.ra1.get(`/rooms/${room()}`)).json();
    if (info.status === 'UNDER_MAINTENANCE') await clients.ra1.post(`/rooms/${room()}/maintenance`);
    existing = (await book(clients.u1, 'maint', slot, title('จองก่อนปิดปรับปรุง'))).id;
  });
  test.afterAll(async () => {
    const info = await (await clients.ra1.get(`/rooms/${room()}`)).json();
    if (info.status === 'UNDER_MAINTENANCE') await clients.ra1.post(`/rooms/${room()}/maintenance`);
  });

  test('[real] TC-RMM-UI012-101 RA ตั้งห้องเป็นปิดปรับปรุง → การจองที่มีอยู่คงเดิม (EX-mrr-016 · BR-mrr-012)', async () => {
    const body = await toggle(200)();
    expect(body.status).toBe('UNDER_MAINTENANCE');
    expect(body.message).toBe('ตั้งห้องเป็นปิดปรับปรุงแล้ว การจองที่มีอยู่คงเดิม');
    expect(await statusOf(clients.u1, existing)).toBe('CONFIRMED');
  });

  test('[real] TC-BKG-UI006-028 จองห้องปิดปรับปรุงจริง → ไม่สร้างการจอง (EX-mrr-081 · BR-mrr-012)', async () => {
    const s = nearSlot();
    const res = await clients.u2.post('/bookings', {
      data: { roomId: room(), startAt: s.startAt, endAt: s.endAt, title: title('จองห้องปิดซ่อม'), attendeeIds: [world.users.ra1.id], equipmentIds: [] },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(await msgOf(res)).toBe('ห้องนี้ปิดปรับปรุง ไม่สามารถจองได้');
    const mine = await (await clients.u2.get('/me/bookings?page=1')).json();
    expect(mine.items.some((x: { title: string }) => x.title === title('จองห้องปิดซ่อม'))).toBe(false);
  });

  test('[real] TC-BKG-UI008-101 แก้เวลาการจองเดิมในห้องปิดปรับปรุง → ไม่บันทึก เวลาเดิมคงอยู่ (EX-mrr-082 · BR-mrr-012)', async () => {
    const before = await (await clients.u1.get(`/bookings/${existing}`)).json();
    const later = nearSlot();
    const res = await clients.u1.patch(`/bookings/${existing}`, {
      data: { startAt: later.startAt, endAt: later.endAt, title: before.title, attendeeIds: before.attendees.map((a: { id: string }) => a.id) },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(await msgOf(res)).toBe('ห้องนี้ปิดปรับปรุง ไม่สามารถจองได้');
    const after = await (await clients.u1.get(`/bookings/${existing}`)).json();
    expect(after.startAt).toBe(before.startAt);
    expect(after.status).toBe('CONFIRMED');
  });

  test('[real] TC-RMM-UI012-102 RA เปิดห้องกลับมา → จองใหม่ได้ทันที (EX-mrr-083 · BR-mrr-012)', async () => {
    const body = await toggle(200)();
    expect(body.status).toBe('ACTIVE');
    expect(body.message).toBe('เปิดห้องใช้งานแล้ว');
    const b = await book(clients.u2, 'maint', nearSlot(), title('จองหลังเปิดห้อง'));
    expect(b.message).toBe('จองห้องสำเร็จ');
  });
});

// ------------------------------------------------------------------ บัญชีไม่ active
test('[real] TC-AUTH-UI001-109 บัญชี HR ที่ไม่ active ขอรหัส → ข้อความเหมือนปกติ แต่ไม่ส่ง Email (EX-mrr-099 · BR-mrr-026)', async ({ request }) => {
  const MAIL = 'http://localhost:8025/api/v1/messages';
  await fetch(MAIL, { method: 'DELETE' });
  const res = await request.post('http://localhost:4173/auth/otp/request', { data: { email: 'e2e.u5.inactive@mrr.local' } });
  expect(res.status()).toBeLessThan(300);
  expect((await res.json()).message).toBe('หากเป็น Email ในระบบ เราได้ส่งรหัสเข้าสู่ระบบไปแล้ว กรุณาตรวจสอบ Email');
  await new Promise((r) => setTimeout(r, 3000));
  expect(((await (await fetch(MAIL)).json()).messages ?? []).filter((m: { To: { Address: string }[] }) => m.To.some((t) => t.Address.includes('u5.inactive')))).toHaveLength(0);
});
