import { execFileSync } from 'node:child_process';
import { expect, request, test, type APIRequestContext } from '@playwright/test';
import { resetClock, runJobs, setClock } from './support/clock';
import { as, book, nearSlot, world } from './support/world';

/**
 * BR-mrr-007@v3 (CHG-mrr-007 · SRC-043) — ผู้รับที่บัญชีไม่ active ถูกตัดออกจาก Email · ไม่เหลือผู้รับ → ไม่ส่ง การกระทำสำเร็จ.
 * เสริมเคส F5 (t1-adr017-f5.spec.ts) ตามที่ผู้ใช้ตัดสิน 2026-11-25:
 *   - บัญชี "ไม่ active แต่ยังไม่ปิดบัง" (active=false อย่างเดียว email เดิม) — F5 ปิดบังทุกคน จึงแยกไม่ออกว่าตัดเพราะ active หรือเพราะ email เปลี่ยน
 *   - ข้อความที่ผู้ทำรายการเห็น ('ยกเลิกการจองสำเร็จ') และหัวเรื่อง Email
 *   - EX-mrr-133 มีผู้เข้าร่วมสองคน (U2, U3) · EX-mrr-134 (RA ยกเลิกแทน ไม่เหลือผู้รับ)
 * ผู้ใช้สังเคราะห์ e2e.inact.*@mrr.local สร้างด้วย psql · การจองค้างใน DB (ร่องรอยเพิ่มอย่างเดียว) — หัวข้อขึ้นต้น `E2E inactive`.
 */

const MAIL = 'http://localhost:8025/api/v1';
const BASE = 'http://localhost:4173';
const P = '[จองห้องประชุม]';
const RUN = Date.now().toString(36);
let counter = 0;
const token = () => `${RUN}y${++counter}`;
const title = (t: string) => `E2E inactive ประชุมทีม ${t}`;

const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-F', '|', '-c', sql], { encoding: 'utf8' }).trim();
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
/** Thai through `docker exec psql` becomes "????" on Windows: send every character as a \XXXX escape. */
const uni = (s: string) => `U&'${[...s].map((c) => '\\' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}'`;

interface Synthetic { id: string; email: string }
function makeUser(name: string): Synthetic {
  const email = `e2e.inact.${name}@mrr.local`;
  psql(`insert into users (email, full_name, role, active) values (${lit(email)}, ${lit(`E2E Inactive ${name.toUpperCase()}`)}, 'GENERAL_USER', true)`);
  return { id: psql(`select id from users where email = ${lit(email)}`), email };
}
/** Not active — and NOT masked: the email stays what it was, so only the active flag can keep the mail away. */
function deactivate(u: Synthetic) {
  psql(`update users set active = false where id = ${lit(u.id)}`);
  expect(psql(`select active || '|' || email from users where id = ${lit(u.id)}`)).toBe(`false|${u.email}`);
}

/** Back to active (the same account, email untouched) — OQ ข้อ 3 ของ T1 §B15: เมลถัดไปถึงเขาตามปกติ */
function reactivate(u: Synthetic) {
  psql(`update users set active = true where id = ${lit(u.id)}`);
  expect(psql(`select active || '|' || email from users where id = ${lit(u.id)}`)).toBe(`true|${u.email}`);
}
const clearMail = () => fetch(`${MAIL}/messages`, { method: 'DELETE' });

interface Mail { ID: string; Subject: string; To: { Address: string }[] }
const allMails = async (): Promise<Mail[]> => ((await (await fetch(`${MAIL}/messages`)).json()) as { messages?: Mail[] }).messages ?? [];
/** Mails of one case and one event: the booking mail ('จองสำเร็จ') of the same case is left out. */
const mailsFor = async (t: string, event = '') => (await allMails()).filter((m) => m.Subject.includes(t) && m.Subject.startsWith(`${P} ${event}`));
const recipients = (ms: Mail[]) => ms.flatMap((m) => m.To.map((x) => x.Address)).sort();
const settle = () => new Promise((r) => setTimeout(r, 2500));
async function mailsAfter(t: string, event: string, expected: number): Promise<Mail[]> {
  for (let i = 0; i < 20 && (await mailsFor(t, event)).length < expected; i++) await new Promise((r) => setTimeout(r, 500));
  await settle();
  return mailsFor(t, event);
}

async function signInAs(u: Synthetic): Promise<APIRequestContext> {
  psql("update login_codes set status='EXPIRED' where status='ISSUED'");
  const api = await request.newContext({ baseURL: BASE });
  expect((await api.post('/auth/otp/request', { data: { email: u.email } })).status()).toBeLessThan(300);
  let code = '';
  for (let i = 0; i < 30 && !code; i++) {
    const m = (await allMails()).find((x) => x.To.some((a) => a.Address === u.email) && x.Subject.includes('รหัสเข้าสู่ระบบ'));
    if (m) code = /(\d{6})/.exec(((await (await fetch(`${MAIL}/message/${m.ID}`)).json()) as { Text: string }).Text)![1];
    else await new Promise((r) => setTimeout(r, 500));
  }
  expect(code, `no sign-in email for ${u.email}`).not.toBe('');
  const verify = await api.post('/auth/otp/verify', { data: { email: u.email, code } });
  expect(verify.status(), await verify.text()).toBeLessThan(300);
  return api;
}

const msgOf = async (res: { json(): Promise<{ message: string }> }) => (await res.json()).message;
const clients: Record<string, APIRequestContext> = {};
test.beforeAll(async () => {
  for (const k of ['u1', 'ra1']) clients[k] = await as(k);
});
test.afterEach(resetClock);
test.afterAll(async () => {
  await Promise.all(Object.values(clients).map((c) => c.dispose()));
});
const statusOf = async (id: string) => ((await (await clients.ra1.get(`/bookings/${id}`)).json()) as { status: string }).status;
const U = (k: string) => world.users[k].email;

test.describe('BR-mrr-007@v3 ผู้รับที่บัญชีไม่ active (ไม่ปิดบัง)', () => {
  test('[real] TC-MYB-UI007-107 ผู้จองยกเลิก ผู้เข้าร่วมคนหนึ่งไม่ active → "ยกเลิกการจองสำเร็จ" · เมล "ยกเลิกการจอง" ถึงผู้จองและผู้เข้าร่วมที่ active เท่านั้น (EX-mrr-132 · BR-mrr-007@v3)', async () => {
    const t = token();
    const u3 = makeUser(`att.${t}`);
    const b = await book(clients.u1, 'open', nearSlot(), title(t), [world.users.u2.id, u3.id]);
    deactivate(u3);
    const res = await clients.u1.post(`/bookings/${b.id}/cancel`);
    expect(res.status(), await res.text()).toBeLessThan(300);
    expect(await msgOf(res)).toBe('ยกเลิกการจองสำเร็จ');
    expect(await statusOf(b.id)).toBe('CANCELLED');

    const got = await mailsAfter(t, 'ยกเลิกการจอง:', 1);
    expect(got).toHaveLength(1);
    expect(got[0].Subject.startsWith(`${P} ยกเลิกการจอง: ${title(t)} · `)).toBe(true);
    expect(recipients(got), 'ผู้รับ = ผู้จองและผู้เข้าร่วมที่ active · ไม่มี email ของบัญชีที่ไม่ active').toEqual([U('u1'), U('u2')].sort());
  });

  test('[real] TC-NTF-JOB-114 เตือน 15 นาที ผู้จองไม่ active ผู้เข้าร่วม 2 คน → เมล "ใกล้ถึงเวลาประชุม" ถึงผู้เข้าร่วมทั้งสอง ไม่ถึงผู้จอง · บันทึก SENT (EX-mrr-133 · BR-mrr-007@v3)', async () => {
    const t = token();
    const slot = nearSlot();
    const booker = makeUser(`bk.${t}`);
    const api = await signInAs(booker);
    const b = await book(api, 'open', slot, title(t), [world.users.u2.id, world.users.u3.id]);
    await api.dispose();
    deactivate(booker);
    await setClock(new Date(Date.parse(slot.startAt) - 10 * 60_000));
    await runJobs(t);

    const got = await mailsAfter(t, 'ใกล้ถึงเวลาประชุม:', 1);
    expect(got.length).toBeGreaterThan(0);
    for (const m of got) expect(m.Subject.startsWith(`${P} ใกล้ถึงเวลาประชุม: ${title(t)} · `)).toBe(true);
    expect(recipients(got)).toEqual([U('u2'), U('u3')].sort());
    expect(psql(`select reminder_status from bookings where id = ${lit(b.id)}`)).toBe('SENT');
  });

  test('[real] TC-NTF-UI010-107 RA ยกเลิกแทน (ระหว่างประชุม) ผู้จองและผู้เข้าร่วมไม่ active ทั้งคู่ → "ยกเลิกการจองสำเร็จ" · ไม่มีเมล (ไม่เหลือผู้รับ) (EX-mrr-134 · BR-mrr-007@v3)', async () => {
    const t = token();
    const booker = makeUser(`bk2.${t}`);
    const att = makeUser(`att2.${t}`);
    const api = await signInAs(booker);
    const slot = nearSlot();
    const b = await book(api, 'open', slot, title(t), [att.id]);
    await api.dispose();
    deactivate(booker);
    deactivate(att);
    // RA cancels on behalf only once the meeting has started (BR-mrr-009@v1 · EX-mrr-028; before that the api answers 409).
    await setClock(new Date(Date.parse(slot.startAt) + 30 * 60_000));

    const res = await clients.ra1.post(`/bookings/${b.id}/admin-cancel`, { data: { reason: 'ห้องต้องใช้จัดงานด่วน' } });
    expect(res.status(), await res.text()).toBeLessThan(300);
    expect(await msgOf(res)).toBe('ยกเลิกการจองสำเร็จ');
    expect(await statusOf(b.id)).toBe('CANCELLED');
    await settle();
    expect(await mailsFor(t, 'ยกเลิกการจอง:'), 'ไม่เหลือผู้รับ → ไม่มีเมลถึงใคร').toHaveLength(0);
  });
});

/**
 * T1 §B15 (2026-11-25) — ช่องว่างเชิงลึกของ BR-mrr-007@v3 · QA_Noppasorn review 7 เคสแล้ว (ตามที่ผู้ใช้แจ้ง)
 * คำตอบผู้ใช้ OQ ข้อ 1–3: อนุมัติแล้วไม่เหลือผู้รับ = สำเร็จเหมือน EX-mrr-134 · ยกเลิกอัตโนมัติตัดผู้ที่ไม่ active · เปิด active กลับ = ได้เมลตามปกติ
 */
test.describe('BR-mrr-007@v3 T1 §B15 — บัญชีไม่ active (ไม่ปิดบัง) ในเหตุการณ์ที่ยังไม่มี EX', () => {
  test('[real] TC-NTF-UI009-107 RA อนุมัติ ผู้จองไม่ active → "อนุมัติการจองสำเร็จ" · ไม่มีเมลถึงใคร (OQ-1 · BR-mrr-007@v3 ข้อ 1)', async () => {
    const t = token();
    const booker = makeUser(`bk.${t}`);
    const api = await signInAs(booker);
    const b = await book(api, 'appr', nearSlot(), title(t), [world.users.u2.id]);
    await api.dispose();
    expect(b.status).toBe('PENDING_APPROVAL');
    deactivate(booker);
    await clearMail();

    const res = await clients.ra1.post(`/bookings/${b.id}/approve`);
    expect(res.status(), await res.text()).toBe(200);
    expect(await msgOf(res)).toBe('อนุมัติการจองสำเร็จ');
    expect(await statusOf(b.id)).toBe('APPROVED');
    await settle();
    expect((await allMails()).filter((m) => m.Subject.includes(t)), 'ผู้รับเดียวคือผู้จองและถูกตัด · u2 ไม่ได้รับตามเดิม').toHaveLength(0);
  });

  test('[real] TC-NTF-UI009-108 RA ปฏิเสธ ผู้จองไม่ active ผู้เข้าร่วม active → เมล "ปฏิเสธการจอง" ถึงผู้เข้าร่วมเท่านั้น · REJECTED (BR-mrr-007@v3 ข้อ 3)', async () => {
    const t = token();
    const booker = makeUser(`bk.${t}`);
    const api = await signInAs(booker);
    const b = await book(api, 'appr', nearSlot(), title(t), [world.users.u2.id]);
    await api.dispose();
    deactivate(booker);
    await clearMail();

    const res = await clients.ra1.post(`/bookings/${b.id}/reject`, { data: { reason: 'E2E inactive เหตุผล' } });
    expect(res.status(), await res.text()).toBe(200);
    expect(await msgOf(res)).toBe('ปฏิเสธการจองสำเร็จ');
    expect(await statusOf(b.id)).toBe('REJECTED');
    const got = await mailsAfter(t, 'ปฏิเสธการจอง:', 1);
    expect(got).toHaveLength(1);
    expect(got[0].Subject.startsWith(`${P} ปฏิเสธการจอง: ${title(t)} · `)).toBe(true);
    expect(recipients(got), 'ไม่มี email ผู้จองที่ไม่ active').toEqual([U('u2')]);
    // ร่องรอย 1 รายการพร้อมเหตุผล — ตรวจผ่านฐานข้อมูล (ไม่ได้ตรวจหน้าจอ)
    expect(psql(`select count(*) from booking_audit_entries where booking_id = ${lit(b.id)} and action = 'REJECT' and reason = ${uni('E2E inactive เหตุผล')}`)).toBe('1');
  });

  test('[real] TC-NTF-UI008-106 ผู้จองเปลี่ยนเวลา ผู้เข้าร่วมคนหนึ่งไม่ active → เมล "เปลี่ยนเวลา" ถึงผู้จองและผู้เข้าร่วมที่ active เท่านั้น (BR-mrr-007@v3 ข้อ 3 · EX-mrr-021)', async () => {
    const t = token();
    const slot = nearSlot(10, 6);
    const att = makeUser(`att.${t}`);
    const b = await book(clients.u1, 'open', slot, title(t), [world.users.u2.id, att.id]);
    deactivate(att);
    const res = await clients.u1.patch(`/bookings/${b.id}`, {
      data: { startAt: slot.startAt.replace('T10:', 'T14:'), endAt: slot.endAt.replace('T11:', 'T15:'), title: title(t) },
    });
    // ไม่ส่ง attendeeIds (ผู้เข้าร่วมเดิมคงอยู่): ถ้าส่งรายชื่อที่มีบัญชีไม่ active กลับมา api ตอบ 400 'ไม่พบผู้เข้าร่วมบางคนในรายชื่อผู้ใช้' — ข้อสังเกตใน t1-test-cases.md §B15.1
    expect(res.status(), await res.text()).toBeLessThan(300);

    const got = await mailsAfter(t, 'เปลี่ยนเวลา:', 1);
    expect(got).toHaveLength(1);
    expect(got[0].Subject.startsWith(`${P} เปลี่ยนเวลา: ${title(t)} · `)).toBe(true);
    expect(recipients(got)).toEqual([U('u1'), U('u2')].sort());
  });

  test('[real] TC-NTF-JOB-115 เตือน 15 นาที ผู้จอง active ผู้เข้าร่วมไม่ active ทั้งหมด → เมลถึงผู้จองคนเดียว · SENT (BR-mrr-007@v3 ข้อ 2)', async () => {
    const t = token();
    const slot = nearSlot();
    const booker = makeUser(`bk2.${t}`);
    const att = makeUser(`att.${t}`);
    const api = await signInAs(booker);
    const b = await book(api, 'open', slot, title(t), [att.id]);
    await api.dispose();
    deactivate(att);
    await setClock(new Date(Date.parse(slot.startAt) - 10 * 60_000));
    await runJobs(t);

    const got = await mailsAfter(t, 'ใกล้ถึงเวลาประชุม:', 1);
    expect(got.length).toBeGreaterThan(0);
    for (const m of got) expect(m.Subject.startsWith(`${P} ใกล้ถึงเวลาประชุม: ${title(t)} · `)).toBe(true);
    expect(recipients(got)).toEqual([booker.email]);
    expect(psql(`select reminder_status from bookings where id = ${lit(b.id)}`)).toBe('SENT');
  });

  test('[real] TC-NTF-JOB-116 เตือน 15 นาที ผู้จองและผู้เข้าร่วมไม่ active ทั้งคู่ → ไม่มีเมล · SENT · รันซ้ำไม่เตือนซ้ำ (EX-mrr-135 ฝั่ง inactive ไม่ปิดบัง)', async () => {
    const t = token();
    const slot = nearSlot();
    const booker = makeUser(`bk3.${t}`);
    const att = makeUser(`att3.${t}`);
    const api = await signInAs(booker);
    const b = await book(api, 'open', slot, title(t), [att.id]);
    await api.dispose();
    deactivate(booker);
    deactivate(att);
    await setClock(new Date(Date.parse(slot.startAt) - 10 * 60_000));
    await runJobs(t);

    await settle();
    expect(await mailsFor(t, 'ใกล้ถึงเวลาประชุม:'), 'ไม่เหลือผู้รับ → ไม่มีเมล').toHaveLength(0);
    expect(psql(`select reminder_status from bookings where id = ${lit(b.id)}`)).toBe('SENT');
    await runJobs(t);
    await settle();
    expect(await mailsFor(t, 'ใกล้ถึงเวลาประชุม:'), 'รอบที่ 2 ไม่เตือนซ้ำ').toHaveLength(0);
    expect(psql(`select reminder_status from bookings where id = ${lit(b.id)}`)).toBe('SENT');
  });

  test('[real] TC-NTF-JOB-117 ยกเลิกอัตโนมัติของการจองรออนุมัติ ผู้จองไม่ active → CANCELLED · ไม่มีเมล · รันซ้ำไม่เปลี่ยน (OQ-2 · BR-mrr-016@v1)', async () => {
    const t = token();
    const slot = nearSlot();
    const booker = makeUser(`bk4.${t}`);
    const api = await signInAs(booker);
    const b = await book(api, 'appr', slot, title(t), [world.users.u2.id]);
    await api.dispose();
    expect(b.status).toBe('PENDING_APPROVAL');
    deactivate(booker);
    await clearMail();
    await setClock(new Date(Date.parse(slot.startAt) + 60_000));
    await runJobs(t);

    await settle();
    expect((await allMails()).filter((m) => m.Subject.includes(t)), 'ไม่เหลือผู้รับ → ไม่มีเมลถึงใคร').toHaveLength(0);
    expect(await statusOf(b.id)).toBe('CANCELLED');
    await runJobs(t);
    await settle();
    expect(await statusOf(b.id)).toBe('CANCELLED');
    expect((await allMails()).filter((m) => m.Subject.includes(t))).toHaveLength(0);
  });

  test('[real] TC-MYB-UI007-108 ผู้เข้าร่วมที่เคยไม่ active ถูกเปิดกลับ แล้วผู้จองยกเลิก → ได้เมล "ยกเลิกการจอง" ตามปกติ (OQ-3 · BR-mrr-007@v3)', async () => {
    const t = token();
    const back = makeUser(`back.${t}`);
    const b = await book(clients.u1, 'open', nearSlot(), title(t), [world.users.u2.id, back.id]);
    deactivate(back);
    reactivate(back);
    const res = await clients.u1.post(`/bookings/${b.id}/cancel`);
    expect(res.status(), await res.text()).toBeLessThan(300);
    expect(await msgOf(res)).toBe('ยกเลิกการจองสำเร็จ');
    expect(await statusOf(b.id)).toBe('CANCELLED');

    const got = await mailsAfter(t, 'ยกเลิกการจอง:', 1);
    expect(got).toHaveLength(1);
    expect(got[0].Subject.startsWith(`${P} ยกเลิกการจอง: ${title(t)} · `)).toBe(true);
    expect(recipients(got)).toEqual([U('u1'), U('u2'), back.email].sort());
  });
});
