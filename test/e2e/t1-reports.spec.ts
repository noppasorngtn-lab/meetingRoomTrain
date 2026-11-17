import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { as, stateOf } from './support/world';
import {
  changeIssuesBooking, MONTHS, resetIssuesBooking, ROOM_NAME, seedReportFixture, sql, weekdays,
} from './support/report-fixture';

/**
 * เคสรายงานการใช้ห้อง (EX-mrr-047 · 048 · 049 · 072 · 084–087) บน fixture ตาม GD-mrr-001 — support/report-fixture.ts.
 * ทุกเคสผ่านหน้าจอ RPT-mrr-001 (ออก/เปิดรายงานด้วยปุ่มจริง) และเทียบเลขกับ API; แต่ละเคสมีเดือนของตัวเอง
 * (รายงานจัดอันดับทุกห้องที่ใช้งานอยู่ — ถ้าใช้เดือนเดียวกัน ห้องของเคสหนึ่งจะแทรกอันดับของอีกเคส).
 * รายงานที่ออกแล้วลบไม่ได้ (BR-mrr-015) — เลขฉบับของแต่ละเดือนเพิ่มขึ้นทุกรอบ จึงอ่านเลขฉบับจากคำตอบเสมอ ไม่เดา.
 */

const NOTICE_NEW_ISSUE = 'ออกรายงานฉบับใหม่แล้ว ฉบับเดิมยังเก็บไว้';
const LOCKED = 'รายงานที่ออกแล้วแก้ไขไม่ได้ กรุณาออกฉบับใหม่';

interface Line { room: { id: string; name: string }; bookedMinutes: number; operatingMinutes: number; utilizationPct: string | null; display: string; rank: number | null }
interface Report { id: string; issueNo: number; lines: Line[]; issues: { issueNo: number }[] }

let ra: APIRequestContext;
test.beforeAll(async () => {
  ra = await as('ra1');
  seedReportFixture();
});
test.afterAll(async () => {
  await ra.dispose();
});

/** The fixture's own rooms from a report, by letter. */
const lineOf = (r: Report, name: string) => {
  const l = r.lines.find((x) => x.room.name === name);
  if (!l) throw new Error(`${name} is not in the report`);
  return l;
};
/** What an issue holds: its own numbers. (`issues`, the list of issues, grows as later ones are made — that is not the issue's.) */
const numbers = (r: Report) => ({ id: r.id, issueNo: r.issueNo, lines: r.lines });
/** The line above the table (period · issue no. · issued at) — the issue picker's <option>s have the same words but are hidden. */
const heading = (page: Page, issueNo: number) => page.locator('p.help', { hasText: `ฉบับที่ ${issueNo} ·` });
const issue = async (month: string) => {
  const res = await ra.post('/reports/utilization', { data: { periodType: 'MONTH', periodStart: `${month}-01` } });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as { message: string; report: Report };
};
const view = async (month: string, issueNo?: number) => {
  const res = await ra.get(`/reports/utilization?periodType=MONTH&periodStart=${month}-01${issueNo ? `&issueNo=${issueNo}` : ''}`);
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as Report;
};

/** A Room Administrator's own browser on the report screen, the month typed in. */
async function openReport(page: Page, month: string) {
  await page.goto('/RPT-mrr-001');
  await page.getByTestId('rpt-mrr-001-ent-012-period-start').fill(month);
}
const rowOf = (page: Page, name: string) =>
  page.locator('tr', { has: page.getByTestId('rpt-mrr-001-ent-013-room').getByText(name, { exact: true }) });
const cell = (page: Page, name: string, field: 'booked-minutes' | 'operating-minutes' | 'utilization-pct' | 'rank') =>
  rowOf(page, name).getByTestId(`rpt-mrr-001-ent-013-${field}`);

test.use({ storageState: stateOf('ra1') });

// ------------------------------------------------------------------ ตัวเลขรายห้อง (BR-mrr-006 · CALC-mrr-001@v1 · GD-mrr-001)
test.describe('อัตราการใช้งานรายห้อง', () => {
  test('[fixture] เดือนมี จ.–ศ. 22 วัน = 13,200 นาที (ฐานของเคสทั้งหมด)', () => {
    for (const m of Object.values(MONTHS)) expect(weekdays(m), m).toHaveLength(22);
  });

  test('[real] TC-RPT-RPT001-107 เปิดรายงาน → B 66.67% อันดับ 1 · A 33.33% อันดับ 2 · ยกเลิก/รออนุมัติ/ปฏิเสธไม่นับ (EX-mrr-084 · BR-mrr-006)', async ({ page }) => {
    await openReport(page, MONTHS.rank);
    await page.getByTestId('rpt-mrr-001-issue').click();
    await expect(cell(page, ROOM_NAME.B, 'utilization-pct')).toHaveText('66.67%');
    await expect(cell(page, ROOM_NAME.A, 'utilization-pct')).toHaveText('33.33%');
    await expect(cell(page, ROOM_NAME.B, 'rank')).toHaveText('1');
    await expect(cell(page, ROOM_NAME.A, 'rank')).toHaveText('2');
    await expect(cell(page, ROOM_NAME.B, 'booked-minutes')).toHaveText('8,800');
    await expect(cell(page, ROOM_NAME.A, 'booked-minutes')).toHaveText('4,400'); // 5/10 ยกเลิก · 6/10 รออนุมัติ · 7/10 ปฏิเสธ ไม่นับ
    await expect(cell(page, ROOM_NAME.A, 'operating-minutes')).toHaveText('13,200');
    // The two ranked rows lead the table, in that order.
    await expect(page.getByTestId('rpt-mrr-001-ent-013-room').first()).toHaveText(ROOM_NAME.B);
    await expect(page.getByTestId('rpt-mrr-001-ent-013-room').nth(1)).toHaveText(ROOM_NAME.A);
  });

  test('[real] TC-RPT-RPT001-108 ห้อง C จองศุกร์ 17:00–19:00 + เสาร์ → 0.45% นับเฉพาะ 17:00–18:00 (EX-mrr-085 · BR-mrr-006)', async ({ page }) => {
    await openReport(page, MONTHS.boundary);
    await page.getByTestId('rpt-mrr-001-issue').click();
    await expect(cell(page, ROOM_NAME.C, 'utilization-pct')).toHaveText('0.45%');
    await expect(cell(page, ROOM_NAME.C, 'booked-minutes')).toHaveText('60');
    await expect(cell(page, ROOM_NAME.C, 'operating-minutes')).toHaveText('13,200');
    await expect(cell(page, ROOM_NAME.C, 'rank')).toHaveText('1');
  });

  test('[real] TC-RPT-RPT001-109 ห้อง D ปิดปรับปรุง 19–23 → 50.00% ตัวหาร 10,200 · การจอง 21 ในช่วงปิดไม่นับ (EX-mrr-086 · BR-mrr-006 · BR-mrr-012)', async ({ page }) => {
    await openReport(page, MONTHS.maintenance);
    await page.getByTestId('rpt-mrr-001-issue').click();
    await expect(cell(page, ROOM_NAME.D, 'utilization-pct')).toHaveText('50.00%');
    await expect(cell(page, ROOM_NAME.D, 'operating-minutes')).toHaveText('10,200'); // 13,200 − 3,000
    await expect(cell(page, ROOM_NAME.D, 'booked-minutes')).toHaveText('5,100'); // 17 วัน × 300 · การจอง 21/10 ไม่รวม
    await expect(cell(page, ROOM_NAME.D, 'rank')).toHaveText('1');
  });

  test('[real] TC-RPT-RPT001-110 ห้อง E ปิดทั้งเดือน → "—" ไม่มีเลขอันดับ ไม่อยู่ในอันดับ (EX-mrr-087 · BR-mrr-006)', async ({ page }) => {
    await openReport(page, MONTHS.closed);
    await page.getByTestId('rpt-mrr-001-issue').click();
    await expect(cell(page, ROOM_NAME.E, 'utilization-pct')).toHaveText('—');
    await expect(cell(page, ROOM_NAME.E, 'rank')).toHaveText('');
    await expect(cell(page, ROOM_NAME.E, 'operating-minutes')).toHaveText('0');
    await expect(cell(page, ROOM_NAME.E, 'booked-minutes')).toHaveText('0'); // การจอง 5/10 ที่คงอยู่ไม่นับ
    // Nobody who is ranked is room E, and the unranked ones come last.
    const ranks = await page.getByTestId('rpt-mrr-001-ent-013-rank').allTextContents();
    const names = await page.getByTestId('rpt-mrr-001-ent-013-room').allTextContents();
    expect(ranks.some((r) => r !== '')).toBe(true);
    expect(names.filter((_, i) => ranks[i] !== '')).not.toContain(ROOM_NAME.E);
    expect(ranks.indexOf('')).toBeGreaterThan(ranks.map((r) => r !== '').lastIndexOf(true)); // no gaps: ranked rows first
    // The api says the same.
    const e = lineOf(await view(MONTHS.closed), ROOM_NAME.E);
    expect(e).toMatchObject({ operatingMinutes: 0, utilizationPct: null, display: '—', rank: null });
  });
});

// ------------------------------------------------------------------ หน้ารายงาน (BR-mrr-022) และรายงานที่ออกแล้วแก้ไม่ได้ (BR-mrr-015)
test.describe('หน้ารายงานและฉบับที่ออกแล้ว', () => {
  test('[real] TC-RPT-RPT001-104 Room Administrator เปิดหน้ารายงาน → เห็นรายงานของเดือนพร้อมอันดับห้องที่ใช้สูงสุด (EX-mrr-072 · BR-mrr-022)', async ({ page }) => {
    const first = (await issue(MONTHS.issues)).report; // "ออกแล้ว" — the given of the case
    await openReport(page, MONTHS.issues);
    await expect(page.getByRole('heading', { name: 'รายงานการใช้ห้อง' })).toBeVisible();
    await expect(heading(page, (await view(MONTHS.issues)).issueNo)).toBeVisible();
    // Room B (four hours) is the top of the ranking, A below it.
    await expect(page.getByTestId('rpt-mrr-001-ent-013-room').first()).toHaveText(ROOM_NAME.B);
    await expect(page.getByTestId('rpt-mrr-001-ent-013-rank').first()).toHaveText('1');
    await expect(cell(page, ROOM_NAME.B, 'utilization-pct')).toHaveText('1.82%'); // 240 ÷ 13,200 = 1.818…
    expect(lineOf(first, ROOM_NAME.B).rank).toBe(1);
  });

  test('[real] TC-RPT-RPT001-101 ออกรายงานเดือนเดิมอีกครั้ง → ฉบับใหม่คิดจากข้อมูลล่าสุด ฉบับเดิมยังอยู่ (EX-mrr-047 · BR-mrr-015)', async ({ page }) => {
    resetIssuesBooking();
    const first = (await issue(MONTHS.issues)).report; // ฉบับที่ 1 ของเรื่องนี้
    expect(lineOf(first, ROOM_NAME.A).bookedMinutes).toBe(60);
    changeIssuesBooking(); // ข้อมูลการจองเปลี่ยนทีหลัง (60 → 120 นาที)

    await openReport(page, MONTHS.issues);
    await page.getByTestId('rpt-mrr-001-issue').click();
    await expect(page.getByText(NOTICE_NEW_ISSUE).first()).toBeVisible();
    await expect(cell(page, ROOM_NAME.A, 'booked-minutes')).toHaveText('120');
    await expect(cell(page, ROOM_NAME.A, 'utilization-pct')).toHaveText('0.91%'); // 120 ÷ 13,200 = 0.909…

    const second = await view(MONTHS.issues);
    expect(second.issueNo).toBe(first.issueNo + 1);
    expect(second.issues.map((i) => i.issueNo)).toContain(first.issueNo); // the earlier issue is still listed
    expect(numbers(await view(MONTHS.issues, first.issueNo))).toEqual(numbers(first));
  });

  test('[real] TC-RPT-RPT001-102 สั่งแก้ตัวเลขของห้อง A ในรายงานที่ออกแล้ว → ปฏิเสธ ตัวเลขคงเดิม (EX-mrr-048 · BR-mrr-015)', async () => {
    resetIssuesBooking();
    const report = (await issue(MONTHS.issues)).report;
    const before = await view(MONTHS.issues, report.issueNo);

    const res = await ra.patch(`/reports/utilization/${report.id}`, { data: { bookedMinutes: 9999 } });
    expect(res.status()).toBe(409);
    expect((await res.json()).message).toBe(LOCKED);
    expect(numbers(await view(MONTHS.issues, report.issueNo))).toEqual(numbers(before));

    // Even straight at the table the issued numbers do not move (append-only trigger).
    expect(() => sql(`update utilization_report_lines set booked_minutes = 9999 where report_id = '${report.id}'`)).toThrow(/append-only/);
    expect(() => sql(`delete from utilization_reports where id = '${report.id}'`)).toThrow(/append-only/);
    expect(numbers(await view(MONTHS.issues, report.issueNo))).toEqual(numbers(before));
  });

  test('[real] TC-RPT-RPT001-103 เปิดดูฉบับเก่าหลังข้อมูลเปลี่ยน → ตัวเลขเท่าตอนออก ส่วนที่เปลี่ยนอยู่ในฉบับใหม่ (EX-mrr-049 · BR-mrr-015)', async ({ page }) => {
    resetIssuesBooking();
    const old = (await issue(MONTHS.issues)).report; // ออกตอน A = 60 นาที
    const oldA = lineOf(old, ROOM_NAME.A);
    changeIssuesBooking();
    const fresh = (await issue(MONTHS.issues)).report; // ออกใหม่หลังข้อมูลเปลี่ยน
    expect(fresh.issueNo).toBe(old.issueNo + 1);
    expect(lineOf(fresh, ROOM_NAME.A).bookedMinutes).toBe(120);

    // Through the screen: it shows the latest, then the older issue is chosen and opened.
    await openReport(page, MONTHS.issues);
    await expect(cell(page, ROOM_NAME.A, 'booked-minutes')).toHaveText('120');
    await page.getByTestId('rpt-mrr-001-ent-012-issue-no').selectOption(String(old.issueNo));
    await page.getByTestId('rpt-mrr-001-open-issue').click();
    await expect(heading(page, old.issueNo)).toBeVisible();
    await expect(cell(page, ROOM_NAME.A, 'booked-minutes')).toHaveText(String(oldA.bookedMinutes)); // 60
    await expect(cell(page, ROOM_NAME.A, 'utilization-pct')).toHaveText(oldA.display); // 0.45%
    expect(numbers(await view(MONTHS.issues, old.issueNo))).toEqual(numbers(old)); // every value as it was issued
  });
});
