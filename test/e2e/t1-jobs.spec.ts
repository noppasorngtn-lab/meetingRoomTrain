import { execFileSync } from 'node:child_process';
import { expect, request, test, type APIRequestContext } from '@playwright/test';
import { resetClock, runJobs, setClock } from './support/clock';
import { ensureMailUp, mailDown, mailUp } from './support/mail';
import { as, book, nearSlot, world } from './support/world';

/**
 * เคสงานตามเวลา (เตือน 15 นาที · ยกเลิกอัตโนมัติ) และอีเมลล่มจริง — OQ-T1-02 · OQ-T1-03 · docs/qa/t1-test-cases.md.
 * หลักการ: เลื่อนนาฬิกาของ api (support/clock.ts) แล้วสั่งงานรอบหนึ่ง (`/__test/jobs/run`) เฉพาะการจองที่หัวข้อมี token ของเคสนั้น
 * — ตัวจับเวลาของงานหยุดนิ่งระหว่างที่นาฬิกาถูกเลื่อน. อีเมลล่มจริงคือหยุด container mailpit (support/mail.ts).
 */

const RUN = Date.now().toString(36);
let counter = 0;
/** One token per case: the jobs are told to touch only bookings whose title contains it. */
const token = () => `${RUN}x${++counter}`;
const MAIL = 'http://localhost:8025/api/v1/messages';
const FAILED_MAIL = 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง';

const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-c', sql], { encoding: 'utf8' }).trim();

const clients: Record<string, APIRequestContext> = {};
test.beforeAll(async () => {
  for (const k of ['u1', 'u2', 'ra1']) clients[k] = await as(k);
});
test.afterEach(async () => {
  await resetClock();
  await ensureMailUp();
});
test.afterAll(async () => {
  await Promise.all(Object.values(clients).map((c) => c.dispose()));
  const mine = `select id from bookings where title like 'E2E%${RUN}x%' and id not in (select booking_id from booking_audit_entries) and id not in (select booking_id from booking_adjustment_requests)`;
  for (const t of ['booking_attendees', 'booking_equipment_requests']) psql(`delete from ${t} where booking_id in (${mine})`);
  psql(`delete from bookings where id in (${mine})`);
});

interface Mail { ID: string; Subject: string; To: { Address: string }[] }
const mails = async (): Promise<Mail[]> => ((await (await fetch(MAIL)).json()).messages ?? []) as Mail[];
const mailsFor = async (prefix: string, t: string) => (await mails()).filter((m) => m.Subject.startsWith(prefix) && m.Subject.includes(t));
/** Mail that should have arrived: poll until `count` of them are in mailpit (the api answers just before mailpit lists them). */
async function mailsArrived(prefix: string, t: string, count = 1) {
  let got = await mailsFor(prefix, t);
  for (let i = 0; i < 20 && got.length < count; i++) {
    await new Promise((r) => setTimeout(r, 500));
    got = await mailsFor(prefix, t);
  }
  return got;
}
const REMINDER = '[จองห้องประชุม] ใกล้ถึงเวลาประชุม:';
const AUTO_CANCEL = '[จองห้องประชุม] ยกเลิกอัตโนมัติ:';
const settle = () => new Promise((r) => setTimeout(r, 2500)); // เวลาให้จดหมายถึง mailpit ก่อนยืนยันว่า "ไม่มี"
const addresses = (m: Mail) => m.To.map((t) => t.Address).sort();
const startOf = (slot: { startAt: string }) => new Date(slot.startAt);
const before = (slot: { startAt: string }, minutes: number) => new Date(startOf(slot).getTime() - minutes * 60_000);
const statusOf = async (id: string) => (await (await clients.ra1.get(`/bookings/${id}`)).json()).status as string;
const reminderOf = (id: string) => psql(`select reminder_status from bookings where id = '${id}'`);
const msgOf = async (res: { json(): Promise<{ message: string }> }) => (await res.json()).message;
const everyone = [world.users.u1.email, world.users.u2.email, world.users.ra1.email];

// ------------------------------------------------------------------ เตือน 15 นาทีก่อนเริ่ม (BR-mrr-008 · 023)
test.describe('เตือนก่อนเริ่มประชุม', () => {
  const make = async (name: string, room = 'open') => {
    const t = token();
    const title = `E2E ${name} ${t}`;
    const slot = nearSlot();
    const b = await book(clients.u1, room, slot, title, [world.users.u2.id, world.users.ra1.id]);
    return { t, title, slot, b };
  };

  test('[real] TC-NTF-JOB-101 ถึง 15 นาทีก่อนเริ่ม → ผู้จองและผู้เข้าร่วมทุกคนได้อีเมลเตือน (EX-mrr-020 · BR-mrr-008)', async () => {
    const { t, title, slot } = await make('เตือน');
    await setClock(before(slot, 15));
    await runJobs(t);
    const got = await mailsArrived(REMINDER, t);
    expect(got).toHaveLength(1);
    expect(got[0].Subject.startsWith(`${REMINDER} ${title} · `)).toBe(true);
    expect(addresses(got[0])).toEqual([...everyone].sort());
  });

  test('[real] TC-NTF-JOB-102 ยังเหลือ 16 นาที → ยังไม่มีใครได้อีเมลเตือน (EX-mrr-023 · BR-mrr-008)', async () => {
    const { t, slot, b } = await make('ยังไม่ถึงเวลาเตือน');
    await setClock(before(slot, 16));
    await runJobs(t);
    await settle();
    expect(await mailsFor(REMINDER, t)).toHaveLength(0);
    expect(reminderOf(b.id)).toBe('NOT_SENT');
  });

  test('[real] TC-NTF-JOB-103 การจองที่ยังรออนุมัติ → ไม่ส่งเตือน (EX-mrr-025 · BR-mrr-008)', async () => {
    const { t, slot, b } = await make('รออนุมัติไม่เตือน', 'appr');
    expect(b.status).toBe('PENDING_APPROVAL');
    await setClock(before(slot, 15));
    await runJobs(t);
    await settle();
    expect(await mailsFor(REMINDER, t)).toHaveLength(0);
    expect(reminderOf(b.id)).toBe('NOT_SENT');
  });

  test.describe.serial('ส่งครั้งเดียวต่อการจอง (BR-mrr-023)', () => {
    let ctx: Awaited<ReturnType<typeof make>>;
    test.beforeAll(async () => {
      ctx = await make('เตือนครั้งเดียว');
    });

    test('[real] TC-NTF-JOB-106 รอบแรกส่งคนละ 1 ฉบับ และบันทึกว่าส่งแล้ว (EX-mrr-075)', async () => {
      await setClock(before(ctx.slot, 15));
      await runJobs(ctx.t);
      const got = await mailsArrived(REMINDER, ctx.t);
      expect(got).toHaveLength(1);
      expect(addresses(got[0])).toEqual([...everyone].sort());
      expect(reminderOf(ctx.b.id)).toBe('SENT');
    });

    test('[real] TC-NTF-JOB-107 งานรันซ้ำ → ข้ามการจองที่ส่งแล้ว ไม่มีอีเมลเพิ่ม (EX-mrr-076)', async () => {
      await setClock(before(ctx.slot, 10));
      await runJobs(ctx.t);
      await settle();
      expect(await mailsFor(REMINDER, ctx.t)).toHaveLength(1);
    });
  });

  test('[real] TC-NTF-JOB-108 เตือนที่ส่งทันทีตอนจองนับเป็นครั้งเดียว งานรอบต่อมาไม่ส่งซ้ำ (EX-mrr-077 · BR-mrr-023)', async () => {
    const t = token();
    const slot = nearSlot();
    await setClock(before(slot, 10));
    const b = await book(clients.u1, 'open', slot, `E2E ประชุมด่วน ${t}`, [world.users.u2.id]);
    expect(await mailsArrived(REMINDER, t)).toHaveLength(1); // เตือนทันทีตอนจอง
    expect(reminderOf(b.id)).toBe('SENT');
    await setClock(before(slot, 5));
    await runJobs(t);
    await settle();
    expect(await mailsFor(REMINDER, t)).toHaveLength(1);
  });
});

// ------------------------------------------------------------------ ยกเลิกอัตโนมัติ (BR-mrr-016)
test.describe('ยกเลิกอัตโนมัติเมื่อถึงเวลาเริ่ม', () => {
  const pending = async (name: string) => {
    const t = token();
    const title = `E2E ${name} ${t}`;
    const slot = nearSlot();
    const b = await book(clients.u1, 'appr', slot, title);
    expect(b.status).toBe('PENDING_APPROVAL');
    return { t, title, slot, b };
  };

  test('[real] TC-APR-JOB-101 ก่อนเริ่ม 1 นาที → ยังรออนุมัติ ไม่มีอีเมล (EX-mrr-050 · BR-mrr-016)', async () => {
    const { t, slot, b } = await pending('ก่อนเริ่ม');
    await setClock(before(slot, 1));
    await runJobs(t);
    await settle();
    expect(await statusOf(b.id)).toBe('PENDING_APPROVAL');
    expect(await mailsFor(AUTO_CANCEL, t)).toHaveLength(0);
  });

  test('[real] TC-APR-JOB-102 ถึงเวลาเริ่ม → ยกเลิกอัตโนมัติ ปล่อยช่วงเวลา และผู้จองได้อีเมล (EX-mrr-051 · BR-mrr-016)', async () => {
    const { t, title, slot, b } = await pending('ยกเลิกอัตโนมัติ');
    await setClock(startOf(slot));
    await runJobs(t);
    expect(await statusOf(b.id)).toBe('CANCELLED');
    const got = await mailsArrived(AUTO_CANCEL, t);
    expect(got).toHaveLength(1);
    expect(got[0].Subject.startsWith(`${AUTO_CANCEL} ${title} · `)).toBe(true);
    expect(addresses(got[0])).toEqual([world.users.u1.email]);
    // ช่วงเวลาถูกปล่อย: จองซ้ำช่วงเดิมได้ (หลังคืนนาฬิกา)
    await resetClock();
    const again = await clients.u2.post('/bookings', {
      data: { roomId: world.rooms.appr, startAt: slot.startAt, endAt: slot.endAt, title: `E2E จองช่วงที่ปล่อย ${t}`, attendeeIds: [world.users.ra1.id], equipmentIds: [] },
    });
    expect(again.status(), await again.text()).toBe(201);
  });

  test('[real] TC-APR-UI009-106 RA อนุมัติก่อนงานรอบถัดไป → อนุมัติแล้ว งานไม่ยกเลิก (EX-mrr-053 · BR-mrr-016)', async () => {
    const { t, slot, b } = await pending('อนุมัติก่อนงานรัน');
    await setClock(startOf(slot)); // ถึงเวลาเริ่มแล้ว แต่งานยังไม่รัน
    const approved = await clients.ra1.post(`/bookings/${b.id}/approve`);
    expect(approved.status(), await approved.text()).toBeLessThan(300);
    expect(await msgOf(approved)).toBe('อนุมัติการจองสำเร็จ');
    await runJobs(t);
    await settle();
    expect(await statusOf(b.id)).toBe('APPROVED');
    expect(await mailsFor(AUTO_CANCEL, t)).toHaveLength(0);
  });
});

// ------------------------------------------------------------------ อีเมลล่มจริง (BR-mrr-016 · 019 · 020 · 024)
test.describe('อีเมลล่ม (หยุด mailpit จริง)', () => {
  test('[real] TC-APR-JOB-103 ส่งอีเมลยกเลิกไม่สำเร็จ → ยังไม่ยกเลิก รองานรอบถัดไปทำใหม่ (EX-mrr-052 · BR-mrr-016)', async () => {
    const t = token();
    const slot = nearSlot();
    const b = await book(clients.u1, 'appr', slot, `E2E ยกเลิกเมลล่ม ${t}`);
    await setClock(startOf(slot));
    await mailDown();
    await runJobs(t);
    expect(await statusOf(b.id)).toBe('PENDING_APPROVAL');
    await mailUp();
    await runJobs(t); // รอบถัดไป
    expect(await statusOf(b.id)).toBe('CANCELLED');
    expect(await mailsArrived(AUTO_CANCEL, t)).toHaveLength(1);
  });

  test.describe.serial('งานเตือนส่งไม่สำเร็จ ไม่ส่งซ้ำ (BR-mrr-020)', () => {
    const t = token();
    const slot = nearSlot();
    let id: string;
    test.beforeAll(async () => {
      id = (await book(clients.u1, 'open', slot, `E2E เตือนเมลล่ม ${t}`, [world.users.u2.id])).id;
    });

    test('[real] TC-NTF-JOB-104 ส่งเตือนไม่สำเร็จ → บันทึก "ส่งไม่สำเร็จ" การจองยังใช้ได้ (EX-mrr-066)', async () => {
      await setClock(before(slot, 15));
      await mailDown();
      await runJobs(t);
      expect(reminderOf(id)).toBe('FAILED');
      expect(await statusOf(id)).toBe('CONFIRMED');
    });

    test('[real] TC-NTF-JOB-105 งานรอบถัดไปหลังเมลกลับมา → ไม่ส่งซ้ำ ยังเป็น "ส่งไม่สำเร็จ" (EX-mrr-067)', async () => {
      await setClock(before(slot, 10));
      await runJobs(t);
      await settle();
      expect(await mailsFor(REMINDER, t)).toHaveLength(0);
      expect(reminderOf(id)).toBe('FAILED');
    });
  });

  test('[real] TC-BKG-UI006-027 (real) ส่งอีเมลไม่สำเร็จตอนจอง → ไม่สร้างการจอง ช่วงเวลายังว่าง (EX-mrr-062 · BR-mrr-019)', async () => {
    const slot = nearSlot();
    const t = token();
    await mailDown();
    const res = await clients.u1.post('/bookings', {
      data: { roomId: world.rooms.open, startAt: slot.startAt, endAt: slot.endAt, title: `E2E จองเมลล่ม ${t}`, attendeeIds: [world.users.u2.id], equipmentIds: [] },
    });
    expect(res.status()).toBe(503);
    expect(await msgOf(res)).toBe(FAILED_MAIL);
    await mailUp();
    expect(psql(`select count(*) from bookings where title like '%${t}%'`)).toBe('0');
    const again = await clients.u1.post('/bookings', {
      data: { roomId: world.rooms.open, startAt: slot.startAt, endAt: slot.endAt, title: `E2E จองหลังเมลกลับ ${t}`, attendeeIds: [world.users.u2.id], equipmentIds: [] },
    });
    expect(again.status(), await again.text()).toBe(201); // ช่วงเดิมว่าง
  });

  test('[real] TC-NTF-UI008-103 เปลี่ยนเวลาแต่ส่งอีเมลไม่สำเร็จ → ล้ม เวลาเดิมคงอยู่ (EX-mrr-063 · BR-mrr-019)', async () => {
    const slot = nearSlot(10, 6);
    const t = token();
    const b = await book(clients.u1, 'open', slot, `E2E เปลี่ยนเวลาเมลล่ม ${t}`, [world.users.u2.id]);
    await mailDown();
    const res = await clients.u1.patch(`/bookings/${b.id}`, {
      data: { startAt: slot.startAt.replace('T10:', 'T14:'), endAt: slot.endAt.replace('T11:', 'T15:'), title: `E2E เปลี่ยนเวลาเมลล่ม ${t}`, attendeeIds: [world.users.u2.id] },
    });
    expect(res.status()).toBe(503);
    expect(await msgOf(res)).toBe(FAILED_MAIL);
    await mailUp();
    expect((await (await clients.u1.get(`/bookings/${b.id}`)).json()).startAt).toBe(new Date(slot.startAt).toISOString());
  });

  test('[real] TC-NTF-UI009-101 RA อนุมัติแต่ส่งอีเมลไม่สำเร็จ → ล้ม ยังรออนุมัติ (EX-mrr-064 · BR-mrr-019)', async () => {
    const t = token();
    const b = await book(clients.u1, 'appr', nearSlot(), `E2E อนุมัติเมลล่ม ${t}`);
    await mailDown();
    const res = await clients.ra1.post(`/bookings/${b.id}/approve`);
    expect(res.status()).toBe(503);
    expect(await msgOf(res)).toBe(FAILED_MAIL);
    await mailUp();
    expect(await statusOf(b.id)).toBe('PENDING_APPROVAL');
  });

  test('[real] TC-NTF-UI008-104 แก้เฉพาะหัวข้อตอนอีเมลล่ม → บันทึกได้ ไม่ล้มตาม (EX-mrr-065 · BR-mrr-019)', async () => {
    const t = token();
    const b = await book(clients.u1, 'open', nearSlot(), `E2E หัวข้อเมลล่ม ${t}`, [world.users.u2.id]);
    await mailDown();
    const cur = await (await clients.u1.get(`/bookings/${b.id}`)).json();
    const res = await clients.u1.patch(`/bookings/${b.id}`, {
      data: { startAt: cur.startAt, endAt: cur.endAt, title: `E2E ประชุมวางแผนเมลล่ม ${t}`, attendeeIds: [world.users.u2.id] },
    });
    expect(res.status(), await res.text()).toBeLessThan(300);
    expect(await msgOf(res)).toBe('บันทึกการแก้ไขสำเร็จ');
    await mailUp();
  });

  test.describe('ขอรหัสเข้าสู่ระบบตอนอีเมลล่ม (BR-mrr-024)', () => {
    const EMAIL = 'tester@mrr.local';
    let api: APIRequestContext;
    test.beforeEach(async () => {
      psql("update login_codes set status='EXPIRED' where status='ISSUED'");
      api = await request.newContext({ baseURL: 'http://localhost:4173' });
    });
    test.afterEach(async () => {
      await api.dispose();
      psql("update login_codes set status='EXPIRED' where status='ISSUED'");
    });
    const ask = () => api.post('/auth/otp/request', { data: { email: EMAIL } });
    const issued = () => psql("select count(*) from login_codes lc join users u on u.id=lc.user_id where u.email='tester@mrr.local' and lc.status='ISSUED'");
    const signInMails = async () => (await mails()).filter((m) => m.To.some((a) => a.Address === EMAIL) && m.Subject.includes('รหัสเข้าสู่ระบบ'));

    test('[real] TC-AUTH-UI001-102 ส่งรหัสไม่สำเร็จ → ล้มทันที แจ้งให้ลองใหม่ ไม่เหลือรหัสที่ใช้ได้ (EX-mrr-092 · BR-mrr-024)', async () => {
      await mailDown();
      const res = await ask();
      expect(res.status()).toBe(503);
      expect(await msgOf(res)).toBe('ส่งรหัสไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      expect(issued()).toBe('0');
      await mailUp();
    });

    test('[real] TC-AUTH-UI001-103 ล้มแล้วไม่มีคิวส่งซ้ำ → เมลกลับมาแล้วก็ไม่มีรหัสส่งมาเอง (EX-mrr-093 · BR-mrr-024)', async () => {
      await mailDown();
      expect((await ask()).status()).toBe(503);
      await mailUp();
      await new Promise((r) => setTimeout(r, 6000));
      expect(await signInMails()).toHaveLength(0);
    });

    test('[real] TC-AUTH-UI001-104 ขอใหม่หลังล้ม → ได้รหัส ไม่ถูกกันการขอซ้ำ (EX-mrr-094 · BR-mrr-024)', async () => {
      await mailDown();
      expect((await ask()).status()).toBe(503);
      await mailUp();
      const again = await ask();
      expect(again.status(), await again.text()).toBeLessThan(300);
      expect(await msgOf(again)).toBe('หากเป็น Email ในระบบ เราได้ส่งรหัสเข้าสู่ระบบไปแล้ว กรุณาตรวจสอบ Email');
      expect(await signInMails()).toHaveLength(1);
    });
  });
});
