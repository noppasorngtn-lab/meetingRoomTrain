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
/** The attendee ids saved on a booking, sorted — what BR-mrr-002@v2 says an edit keeps or refuses to add. */
const attendeesOf = (id: string) => psql(`select user_id from booking_attendees where booking_id = ${lit(id)} order by user_id`).split(/\r?\n/).filter(Boolean).sort();
const NOT_FOUND = 'ไม่พบผู้เข้าร่วมบางคนในรายชื่อผู้ใช้';

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

/**
 * DEF-07 (t4-def-07-2026-11-25.md) — ผู้จองต้องแก้การจองได้ แม้รายชื่อผู้เข้าร่วมมีผู้ที่บัญชีไม่ active (คำตอบผู้ใช้ 2026-11-25: "แก้ได้").
 * ฟอร์มแก้ไขส่ง `attendeeIds` เดิมกลับมาทุกครั้ง (EditBookingPage.tsx) — เคสนี้ทำเหมือนกัน.
 * ก่อนแก้ api ตอบ 400 จึงเคยใส่ `test.fail()` ไว้ · แก้แล้ว (BR-mrr-002@v2 · ตรวจ active เฉพาะผู้ที่เพิ่มใหม่) จึงเอา `test.fail()` ออก 2026-11-26.
 * ผู้จองในเคสคือ u1 · ตรวจที่ระดับ API ไม่ใช่หน้าจอ.
 */
test.describe('DEF-07 แก้การจองเมื่อมีผู้เข้าร่วมที่ไม่ active ในรายชื่อ', () => {
  test('[real] TC-MYB-UI008-102 ผู้จองแก้หัวข้อ ส่งรายชื่อผู้เข้าร่วมเดิม (มีผู้ไม่ active) → บันทึกสำเร็จ (DEF-07 · คำตอบผู้ใช้ 2026-11-25)', async () => {
    const t = token();
    const att = makeUser(`att.${t}`);
    const list = [world.users.u2.id, att.id];
    const b = await book(clients.u1, 'open', nearSlot(), title(t), list);
    deactivate(att);
    const res = await clients.u1.patch(`/bookings/${b.id}`, { data: { title: `${title(t)} แก้แล้ว`, attendeeIds: list } });
    expect(res.status(), await res.text()).toBe(200);
    expect(await msgOf(res)).toBe('บันทึกการแก้ไขสำเร็จ');
    expect(psql(`select title from bookings where id = ${lit(b.id)}`)).toBe(`${title(t)} แก้แล้ว`);
    // BR-mrr-002@v2: the inactive attendee is KEPT on the list, not dropped by the save.
    expect(attendeesOf(b.id)).toEqual([...list].sort());
  });

  test('[real] TC-NTF-UI008-108 ผู้จองเปลี่ยนเวลา ส่งรายชื่อผู้เข้าร่วมเดิม (มีผู้ไม่ active) → บันทึกสำเร็จ เมล "เปลี่ยนเวลา" ถึงผู้จองและผู้เข้าร่วมที่ active เท่านั้น (DEF-07 · BR-mrr-007@v3)', async () => {
    const t = token();
    const slot = nearSlot(10, 6);
    const att = makeUser(`att.${t}`);
    const list = [world.users.u2.id, att.id];
    const b = await book(clients.u1, 'open', slot, title(t), list);
    deactivate(att);
    const res = await clients.u1.patch(`/bookings/${b.id}`, {
      data: { startAt: slot.startAt.replace('T10:', 'T14:'), endAt: slot.endAt.replace('T11:', 'T15:'), title: title(t), attendeeIds: list },
    });
    expect(res.status(), await res.text()).toBeLessThan(300);
    const got = await mailsAfter(t, 'เปลี่ยนเวลา:', 1);
    expect(got).toHaveLength(1);
    expect(recipients(got)).toEqual([U('u1'), U('u2')].sort());
  });

  test('[real] TC-MYB-UI008-103 ผู้จองเพิ่มผู้ใช้ที่ไม่ active ซึ่งไม่อยู่ในรายชื่อเดิม → ไม่บันทึก "ไม่พบผู้เข้าร่วมบางคนในรายชื่อผู้ใช้" · รายชื่อคงเดิม (EX-mrr-137 · BR-mrr-002@v2)', async () => {
    const t = token();
    const u3 = makeUser(`att.${t}`);
    const u4 = makeUser(`add.${t}`);
    const list = [world.users.u2.id, u3.id];
    const b = await book(clients.u1, 'open', nearSlot(), title(t), list);
    deactivate(u3);
    deactivate(u4);

    const res = await clients.u1.patch(`/bookings/${b.id}`, { data: { title: title(t), attendeeIds: [...list, u4.id] } });
    expect(res.status(), await res.text()).toBe(400);
    expect(await res.text()).toContain(NOT_FOUND);
    expect(attendeesOf(b.id)).toEqual([...list].sort());
  });

  test('[real] TC-APR-UI010-111 ระหว่างประชุม RA แก้แทน เลื่อนเวลาสิ้นสุด 30 นาทีพร้อมเหตุผล รายชื่อเดิมมีผู้ไม่ active → "บันทึกการแก้ไขสำเร็จ" · รายชื่อคงเดิม (EX-mrr-138 · BR-mrr-002@v2)', async () => {
    const t = token();
    const slot = nearSlot();
    const u3 = makeUser(`att.${t}`);
    const list = [world.users.u2.id, u3.id];
    const b = await book(clients.u1, 'open', slot, title(t), list);
    deactivate(u3);
    await setClock(new Date(Date.parse(slot.startAt) + 30 * 60_000));

    const newEnd = new Date(Date.parse(slot.endAt) + 30 * 60_000).toISOString();
    const res = await clients.ra1.post(`/bookings/${b.id}/admin-edit`, { data: { endAt: newEnd, attendeeIds: list, reason: 'ประชุมต่อเวลา' } });
    expect(res.status(), await res.text()).toBe(200);
    expect(await msgOf(res)).toBe('บันทึกการแก้ไขสำเร็จ');
    expect(Number(psql(`select (extract(epoch from end_at) * 1000)::bigint from bookings where id = ${lit(b.id)}`))).toBe(Date.parse(newEnd));
    expect(attendeesOf(b.id)).toEqual([...list].sort());
  });

  test('[real] TC-MYB-UI008-104 ผู้จองเอาผู้ไม่ active ออกและบันทึกแล้ว เพิ่มกลับ → ไม่บันทึก "ไม่พบผู้เข้าร่วมบางคนในรายชื่อผู้ใช้" · เหลือ u2 (EX-mrr-139 · BR-mrr-002@v2)', async () => {
    const t = token();
    const u3 = makeUser(`att.${t}`);
    const b = await book(clients.u1, 'open', nearSlot(), title(t), [world.users.u2.id, u3.id]);
    deactivate(u3);
    const off = await clients.u1.patch(`/bookings/${b.id}`, { data: { title: title(t), attendeeIds: [world.users.u2.id] } });
    expect(off.status(), await off.text()).toBe(200);

    const res = await clients.u1.patch(`/bookings/${b.id}`, { data: { title: title(t), attendeeIds: [world.users.u2.id, u3.id] } });
    expect(res.status(), await res.text()).toBe(400);
    expect(await res.text()).toContain(NOT_FOUND);
    expect(attendeesOf(b.id)).toEqual([world.users.u2.id]);
  });
});

/**
 * DEF-08 · EX-mrr-140 (AC-mrr-143) — approving an adjustment request applies the asked-for list, so a
 * user the request ADDS must still be active at approval; otherwise nothing changes and it keeps waiting.
 */
test.describe('DEF-08 อนุมัติคำขอแก้ไขที่เพิ่มผู้ใช้ซึ่งไม่ active แล้ว', () => {
  test('[real] TC-APR-UI011-104 RA1 ขอเพิ่ม U3 หลังจบประชุม U3 ถูกตั้งไม่ active แล้ว RA2 อนุมัติ → ไม่อนุมัติ "ไม่พบผู้เข้าร่วมบางคนในรายชื่อผู้ใช้" · ผู้เข้าร่วมคงเดิม · คำขอยังรอ (EX-mrr-140 · BR-mrr-002@v2)', async () => {
    const ra2 = await as('ra2');
    try {
      const t = token();
      const slot = nearSlot();
      const u3 = makeUser(`adj.${t}`);
      const b = await book(clients.u1, 'open', slot, title(t), [world.users.u2.id]);
      await setClock(new Date(Date.parse(slot.endAt) + 60_000));

      const asked = await clients.ra1.post(`/bookings/${b.id}/admin-edit`, { data: { attendeeIds: [world.users.u2.id, u3.id], reason: 'เพิ่มผู้เข้าร่วมที่มาจริง' } });
      expect(asked.status(), await asked.text()).toBe(200);
      const reqId = psql(`select id from booking_adjustment_requests where booking_id = ${lit(b.id)} and status = 'PENDING'`);
      expect(reqId).not.toBe('');
      deactivate(u3);

      const res = await ra2.post(`/adjustment-requests/${reqId}/approve`);
      expect(res.status(), await res.text()).toBe(400);
      expect(await res.text()).toContain(NOT_FOUND);
      expect(attendeesOf(b.id)).toEqual([world.users.u2.id]);
      expect(psql(`select status from booking_adjustment_requests where id = ${lit(reqId)}`)).toBe('PENDING');
      // Clean up: a request left PENDING pushes other cases' requests off page 1 of API-017 (20 a page).
      expect((await ra2.post(`/adjustment-requests/${reqId}/reject`)).status()).toBe(200);
    } finally {
      await ra2.dispose();
    }
  });
});

/**
 * Q-6 (pending-by-owner) — the DEF-07 fix seen through the real edit form (UI-mrr-008), not only the API.
 * The form loads the saved attendees, including one whose account went inactive, and sends them back.
 */
test.describe('Q-6 หน้าจอแก้ไขการจอง เมื่อมีผู้เข้าร่วมที่ไม่ active', () => {
  test.use({ storageState: '.auth/tester.json' });

  test('[real] TC-MYB-UI008-105 ผู้จองเปิดหน้าแก้ไข ผู้เข้าร่วมที่ไม่ active แสดงในรายชื่อ แก้หัวข้อแล้วกดบันทึก → "บันทึกการแก้ไขสำเร็จ" · ผู้เข้าร่วมคงเดิม (EX-mrr-136 · BR-mrr-002@v2 · DEF-07)', async ({ page }) => {
    const t = token();
    const u3 = makeUser(`ui.${t}`);
    const list = [world.users.u2.id, u3.id];
    const b = await book(clients.u1, 'open', nearSlot(), title(t), list);
    deactivate(u3);

    await page.goto(`/UI-mrr-008?booking=${b.id}`);
    const picked = page.getByRole('list', { name: 'ผู้เข้าร่วมที่เลือก' });
    await expect(picked).toContainText(`E2E Inactive ${`ui.${t}`.toUpperCase()}`);
    await page.getByTestId('ui-mrr-008-ent-007-title').fill(`${title(t)} แก้ผ่านหน้าจอ`);
    const saved = page.waitForResponse((r) => r.url().endsWith(`/bookings/${b.id}`) && r.request().method() === 'PATCH');
    await page.getByTestId('ui-mrr-008-save').click();
    expect((await saved).status()).toBe(200);
    await expect(page).toHaveURL(/\/UI-mrr-007/);
    await expect(page.getByText('บันทึกการแก้ไขสำเร็จ', { exact: true })).toBeVisible();
    expect(psql(`select title from bookings where id = ${lit(b.id)}`)).toBe(`${title(t)} แก้ผ่านหน้าจอ`);
    expect(attendeesOf(b.id)).toEqual([...list].sort());
  });
});

/**
 * R-5 · D-5 (the user decided 2026-11-26) · EX-mrr-145 (AC-mrr-148 · ADR-021) — approving an adjustment request
 * after the meeting sends no email, even when the request moves the time. BR-mrr-007@v3 (3) reads
 * "a time change mails the booker and every attendee"; EX-mrr-145 says this path is not one of them.
 * All accounts here are active, so an absent mail can only be the decision, never the inactive-recipient cut.
 */
test.describe('BR-mrr-007@v3 อนุมัติคำขอแก้ไขหลังจบประชุมไม่ส่ง Email', () => {
  test('[real] TC-APR-UI011-105 RA1 ขอเลื่อนเวลาสิ้นสุด 30 นาทีหลังจบประชุม RA2 อนุมัติ → เวลาเปลี่ยน "อนุมัติคำขอแก้ไขสำเร็จ" · ไม่มี Email ถึงผู้จองหรือผู้เข้าร่วม (EX-mrr-145 · AC-mrr-148 · BR-mrr-007@v3)', async () => {
    const ra2 = await as('ra2');
    try {
      const t = token();
      const slot = nearSlot();
      const b = await book(clients.u1, 'open', slot, title(t), [world.users.u2.id]);
      await setClock(new Date(Date.parse(slot.endAt) + 60_000));

      const newEnd = new Date(Date.parse(slot.endAt) + 30 * 60_000).toISOString();
      const asked = await clients.ra1.post(`/bookings/${b.id}/admin-edit`, { data: { endAt: newEnd, attendeeIds: [world.users.u2.id], reason: 'ประชุมเกินเวลาจริง' } });
      expect(asked.status(), await asked.text()).toBe(200);
      const reqId = psql(`select id from booking_adjustment_requests where booking_id = ${lit(b.id)} and status = 'PENDING'`);
      expect(reqId, 'ต้องมีคำขอแก้ไขที่รออนุมัติ — แก้หลังจบประชุมต้องเป็นคำขอ (BR-mrr-014)').not.toBe('');
      expect(Number(psql(`select (extract(epoch from end_at) * 1000)::bigint from bookings where id = ${lit(b.id)}`)), 'ก่อนอนุมัติ เวลาเดิมคงไว้').toBe(Date.parse(slot.endAt));

      await clearMail();
      const res = await ra2.post(`/adjustment-requests/${reqId}/approve`);
      expect(res.status(), await res.text()).toBe(200);
      expect(await msgOf(res)).toBe('อนุมัติคำขอแก้ไขสำเร็จ');
      expect(Number(psql(`select (extract(epoch from end_at) * 1000)::bigint from bookings where id = ${lit(b.id)}`))).toBe(Date.parse(newEnd));

      await settle();
      const toPeople = (await allMails()).filter((m) => m.To.some((a) => a.Address === U('u1') || a.Address === U('u2')));
      expect(toPeople.map((m) => m.Subject), 'ไม่มี Email ถึงผู้จองหรือผู้เข้าร่วม (EX-mrr-145)').toEqual([]);
    } finally {
      await ra2.dispose();
    }
  });
});
