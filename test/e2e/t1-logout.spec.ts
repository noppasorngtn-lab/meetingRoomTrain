import { expect, request, test, type Browser } from '@playwright/test';
import { world } from './support/world';

/**
 * UI-mrr-003 ออกจากระบบ — AC-mrr-111 · 112 · 113 (FUN-mrr-015). ไม่มี BR/EX: ถือเป็นฟังก์ชันของแพลตฟอร์ม (Q3.1)
 * และ PO รับเป็นเคสนอก BR แล้ว (OQ-T1-10, 2026-11-18) — เคสจึงผูกกับ AC ของ design ไม่ใช่ EX · Tag = [Recommended].
 *
 * ออกจากระบบปิด session ฝั่งเซิร์ฟเวอร์ จึงห้ามใช้ session ที่ spec อื่นใช้ร่วมกัน (.auth/*.json):
 * เคส 101 เข้าสู่ระบบใหม่ผ่านหน้าจอจริงด้วยบัญชี `rpt` (e2e.rptbooker@mrr.local ผู้จองของ fixture รายงาน) ได้ session ของตัวเอง
 */
const MAILPIT = 'http://localhost:8025';
const BASE = 'http://localhost:4173';
const MESSAGE_DONE = 'ออกจากระบบแล้ว';
const MESSAGE_FAILED = 'ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง';

async function codeFromMail(to: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/messages`)).json();
    const mine = (list.messages ?? []).find((m: { To: { Address: string }[] }) => m.To.some((t) => t.Address === to));
    if (mine) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${mine.ID}`)).json();
      const m = /(\d{6})/.exec(msg.Text as string);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no sign-in email for ${to}`);
}

/** Signs in through the real screens in a new browser context and returns it (its own session cookie). */
async function signInFresh(browser: Browser, email: string) {
  await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`, { method: 'DELETE' }); // an old code would be read first
  const context = await browser.newContext({ baseURL: BASE, timezoneId: 'Asia/Bangkok', locale: 'th-TH' });
  const page = await context.newPage();
  await page.goto('/UI-mrr-001');
  await page.getByTestId('ui-mrr-001-org-email').fill(email);
  await page.getByTestId('ui-mrr-001-request-code').click();
  await page.getByTestId('ui-mrr-002-otp-code').waitFor();
  await page.getByTestId('ui-mrr-002-otp-code').fill(await codeFromMail(email));
  await page.getByTestId('ui-mrr-002-verify').click();
  await page.waitForURL('**/UI-mrr-004');
  return { context, page };
}

test('[real] TC-AUTH-UI003-101 ผู้ใช้เข้าสู่ระบบอยู่ กดออกจากระบบ → ยกเลิก session และแสดงหน้า "ออกจากระบบแล้ว" พร้อมทางเข้าสู่ระบบอีกครั้ง (AC-mrr-111)', async ({ browser }) => {
  const { context, page } = await signInFresh(browser, world.users.rpt.email);
  const token = (await context.cookies()).find((c) => c.name.toLowerCase().includes('session') || c.httpOnly)?.value;
  expect(token, 'no session cookie after sign-in').toBeTruthy();
  const cookie = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
  expect((await context.request.get('/auth/me')).status()).toBe(200); // เข้าสู่ระบบอยู่จริง

  await page.getByTestId('nav-ui-mrr-003').click(); // เมนู "ออกจากระบบ"
  await expect(page.getByTestId('ui-mrr-003-confirmation-message')).toHaveText(MESSAGE_DONE);
  await expect(page.getByTestId('ui-mrr-003-sign-in-again')).toBeVisible();

  // session ถูกยกเลิกฝั่งเซิร์ฟเวอร์ ไม่ใช่แค่ล้างคุกกี้ในเบราว์เซอร์: เอาคุกกี้เดิมไปเรียกต้องไม่ผ่าน
  expect((await context.request.get('/auth/me')).status()).toBe(401);
  const replay = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie } });
  expect((await replay.get('/auth/me')).status()).toBe(401);
  await replay.dispose();

  await page.getByTestId('ui-mrr-003-sign-in-again').click();
  await expect(page).toHaveURL(/\/UI-mrr-001/);
  await context.close();
});

test('[stub] TC-AUTH-UI003-102 ยกเลิก session ไม่สำเร็จ → แสดง "ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง" และยังไม่แสดงว่าออกจากระบบแล้ว (AC-mrr-112)', async ({ page }) => {
  // [stub] ยังไม่มีกลไกให้ API logout ล้มจริง (t1-test-cases.md §B3: Partial) — เบราว์เซอร์ตอบแทน API ด้วย 500
  // พิสูจน์ได้แค่ว่าหน้าจอจัดการความล้มเหลวถูก ไม่พิสูจน์ว่า API จริงล้มแล้วคุกกี้คงอยู่ (ฝั่งนั้นอยู่ใน apps/api/test/auth/logout.http.spec.ts)
  await page.route('**/auth/logout', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"error"}' }));
  await page.goto('/UI-mrr-003');
  await expect(page.getByText(MESSAGE_FAILED, { exact: true })).toBeVisible();
  await expect(page.getByText(MESSAGE_DONE, { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('ui-mrr-003-confirmation-message')).toHaveCount(0);
});

test('[real] TC-AUTH-UI003-103 ผู้ที่ยังไม่ได้เข้าสู่ระบบเปิดหน้าออกจากระบบ → แสดง "ออกจากระบบแล้ว" พร้อมทางเข้าสู่ระบบอีกครั้ง เหมือนผู้ที่เพิ่งออก (AC-mrr-113)', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: BASE, timezoneId: 'Asia/Bangkok', locale: 'th-TH' }); // ไม่มี session
  const page = await context.newPage();
  await page.goto('/UI-mrr-003');
  await expect(page.getByTestId('ui-mrr-003-confirmation-message')).toHaveText(MESSAGE_DONE);
  await expect(page.getByTestId('ui-mrr-003-sign-in-again')).toBeVisible();
  await context.close();
});
