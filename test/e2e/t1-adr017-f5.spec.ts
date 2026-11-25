import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, request, test, type APIRequestContext } from '@playwright/test';
import { resetClock, runJobs, setClock } from './support/clock';
import { as, book, nearSlot, world } from './support/world';

/**
 * T5 F5 — ผู้จองที่ถูกปิดบัง (ADR-017 · DQ-mrr-017) ถูกตัดออกจากอีเมลทุกเส้น · fix 35bc4e0
 * ผู้ใช้ตอบแล้ว 2026-11-25: ผู้จองที่ปิดบังถูกตัดออกเหมือนผู้เข้าร่วม · ถ้าไม่เหลือผู้รับ → ข้ามเมล การกระทำสำเร็จต่อ.
 * (SMTP ปฏิเสธยังล้มทั้งก้อน — BR-mrr-019 — จำลองใน E2E ไม่ได้ เพราะ mailpit รับทุก address; ครอบด้วย unit test)
 * แต่ละเคส: สร้างผู้ใช้สังเคราะห์ใหม่ (e2e.f5.*@mrr.local) เป็นผู้จอง → จองผ่าน api ในนามเขา → ปิดบังด้วย psql
 * (active=false · email=masked-<uuid>@mrr.invalid แทนขั้นตอนนอกระบบ) → ทำการกระทำ → ตรวจผู้รับที่ mailpit.
 * การจองค้างใน DB (ร่องรอยเป็นแบบเพิ่มอย่างเดียว) — หัวข้อขึ้นต้น `E2E ADR017 F5`.
 */

const MAIL = 'http://localhost:8025/api/v1';
const BASE = 'http://localhost:4173';
const RUN = Date.now().toString(36);
let counter = 0;
/** One token per case: the jobs are told to touch only bookings whose title contains it. */
const token = () => `${RUN}x${++counter}`;
const title = (kind: string, t: string) => `E2E ADR017 F5 ${kind} ${t}`;

const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-F', '|', '-c', sql], { encoding: 'utf8' }).trim();
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
/** Thai through `docker exec psql` becomes "????" on Windows: send every character as a \XXXX escape. */
const uni = (s: string) => `U&'${[...s].map((c) => '\\' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}'`;
const MASKED_NAME = 'ผู้ใช้ที่ถูกปิดบังชื่อ';

interface Synthetic { id: string; email: string }

function makeBooker(name: string): Synthetic {
  const email = `e2e.f5.${name}@mrr.local`;
  psql(`insert into users (email, full_name, role, active) values (${lit(email)}, ${lit(`E2E F5 ${name.toUpperCase()}`)}, 'GENERAL_USER', true)`);
  return { id: psql(`select id from users where email = ${lit(email)}`), email };
}

function mask(u: Synthetic): string {
  const masked = `masked-${randomUUID()}@mrr.invalid`;
  psql(`update users set active = false, full_name = ${uni(MASKED_NAME)}, email = ${lit(masked)} where id = ${lit(u.id)}`);
  expect(psql(`select active || '|' || email from users where id = ${lit(u.id)}`)).toBe(`false|${masked}`);
  return masked;
}

interface Mail { ID: string; Subject: string; To: { Address: string }[] }
const allMails = async (): Promise<Mail[]> => ((await (await fetch(`${MAIL}/messages`)).json()) as { messages?: Mail[] }).messages ?? [];
const mailsFor = async (t: string) => (await allMails()).filter((m) => m.Subject.includes(t));
const clearMail = () => fetch(`${MAIL}/messages`, { method: 'DELETE' });
const recipients = (ms: Mail[]) => ms.flatMap((m) => m.To.map((x) => x.Address)).sort();
const settle = () => new Promise((r) => setTimeout(r, 2500)); // เวลาให้จดหมายถึง mailpit ก่อนยืนยันว่า "ไม่มี"

/** Waits for the one mail that must arrive (it proves the api mailed), then a little longer so a stray one would show. */
async function mailsAfter(t: string, expected: number): Promise<Mail[]> {
  for (let i = 0; i < 20 && (await mailsFor(t)).length < expected; i++) await new Promise((r) => setTimeout(r, 500));
  await settle();
  return mailsFor(t);
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

/**
 * A booking made by a new synthetic booker, who is then masked. `u2` is the attendee — or, with `maskedAttendee`,
 * a second new synthetic user who is masked too (a booking needs one attendee at least, so this is how nobody is left to mail).
 */
async function bookedByMasked(room: 'open' | 'appr', slot: ReturnType<typeof nearSlot>, name: string, t: string, maskedAttendee = false) {
  const booker = makeBooker(`${name}.${t}`);
  const attendee = maskedAttendee ? makeBooker(`${name}.att.${t}`) : undefined;
  const api = await signInAs(booker);
  const b = await book(api, room, slot, title(name, t), [attendee?.id ?? world.users.u2.id]);
  await api.dispose();
  if (attendee) mask(attendee);
  return { id: b.id, status: b.status, masked: mask(booker), original: booker.email };
}

const clients: Record<string, APIRequestContext> = {};
test.beforeAll(async () => {
  for (const k of ['u2', 'ra1']) clients[k] = await as(k);
});
test.afterEach(resetClock);
test.afterAll(async () => {
  await Promise.all(Object.values(clients).map((c) => c.dispose()));
});

const statusOf = async (id: string) => ((await (await clients.ra1.get(`/bookings/${id}`)).json()) as { status: string }).status;
const U2 = world.users.u2.email;

test.describe('F5 ผู้จองที่ถูกปิดบังถูกตัดออกจากเมล (ADR-017 · fix 35bc4e0)', () => {
  test('[real] TC-NTF-UI009-105 RA ปฏิเสธการจองของผู้จองที่ถูกปิดบัง → ปฏิเสธสำเร็จ เมลถึงผู้เข้าร่วมเท่านั้น ไม่ถึง address ที่ปิดบัง/เดิม', async () => {
    const t = token();
    const b = await bookedByMasked('appr', nearSlot(), 'rej', t);
    expect(b.status).toBe('PENDING_APPROVAL');
    await clearMail();

    const res = await clients.ra1.post(`/bookings/${b.id}/reject`, { data: { reason: 'ห้องไม่เหมาะกับการประชุมนี้' } });
    expect(res.status(), await res.text()).toBe(200);

    const mails = await mailsAfter(t, 1);
    expect(recipients(mails), 'ผู้รับต้องเหลือเฉพาะผู้เข้าร่วม').toEqual([U2]);
    expect(await statusOf(b.id)).toBe('REJECTED');
  });

  test('[real] TC-NTF-UI009-106 RA อนุมัติการจองของผู้จองที่ถูกปิดบัง → อนุมัติสำเร็จ ไม่มีเมลเลย (ไม่เหลือผู้รับ → ข้าม)', async () => {
    const t = token();
    const b = await bookedByMasked('appr', nearSlot(), 'apv', t);
    await clearMail();

    const res = await clients.ra1.post(`/bookings/${b.id}/approve`);
    expect(res.status(), await res.text()).toBe(200);

    await settle();
    expect(await mailsFor(t), 'ห้ามมีเมลถึงใคร').toHaveLength(0);
    expect(await statusOf(b.id)).toBe('APPROVED');
  });

  test('[real] TC-NTF-UI010-104 RA เปลี่ยนการตัดสินเป็นปฏิเสธ ผู้จองถูกปิดบัง → สำเร็จ เมลถึงผู้เข้าร่วมเท่านั้น', async () => {
    const t = token();
    const b = await bookedByMasked('appr', nearSlot(), 'dec', t);
    expect((await clients.ra1.post(`/bookings/${b.id}/approve`)).status()).toBe(200);
    await clearMail();

    const res = await clients.ra1.post(`/bookings/${b.id}/decision`, { data: { decision: 'REJECTED', reason: 'อนุมัติผิดห้อง' } });
    expect(res.status(), await res.text()).toBe(200);

    const mails = await mailsAfter(t, 1);
    expect(recipients(mails)).toEqual([U2]);
    expect(await statusOf(b.id)).toBe('REJECTED');
  });

  test('[real] TC-NTF-UI010-105 RA แก้เวลาแทนผู้จองที่ถูกปิดบัง (ระหว่างประชุม) → บันทึกสำเร็จ เมลถึงผู้เข้าร่วมเท่านั้น', async () => {
    const t = token();
    const slot = nearSlot(undefined, 2);
    const b = await bookedByMasked('open', slot, 'edt', t);
    await clearMail();
    await setClock(new Date(Date.parse(slot.startAt) + 10 * 60_000));

    const newEnd = new Date(Date.parse(slot.endAt) + 30 * 60_000).toISOString();
    const res = await clients.ra1.post(`/bookings/${b.id}/admin-edit`, { data: { endAt: newEnd, reason: 'ประชุมยังไม่เสร็จ' } });
    expect(res.status(), await res.text()).toBe(200);

    const mails = await mailsAfter(t, 1);
    expect(recipients(mails)).toEqual([U2]);
    // The edit really saved: the end time in the database is the new one.
    expect(Number(psql(`select (extract(epoch from end_at) * 1000)::bigint from bookings where id = ${lit(b.id)}`))).toBe(Date.parse(newEnd));
  });

  test('[real] TC-NTF-UI010-106 RA ยกเลิกแทนผู้จองที่ถูกปิดบัง (ระหว่างประชุม) → ยกเลิกสำเร็จ เมลถึงผู้เข้าร่วมเท่านั้น', async () => {
    const t = token();
    const slot = nearSlot();
    const b = await bookedByMasked('open', slot, 'can', t);
    await clearMail();
    await setClock(new Date(Date.parse(slot.startAt) + 10 * 60_000));

    const res = await clients.ra1.post(`/bookings/${b.id}/admin-cancel`, { data: { reason: 'ห้องต้องใช้จัดงานด่วน' } });
    expect(res.status(), await res.text()).toBe(200);

    const mails = await mailsAfter(t, 1);
    expect(recipients(mails)).toEqual([U2]);
    expect(await statusOf(b.id)).toBe('CANCELLED');
  });

  test('[real] TC-NTF-JOB-111 เตือน 15 นาทีของการจองที่ผู้จองถูกปิดบัง → เมลถึงผู้เข้าร่วมเท่านั้น และบันทึกว่าเตือนแล้ว (SENT)', async () => {
    const t = token();
    const slot = nearSlot();
    const b = await bookedByMasked('open', slot, 'rem', t);
    await clearMail();
    await setClock(new Date(Date.parse(slot.startAt) - 10 * 60_000));
    await runJobs(t);

    const mails = await mailsAfter(t, 1);
    expect(mails.every((m) => m.Subject.includes('ใกล้ถึงเวลาประชุม'))).toBe(true);
    expect(recipients(mails)).toEqual([U2]);
    expect(psql(`select reminder_status from bookings where id = ${lit(b.id)}`)).toBe('SENT');
  });

  test('[real] TC-NTF-JOB-112 เตือน 15 นาทีของการจองที่ผู้จองและผู้เข้าร่วมถูกปิดบังทั้งคู่ → ไม่มีเมล แต่บันทึกว่าเตือนแล้ว (SENT)', async () => {
    const t = token();
    const slot = nearSlot();
    const b = await bookedByMasked('open', slot, 'rn', t, true);
    await clearMail();
    await setClock(new Date(Date.parse(slot.startAt) - 10 * 60_000));
    await runJobs(t);

    await settle();
    expect(await mailsFor(t)).toHaveLength(0);
    expect(psql(`select reminder_status from bookings where id = ${lit(b.id)}`)).toBe('SENT');
  });

  test('[real] TC-NTF-JOB-113 ยกเลิกอัตโนมัติของการจองรออนุมัติที่ผู้จองถูกปิดบัง → ยกเลิกสำเร็จ ไม่มีเมล (ไม่เหลือผู้รับ → ข้าม)', async () => {
    const t = token();
    const slot = nearSlot();
    const b = await bookedByMasked('appr', slot, 'aut', t);
    expect(b.status).toBe('PENDING_APPROVAL');
    await clearMail();
    await setClock(new Date(Date.parse(slot.startAt) + 60_000));
    await runJobs(t);

    await settle();
    expect(await mailsFor(t), 'ห้ามมีเมลถึงใคร').toHaveLength(0);
    expect(await statusOf(b.id)).toBe('CANCELLED');
  });
});
