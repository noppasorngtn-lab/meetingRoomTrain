import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

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
  await page.getByTestId(T.start).fill(slot.start);
  await page.getByTestId(T.end).fill(slot.end);
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
    await expect(page.getByTestId(T.start)).toHaveValue('2031-03-05T10:00');
    await expect(page.getByTestId(T.end)).toHaveValue('2031-03-05T11:00');
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
    await expect(page.getByTestId('ui-mrr-007-ent-007-title').filter({ hasText: `E2E จองห้องสำเร็จ ${RUN}` })).toBeVisible();
  });

  test('[real] จองช่วงเวลาเดิมซ้ำ → ห้องไม่ว่าง และข้อมูลในฟอร์มยังอยู่', async ({ page }) => {
    await openForm(page, open.id);
    await fillForm(page, slot, `E2E จองซ้ำ ${RUN}`);
    await page.getByTestId(T.confirm).click();
    await expect(page.getByRole('alert')).toContainText('ห้องนี้ไม่ว่างในช่วงเวลาที่เลือก กรุณาเลือกเวลาอื่น');
    await expect(page.getByTestId(T.title)).toHaveValue(`E2E จองซ้ำ ${RUN}`);
    await expect(page.getByTestId(T.start)).toHaveValue(slot.start);
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
    expect((await res.json()).status).toBe('PENDING_APPROVAL');
    await expect(page).toHaveURL(/\/UI-mrr-007/);
    await expect(page.getByTestId('ui-mrr-007-ent-007-title').filter({ hasText: `E2E รออนุมัติ ${RUN}` })).toBeVisible();
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

  test('[stub] ส่ง Email ไม่สำเร็จ (500) → แจ้งให้กดใหม่ ข้อมูลในฟอร์มคงไว้ และกดซ้ำได้', async ({ page }) => {
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
