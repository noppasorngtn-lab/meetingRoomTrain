import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { myBookingsPageOf } from './support/my-bookings';
import { uiDateTime } from './support/ui-format';

/**
 * UI-mrr-006 (create a booking · API-004). Titles carry the design's state or the rule they check.
 * [real] talks to the running api and database; [stub] answers one request in the browser, for the
 * states the dev data cannot reach (maintenance, no facilities, a failing mail server).
 */

interface RoomRow { id: string; capacity: number; requiresApproval: boolean }
const rooms: RoomRow[] = JSON.parse(readFileSync('.auth/rooms.json', 'utf8'));
const open = rooms.find((r) => !r.requiresApproval)!;
const needsApproval = rooms.find((r) => r.requiresApproval)!;

test.use({ storageState: '.auth/tester.json' });

const T = {
  start: 'ui-mrr-006-ent-007-start-at',
  end: 'ui-mrr-006-ent-007-end-at',
  title: 'ui-mrr-006-ent-007-title',
  attendee: 'ui-mrr-006-ent-008-user',
  confirm: 'ui-mrr-006-confirm',
};

/** Distinguishes the bookings of one run from those earlier runs left in the dev database. */
const RUN = Date.now().toString(36);

const pad = (n: number) => String(n).padStart(2, '0');
/** A free hour on a random day 30-730 days ahead, so earlier runs (which keep their bookings) rarely collide. */
function freeSlot(hour: number) {
  const days = 30 + Math.floor(Math.random() * 700);
  const d = new Date(Date.now() + days * 86_400_000);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { date, start: `${date}T${pad(hour)}:00`, end: `${date}T${pad(hour + 1)}:00` };
}

const openForm = (page: Page, roomId: string, slot?: { date: string; startTime: string; endTime: string }) =>
  page.goto(`/UI-mrr-006?room=${roomId}` + (slot ? `&date=${slot.date}&start=${slot.startTime}&end=${slot.endTime}` : ''));

async function pickAttendee(page: Page, query = 'admin') {
  await page.getByTestId(T.attendee).fill(query);
  await page.getByRole('list', { name: 'ผลการค้นหาผู้ใช้' }).getByRole('button').first().click();
}

async function fillForm(page: Page, slot: { start: string; end: string }, title: string) {
  await page.getByTestId(T.start).fill(uiDateTime(slot.start));
  await page.getByTestId(T.end).fill(uiDateTime(slot.end));
  await page.getByTestId(T.title).fill(title);
  await pickAttendee(page);
}

const isCreate = (r: { url(): string; request(): { method(): string } }) =>
  r.url().endsWith('/bookings') && r.request().method() === 'POST';

test.describe('ฟอร์มเปิดขึ้น (empty)', () => {
  test('[real] เปิดพร้อมห้องและเวลาที่ส่งมาทาง URL ช่องอื่นว่าง', async ({ page }) => {
    await openForm(page, open.id, { date: '2031-03-05', startTime: '10:00', endTime: '11:00' });
    await expect(page.getByRole('heading', { name: 'จองห้องประชุม', level: 1 })).toBeVisible();
    await expect(page.getByTestId('ui-mrr-006-ent-007-room')).not.toHaveText(/กำลังโหลด|—/);
    await expect(page.getByTestId(T.start)).toHaveValue('05/03/2031 10:00');
    await expect(page.getByTestId(T.end)).toHaveValue('05/03/2031 11:00');
    await expect(page.getByTestId(T.title)).toHaveValue('');
    await expect(page.getByTestId(T.confirm)).toBeEnabled();
  });

  test('[real] ห้องที่ต้องรออนุมัติบอกผู้จองตั้งแต่เปิดฟอร์ม', async ({ page }) => {
    await openForm(page, needsApproval.id);
    await expect(page.getByText('ห้องนี้ต้องรออนุมัติก่อนใช้งาน')).toBeVisible();
  });

  test('[real] ปุ่มยกเลิกกลับหน้าค้นหาห้องว่างโดยไม่บันทึก', async ({ page }) => {
    await openForm(page, open.id);
    await page.getByTestId('ui-mrr-006-cancel-form').click();
    await expect(page).toHaveURL(/\/UI-mrr-004/);
  });
});

test.describe('ตรวจข้อมูลก่อนจอง (BR-mrr-002)', () => {
  test('[real] กดยืนยันทั้งที่ฟอร์มว่าง → แจ้งทุกช่องที่ขาด และไม่ยิง API', async ({ page }) => {
    let posted = false;
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/bookings')) posted = true; });
    await openForm(page, open.id);
    await page.getByTestId(T.confirm).click();
    await expect(page.getByText('กรุณาระบุเวลาเริ่ม')).toBeVisible();
    await expect(page.getByText('กรุณาระบุเวลาสิ้นสุด')).toBeVisible();
    await expect(page.getByText('กรุณาระบุหัวข้อการประชุม')).toBeVisible();
    await expect(page.getByText('กรุณาระบุผู้เข้าร่วมอย่างน้อย 1 คน')).toBeVisible();
    expect(posted).toBe(false);
  });

  test('[real] เวลาสิ้นสุดไม่หลังเวลาเริ่ม → แจ้งที่ช่องเวลาสิ้นสุด', async ({ page }) => {
    const s = freeSlot(9);
    await openForm(page, open.id);
    await fillForm(page, { start: s.end, end: s.start }, 'เวลากลับด้าน');
    await page.getByTestId(T.confirm).click();
    await expect(page.getByText('เวลาสิ้นสุดต้องหลังเวลาเริ่ม')).toBeVisible();
  });

  test('[real] หัวข้อเกิน 200 ตัวอักษรไม่รับ (overflow)', async ({ page }) => {
    const s = freeSlot(9);
    await openForm(page, open.id);
    await fillForm(page, s, 'ก'.repeat(201));
    await page.getByTestId(T.confirm).click();
    await expect(page.getByText('หัวข้อการประชุมต้องไม่เกิน 200 ตัวอักษร')).toBeVisible();
  });

  test('[real] เวลาเริ่มในอดีต → API ปฏิเสธที่ช่องเวลาเริ่ม และข้อมูลที่กรอกยังอยู่', async ({ page }) => {
    await openForm(page, open.id);
    await fillForm(page, { start: '2020-01-06T09:00', end: '2020-01-06T10:00' }, 'ย้อนเวลา');
    await page.getByTestId(T.confirm).click();
    await expect(page.getByText('เวลาเริ่มต้องเป็นเวลาในอนาคต')).toBeVisible();
    await expect(page.getByTestId(T.title)).toHaveValue('ย้อนเวลา');
    await expect(page).toHaveURL(/UI-mrr-006/);
  });
});

test.describe.serial('จองสำเร็จและจองซ้ำ (BR-mrr-001 · BR-mrr-004 · BR-mrr-007)', () => {
  const slot = freeSlot(13);

  test('[real] ห้องที่ไม่ต้องอนุมัติ → CONFIRMED แล้วไปหน้าการจองของฉันพร้อมข้อความ', async ({ page }) => {
    await openForm(page, open.id);
    await fillForm(page, slot, `E2E จองห้องสำเร็จ ${RUN}`);
    const created = page.waitForResponse(isCreate);
    await page.getByTestId(T.confirm).click();
    const res = await created;
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('CONFIRMED');
    await expect(page).toHaveURL(/\/UI-mrr-007/);
    await expect(page.getByText(body.message, { exact: true })).toBeVisible();
    // "การจองของฉัน" เรียงเริ่มช้าสุดก่อนและสะสมแถวจากรอบก่อน ๆ — ไปหน้าที่การจองนี้อยู่จริง ไม่คาดว่าอยู่หน้า 1
    await page.goto(`/UI-mrr-007?page=${await myBookingsPageOf(page.request, body.id)}`);
    await expect(page.getByTestId('ui-mrr-007-ent-007-title').filter({ hasText: `E2E จองห้องสำเร็จ ${RUN}` })).toBeVisible();
  });

  test('[real] จองช่วงเวลาเดิมซ้ำ → ห้องไม่ว่าง และข้อมูลในฟอร์มยังอยู่', async ({ page }) => {
    await openForm(page, open.id);
    await fillForm(page, slot, `E2E จองซ้ำ ${RUN}`);
    await page.getByTestId(T.confirm).click();
    await expect(page.getByRole('alert')).toContainText('ห้องนี้ไม่ว่างในช่วงเวลาที่เลือก กรุณาเลือกเวลาอื่น');
    await expect(page.getByTestId(T.title)).toHaveValue(`E2E จองซ้ำ ${RUN}`);
    await expect(page.getByTestId(T.start)).toHaveValue(uiDateTime(slot.start));
    await expect(page.getByTestId(T.confirm)).toBeEnabled();
  });

  test('[real] ห้องที่ต้องอนุมัติ → PENDING_APPROVAL', async ({ page }) => {
    const s = freeSlot(15);
    await openForm(page, needsApproval.id);
    await fillForm(page, s, `E2E รออนุมัติ ${RUN}`);
    const created = page.waitForResponse(isCreate);
    await page.getByTestId(T.confirm).click();
    const res = await created;
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('PENDING_APPROVAL');
    expect(body.message).toBe('ส่งคำขอจองแล้ว รอการอนุมัติ'); // TC-BKG-UI006-025 · EX-mrr-012
    await expect(page).toHaveURL(/\/UI-mrr-007/);
    await expect(page.getByText(body.message, { exact: true })).toBeVisible();
    // "การจองของฉัน" เรียงเริ่มช้าสุดก่อนและสะสมแถวจากรอบก่อน ๆ — ไปหน้าที่การจองนี้อยู่จริง ไม่คาดว่าอยู่หน้า 1
    await page.goto(`/UI-mrr-007?page=${await myBookingsPageOf(page.request, body.id)}`);
    await expect(page.getByTestId('ui-mrr-007-ent-007-title').filter({ hasText: `E2E รออนุมัติ ${RUN}` })).toBeVisible();
  });
});

/** Books through the real form; returns the create response. Used to set up the slots the next case collides with. */
async function bookOnForm(page: Page, roomId: string, start: string, end: string, title: string) {
  await openForm(page, roomId);
  await fillForm(page, { start, end }, title);
  const created = page.waitForResponse(isCreate);
  await page.getByTestId(T.confirm).click();
  return created;
}

const CONFLICT = 'ห้องนี้ไม่ว่างในช่วงเวลาที่เลือก กรุณาเลือกเวลาอื่น';

// Same booker throughout: the dev data has one signed-in user, so "another user" of EX-mrr-003 is not reproduced.
test.describe.serial('ขอบเขตเวลาของการจอง BVA (BR-mrr-001 · EX-mrr-001/002)', () => {
  const day = freeSlot(9).date;
  const at = (hhmm: string) => `${day}T${hhmm}`;

  test('[real] เตรียมข้อมูล: จอง 09:00–10:00', async ({ page }) => {
    const res = await bookOnForm(page, open.id, at('09:00'), at('10:00'), `E2E ขอบเขต 09-10 ${RUN}`);
    expect(res.status()).toBe(201);
  });

  test('[real] TC-BKG-UI006-020 จอง 09:59–10:30 ทับ 09:00–10:00 แค่ 1 นาที → ไม่ว่าง (EX-mrr-002)', async ({ page }) => {
    const res = await bookOnForm(page, open.id, at('09:59'), at('10:30'), `E2E ทับ 1 นาที ${RUN}`);
    expect(res.status()).toBe(409);
    await expect(page.getByRole('alert')).toContainText(CONFLICT);
    await expect(page).toHaveURL(/UI-mrr-006/);
  });

  test('[real] TC-BKG-UI006-019 จอง 10:00–11:00 ต่อท้ายการจองที่จบ 10:00 → สำเร็จ (EX-mrr-001)', async ({ page }) => {
    const res = await bookOnForm(page, open.id, at('10:00'), at('11:00'), `E2E ต่อท้าย ${RUN}`);
    expect(res.status()).toBe(201);
    expect((await res.json()).status).toBe('CONFIRMED');
  });
});

test.describe.serial('การจองที่รออนุมัติกันช่วงเวลา (BR-mrr-001 · EX-mrr-003)', () => {
  const day = freeSlot(9).date;
  const at = (hhmm: string) => `${day}T${hhmm}`;

  test('[real] TC-BKG-UI006-021 จองทับการจอง PENDING_APPROVAL → ไม่ว่าง', async ({ page }) => {
    const first = await bookOnForm(page, needsApproval.id, at('11:00'), at('12:00'), `E2E pending ${RUN}`);
    expect(first.status()).toBe(201);
    expect((await first.json()).status).toBe('PENDING_APPROVAL');
    const second = await bookOnForm(page, needsApproval.id, at('11:30'), at('12:30'), `E2E ทับ pending ${RUN}`);
    expect(second.status()).toBe(409);
    await expect(page.getByRole('alert')).toContainText(CONFLICT);
  });
});

test.describe('ตรวจทีละช่อง (BR-mrr-002 · EX-mrr-006/007)', () => {
  async function expectOnlyError(page: Page, shown: string, hidden: string[]) {
    let posted = false;
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/bookings')) posted = true; });
    await page.getByTestId(T.confirm).click();
    await expect(page.getByText(shown)).toBeVisible();
    for (const h of hidden) await expect(page.getByText(h)).toHaveCount(0);
    expect(posted).toBe(false);
  }

  test('[real] TC-BKG-UI006-023 ไม่ใส่หัวข้อ (ช่องอื่นครบ) → แจ้งเฉพาะหัวข้อ', async ({ page }) => {
    const s = freeSlot(9);
    await openForm(page, open.id);
    await page.getByTestId(T.start).fill(uiDateTime(s.start));
    await page.getByTestId(T.end).fill(uiDateTime(s.end));
    await pickAttendee(page);
    await expectOnlyError(page, 'กรุณาระบุหัวข้อการประชุม', ['กรุณาระบุผู้เข้าร่วมอย่างน้อย 1 คน', 'กรุณาระบุเวลาเริ่ม']);
  });

  test('[real] TC-BKG-UI006-024 ไม่ใส่ผู้เข้าร่วม (ช่องอื่นครบ) → แจ้งเฉพาะผู้เข้าร่วม', async ({ page }) => {
    const s = freeSlot(9);
    await openForm(page, open.id);
    await page.getByTestId(T.start).fill(uiDateTime(s.start));
    await page.getByTestId(T.end).fill(uiDateTime(s.end));
    await page.getByTestId(T.title).fill('ไม่มีผู้เข้าร่วม');
    await expectOnlyError(page, 'กรุณาระบุผู้เข้าร่วมอย่างน้อย 1 คน', ['กรุณาระบุหัวข้อการประชุม', 'กรุณาระบุเวลาเริ่ม']);
  });
});

test.describe('Email ยืนยันการจอง (BR-mrr-007 ข้อ 1)', () => {
  test('[real] TC-BKG-UI006-026 จองสำเร็จ → มี Email ถึงผู้จอง หัวเรื่อง [จองห้องประชุม] จองสำเร็จ: <หัวข้อ>', async ({ page }) => {
    const title = `E2E อีเมลยืนยัน ${RUN}`;
    const s = freeSlot(17);
    const res = await bookOnForm(page, open.id, s.start, s.end, title);
    expect(res.status()).toBe(201);

    let found: { Subject: string; To: { Address: string }[] } | undefined;
    for (let i = 0; i < 20 && !found; i++) {
      const list = await (await fetch('http://localhost:8025/api/v1/messages')).json();
      found = (list.messages ?? []).find((m: { Subject: string }) => m.Subject.includes(title));
      if (!found) await new Promise((r) => setTimeout(r, 500));
    }
    expect(found, 'ไม่พบ Email ใน mailpit').toBeDefined();
    expect(found!.Subject.startsWith(`[จองห้องประชุม] จองสำเร็จ: ${title} · `)).toBe(true);
    expect(found!.To.map((t) => t.Address)).toEqual(['tester@mrr.local']);
  });
});

test.describe('สถานะที่ design ประกาศ', () => {
  test('[real] ไม่พบห้อง → แจ้ง "ไม่พบห้อง" และกดยืนยันไม่ได้', async ({ page }) => {
    await openForm(page, '00000000-0000-4000-8000-000000000000');
    await expect(page.getByRole('alert')).toContainText('ไม่พบห้อง');
    await expect(page.getByTestId(T.confirm)).toBeDisabled();
  });

  test('[real] ยังไม่เข้าสู่ระบบ (unauthorized) → พาไปหน้าขอรหัส', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: 'http://localhost:4173', storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await openForm(page, open.id);
    await expect(page).toHaveURL(/\/UI-mrr-001/);
    await ctx.close();
  });

  test('[stub] ห้องปิดปรับปรุง → แจ้งและปิดปุ่มยืนยัน', async ({ page }) => {
    await page.route(`**/rooms/${open.id}`, (r) =>
      r.fulfill({ json: { id: open.id, name: 'ห้องปิดซ่อม', capacity: 8, requiresApproval: false, status: 'UNDER_MAINTENANCE' } }));
    await openForm(page, open.id);
    await expect(page.getByRole('alert')).toContainText('ห้องนี้ปิดปรับปรุง ไม่สามารถจองได้');
    await expect(page.getByTestId(T.confirm)).toBeDisabled();
  });

  test('[stub] ห้องปิดซ่อมหลังเปิดฟอร์ม (API ตอบ 409) → แจ้งข้อความเดียวกันและเก็บข้อมูลไว้', async ({ page }) => {
    await page.route('**/bookings', (r) =>
      r.request().method() === 'POST' ? r.fulfill({ status: 409, json: { message: 'ห้องนี้ปิดปรับปรุง ไม่สามารถจองได้' } }) : r.fallback());
    const s = freeSlot(9);
    await openForm(page, open.id);
    await fillForm(page, s, 'ปิดซ่อมกลางทาง');
    await page.getByTestId(T.confirm).click();
    await expect(page.getByRole('alert')).toContainText('ห้องนี้ปิดปรับปรุง ไม่สามารถจองได้');
    await expect(page.getByTestId(T.title)).toHaveValue('ปิดซ่อมกลางทาง');
  });

  test('[stub] ผู้เข้าร่วมเกินความจุ → เตือนแต่ยังจองได้ (overflow)', async ({ page }) => {
    await page.route(`**/rooms/${open.id}`, (r) =>
      r.fulfill({ json: { id: open.id, name: 'ห้องเล็ก', capacity: 1, requiresApproval: false, status: 'ACTIVE' } }));
    let body: any;
    await page.route('**/bookings', (r) => {
      if (r.request().method() !== 'POST') return r.fallback();
      body = r.request().postDataJSON();
      return r.fulfill({ status: 201, json: { id: 'x', status: 'CONFIRMED', message: 'จองสำเร็จ' } });
    });
    const s = freeSlot(9);
    await openForm(page, open.id);
    await fillForm(page, s, 'เกินความจุ');
    await pickAttendee(page, 'tester');
    await expect(page.getByRole('status').filter({ hasText: 'ผู้เข้าร่วมเกินความจุห้อง' })).toContainText('ห้องนี้รองรับ 1 คน ยังยืนยันการจองได้');
    await page.getByTestId(T.confirm).click();
    await expect(page).toHaveURL(/\/UI-mrr-007/);
    expect(body.attendeeIds).toHaveLength(2);
  });

  test('[stub] TC-BKG-UI006-027 ส่ง Email ไม่สำเร็จ (503 · BR-mrr-019 · EX-mrr-062) → แสดงข้อความของ API ข้อมูลคงไว้ กดซ้ำได้', async ({ page }) => {
    const message = 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง';
    await page.route('**/bookings', (r) =>
      r.request().method() === 'POST' ? r.fulfill({ status: 503, json: { message } }) : r.fallback());
    const s = freeSlot(9);
    await openForm(page, open.id);
    await fillForm(page, s, 'เมลล้ม 503');
    await page.getByTestId(T.confirm).click();
    await expect(page.getByRole('alert')).toContainText(message);
    await expect(page).toHaveURL(/UI-mrr-006/);
    await expect(page.getByTestId(T.title)).toHaveValue('เมลล้ม 503');
    await expect(page.getByTestId(T.confirm)).toBeEnabled();
  });

  test('[stub] ข้อผิดพลาด 500 ที่ไม่คาดคิด → ข้อความทั่วไป ข้อมูลในฟอร์มคงไว้ และกดซ้ำได้ (fallback ของ BookingPage)', async ({ page }) => {
    await page.route('**/bookings', (r) =>
      r.request().method() === 'POST' ? r.fulfill({ status: 500, json: { message: 'boom' } }) : r.fallback());
    const s = freeSlot(9);
    await openForm(page, open.id);
    await fillForm(page, s, 'เมลไม่ออก');
    await page.getByTestId(T.confirm).click();
    await expect(page.getByRole('alert')).toContainText('จองไม่สำเร็จ กรุณากดยืนยันอีกครั้ง');
    await expect(page.getByTestId(T.title)).toHaveValue('เมลไม่ออก');
    await expect(page.getByTestId(T.confirm)).toBeEnabled();
  });

  test('[stub] ระหว่างบันทึก (loading) ปุ่มยืนยันถูกปิดและบอกว่ากำลังส่ง Email', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((res) => (release = res));
    await page.route('**/bookings', async (r) => {
      if (r.request().method() !== 'POST') return r.fallback();
      await gate;
      return r.fulfill({ status: 201, json: { id: 'x', status: 'CONFIRMED', message: 'จองสำเร็จ' } });
    });
    const s = freeSlot(9);
    await openForm(page, open.id);
    await fillForm(page, s, 'กำลังโหลด');
    await page.getByTestId(T.confirm).click();
    await expect(page.getByTestId(T.confirm)).toBeDisabled();
    await expect(page.getByText('กำลังบันทึกและส่ง Email…')).toBeVisible();
    release();
    await expect(page).toHaveURL(/\/UI-mrr-007/);
  });

  test('[stub] อุปกรณ์เสริมที่ติ๊กถูกส่งไปกับคำขอจอง และเวลาถูกอ่านเป็นเวลาไทย', async ({ page }) => {
    await page.route('**/facilities?active=true', (r) =>
      r.fulfill({ json: [{ id: 'f1', name: 'โปรเจกเตอร์' }, { id: 'f2', name: 'ไมค์ประชุม' }] }));
    let body: any;
    await page.route('**/bookings', (r) => {
      if (r.request().method() !== 'POST') return r.fallback();
      body = r.request().postDataJSON();
      return r.fulfill({ status: 201, json: { id: 'x', status: 'CONFIRMED', message: 'จองสำเร็จ' } });
    });
    const s = freeSlot(9);
    await openForm(page, open.id);
    await fillForm(page, s, 'มีอุปกรณ์');
    await page.getByLabel('ไมค์ประชุม').check();
    await page.getByTestId(T.confirm).click();
    await expect(page).toHaveURL(/\/UI-mrr-007/);
    expect(body.equipmentIds).toEqual(['f2']);
    // The form value is read as Bangkok time and sent with its +07:00 offset.
    expect(body.startAt).toBe(`${s.date}T09:00:00+07:00`);
  });
});

// The cases above leave their bookings behind; "my bookings" lists 20 to a page, so enough of them push a fresh one
// off page 1 and the case that looks for it there fails at random. Remove this run's rows (none has an audit entry).
test.afterAll(() => {
  const psql = (sql: string) => execFileSync('docker', ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-c', sql], { encoding: 'utf8' });
  const mine = `select id from bookings where title like 'E2E%${RUN}' and id not in (select booking_id from booking_audit_entries)`;
  for (const t of ['booking_attendees', 'booking_equipment_requests', 'booking_adjustment_requests']) psql(`delete from ${t} where booking_id in (${mine})`);
  psql(`delete from bookings where id in (${mine})`);
});
