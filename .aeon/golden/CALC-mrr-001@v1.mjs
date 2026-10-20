#!/usr/bin/env node
/**
 * CALC-mrr-001@v1 — answer key generator for BR-mrr-006@v1 (อัตราการใช้งานรายห้อง).
 *
 * The filename carries @v on purpose: numbers that went out under this contract version stay
 * re-derivable from this exact file. A @v2 contract gets its own script.
 *
 * Re-run any time:   node <state-dir>/golden/CALC-mrr-001@v1.mjs
 *
 * Contract implemented here, field by field — if this file and CALC-mrr-001@v1 ever disagree,
 * the file is wrong:
 *   formula          utilization_pct = booked_minutes ÷ operating_minutes × 100
 *   inputs           booked_minutes int · operating_minutes int (whole minutes, never hours)
 *   numeric_type     decimal   → BigInt integer arithmetic, never a float
 *   rounding_mode    HALF_UP
 *   rounding_points  ONE point only: the percentage, to 2 dp. No rounding of minutes, no rounding of
 *                    the ratio before × 100.
 *   boundary_behavior
 *     1. booking outside Mon–Fri 08:00–18:00 → only the in-hours part counts (so ≤ 100%)
 *     2. only usable bookings count (no_approval | approved) — not cancelled / rejected / pending
 *     3. maintenance → removed from the divisor, and bookings kept during it are not counted
 *     4. operating_minutes = 0 → not computed, shown "—", not ranked
 *     5. public holidays on Mon–Fri are ordinary operating days (no holiday calendar)
 *   report period    calendar month (SRC-025) · display "66.67%" (SRC-025)
 */

const OPEN = 8 * 60;
const CLOSE = 18 * 60;
const USABLE = new Set(["no_approval", "approved"]);

const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const isWeekday = (y, m, d) => { const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return w >= 1 && w <= 5; };

/** minutes of [s,e) on a date that fall inside operating hours (boundary 1, 5) */
function inHours(y, m, d, s, e) {
  return isWeekday(y, m, d) ? Math.max(0, Math.min(e, CLOSE) - Math.max(s, OPEN)) : 0;
}
/** in-hours minutes of [s,e) on a date that overlap maintenance (boundary 3) */
function maintOverlap(y, m, d, s, e, maint) {
  if (!isWeekday(y, m, d)) return 0;
  let t = 0;
  for (const x of maint) if (x.day === d) t += Math.max(0, Math.min(e, toMin(x.end), CLOSE) - Math.max(s, toMin(x.start), OPEN));
  return t;
}

/** HALF_UP to 2 dp on the percentage — the contract's single rounding point. */
function pctHalfUp(booked, operating) {
  const num = BigInt(booked) * 10000n; // ×100 for percent, ×100 for 2 dp
  const den = BigInt(operating);
  let q = num / den;
  if ((num % den) * 2n >= den) q += 1n;
  return `${q / 100n}.${String(q % 100n).padStart(2, "0")}`;
}

export function utilization({ year, month, bookings = [], maintenance = [] }) {
  let operating = 0;
  for (let d = 1; d <= daysIn(year, month); d++) {
    operating += inHours(year, month, d, OPEN, CLOSE) - maintOverlap(year, month, d, OPEN, CLOSE, maintenance);
  }
  let booked = 0;
  for (const b of bookings) {
    if (!USABLE.has(b.status)) continue; // boundary 2
    const s = toMin(b.start), e = toMin(b.end);
    booked += inHours(year, month, b.day, s, e) - maintOverlap(year, month, b.day, s, e, maintenance);
  }
  if (operating === 0) return { booked_minutes: booked, operating_minutes: 0, utilization_pct: null, display: "—", ranked: false }; // boundary 4
  const pct = pctHalfUp(booked, operating);
  return { booked_minutes: booked, operating_minutes: operating, utilization_pct: pct, display: `${pct}%`, ranked: true };
}

const OCT = { year: 2026, month: 10 }; // ต.ค. 2569 — 22 weekdays
const weekdaysOct = Array.from({ length: 31 }, (_, i) => i + 1).filter((d) => isWeekday(2026, 10, d));
const fullDay = (day) => ({ day, start: "08:00", end: "18:00" });

const CASES = [
  { ...OCT, bookings: [{ day: 1, start: "08:00", end: "18:00", status: "approved" }],
    note: "ปกติ — อนุมัติแล้วนับ · 600 ÷ 13,200 = 4.5454… ปัดขึ้น" },
  { ...OCT, bookings: [{ day: 1, start: "08:00", end: "18:00", status: "no_approval" }],
    note: "ปกติ — ห้องไม่ต้องอนุมัตินับเหมือนกัน" },
  { ...OCT, bookings: [{ day: 1, start: "08:00", end: "18:00", status: "cancelled" }], note: "boundary 2 — ยกเลิกไม่นับ" },
  { ...OCT, bookings: [{ day: 1, start: "08:00", end: "18:00", status: "rejected" }], note: "boundary 2 — ปฏิเสธไม่นับ" },
  { ...OCT, bookings: [{ day: 1, start: "08:00", end: "18:00", status: "pending" }], note: "boundary 2 — รออนุมัติไม่นับ" },
  { ...OCT, bookings: [{ day: 30, start: "17:00", end: "19:00", status: "no_approval" }],
    note: "boundary 1 — คร่อม 18:00 นับแค่ 17:00–18:00" },
  { ...OCT, bookings: [{ day: 5, start: "07:00", end: "09:00", status: "no_approval" }],
    note: "boundary 1 — คร่อม 08:00 นับแค่ 08:00–09:00" },
  { ...OCT, bookings: [{ day: 31, start: "10:00", end: "12:00", status: "no_approval" }],
    note: "boundary 1 — วันเสาร์ไม่นับ" },
  { ...OCT, bookings: weekdaysOct.map((day) => ({ day, start: "07:00", end: "19:00", status: "approved" })),
    note: "boundary 1 — จองเต็มทุกวันและเลยเวลาทำการ อัตราไม่เกิน 100%" },
  { ...OCT, bookings: [{ day: 23, start: "10:00", end: "11:00", status: "no_approval" }],
    note: "boundary 5 — 23/10 วันปิยมหาราช (ศ.) นับเป็นเวลาทำการปกติ" },
  { ...OCT, maintenance: [19, 20, 21, 22, 23].map(fullDay),
    bookings: [{ day: 21, start: "10:00", end: "11:00", status: "no_approval" }, { day: 5, start: "10:00", end: "11:00", status: "no_approval" }],
    note: "boundary 3 — ปิดปรับปรุง 19–23/10 หักจากตัวหาร · การจอง 21/10 ที่คงอยู่ไม่นับ · การจอง 5/10 นับ" },
  { ...OCT, maintenance: [{ day: 5, start: "10:00", end: "12:00" }],
    bookings: [{ day: 5, start: "09:00", end: "11:00", status: "no_approval" }],
    note: "boundary 3 — การจองคร่อมช่วงปิดปรับปรุงบางส่วน นับแค่ 09:00–10:00" },
  { ...OCT, maintenance: weekdaysOct.map(fullDay),
    bookings: [{ day: 5, start: "10:00", end: "11:00", status: "no_approval" }],
    note: "boundary 4 — ปิดปรับปรุงทั้งเดือน ตัวหาร = 0 แสดง — ไม่เข้าอันดับ" },
  { ...OCT,
    maintenance: [...weekdaysOct.filter((d) => d < 29).map(fullDay), { day: 29, start: "08:00", end: "14:40" }],
    bookings: [{ day: 30, start: "08:00", end: "14:41", status: "approved" }],
    note: "HALF_UP — ตัวหาร 800 ตัวตั้ง 401 = 50.125 พอดี · HALF_UP ได้ 50.13 (half-even จะได้ 50.12)" },
];

if (process.argv[1]?.endsWith("CALC-mrr-001@v1.mjs")) {
  const rows = CASES.map(({ note, ...input }) => ({ input, expected: utilization(input), note }));
  console.log(JSON.stringify(rows, null, 2));
}
