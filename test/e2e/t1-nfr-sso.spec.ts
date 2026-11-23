import { expect, test, type Page } from '@playwright/test';

/**
 * NFR-mrr-001 (Email องค์กรอย่างเดียว ไม่เชื่อม Active Directory/SSO) — TC-NFR-REQ001-101.
 * [real] เปิด UI-mrr-001 ของ stack จริงโดยไม่มี session แล้วตรวจว่าทางเข้ามีเฉพาะ Email
 * (PO ตอบข้อ 4 = ก เมื่อ 2026-11-23 · Tag = AI-generated · ยังไม่ผ่าน QA review)
 *
 * ขอบเขต: พิสูจน์ที่หน้าจอเท่านั้น — ไม่พิสูจน์ว่า API ไม่มีเส้นทาง SSO ซ่อนอยู่ · "ข้อความบนหน้าจอ" [TBD] จึงตรวจด้วยคำที่บ่งชี้ SSO/AD
 * (รายการคำเป็น [Recommended] ของ QA รอ PO ยืนยัน OQ ข้อ 5 ว่าช่องทางใดนับเป็น SSO/AD)
 */
const SSO_WORDS = /\b(sso|single sign[- ]?on|active directory|azure ad|entra|ldap|saml|oidc|oauth|microsoft|google|okta)\b|^\s*ad\s*$/i;

/** ส่วนที่ผู้ใช้โต้ตอบได้บนหน้า: ปุ่ม ลิงก์ ช่องกรอก */
async function describeEntryPoints(page: Page) {
  return page.evaluate(() => {
    const here = location.origin;
    const label = (e: Element) =>
      [e.textContent, e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('data-testid'), e.getAttribute('href'), e.getAttribute('name')]
        .filter(Boolean)
        .join(' | ');
    const els = Array.from(document.querySelectorAll('button, a[href], input, [role="button"], [role="link"]'));
    return {
      controls: els.map((e) => ({ tag: e.tagName.toLowerCase(), type: e.getAttribute('type'), label: label(e) })),
      externalLinks: els
        .filter((e) => e.tagName === 'A' && /^https?:/i.test(e.getAttribute('href') ?? '') && new URL(e.getAttribute('href')!).origin !== here)
        .map((e) => e.getAttribute('href')),
    };
  });
}

const ssoHits = (d: Awaited<ReturnType<typeof describeEntryPoints>>) => d.controls.filter((c) => SSO_WORDS.test(c.label));

test('[real] TC-NFR-REQ001-101 หน้าเข้าสู่ระบบมีเฉพาะทางเข้าด้วย Email องค์กร ไม่มีปุ่ม/ลิงก์ SSO หรือ Active Directory (NFR-mrr-001)', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://localhost:4173', timezoneId: 'Asia/Bangkok', locale: 'th-TH' }); // ไม่มี session
  const page = await context.newPage();
  try {
    await page.goto('/UI-mrr-001');
    await expect(page.getByRole('heading', { name: 'ขอรหัสเข้าสู่ระบบ' })).toBeVisible();

    // ทางเข้าที่ต้องมี: ช่อง Email องค์กร + ปุ่มขอรหัส
    await expect(page.getByTestId('ui-mrr-001-org-email')).toBeVisible();
    await expect(page.getByTestId('ui-mrr-001-request-code')).toBeVisible();

    const entry = await describeEntryPoints(page);

    // ไม่มีทางเข้าอื่น: ช่องกรอก 1 ช่อง ปุ่มกด 1 ปุ่ม ไม่มีลิงก์ออกนอกระบบ
    expect(entry.controls.filter((c) => c.tag === 'input')).toHaveLength(1);
    expect(entry.controls.filter((c) => c.tag === 'button')).toHaveLength(1);
    expect(entry.externalLinks).toEqual([]);
    expect(ssoHits(entry)).toEqual([]);

    // negative check: ฉีดปุ่ม SSO เข้าไปแล้ว detector ต้องจับได้ (พิสูจน์ว่า assertion ข้างบนจับผิดได้จริง)
    await page.evaluate(() => {
      const b = document.createElement('button');
      b.textContent = 'เข้าสู่ระบบด้วย SSO';
      document.querySelector('form')!.appendChild(b);
    });
    expect(ssoHits(await describeEntryPoints(page))).toHaveLength(1);
  } finally {
    await context.close();
  }
});
