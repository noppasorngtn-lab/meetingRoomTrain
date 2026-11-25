# รายงาน T7 — Regression หลังแก้ DEF-06 (Build `d73529c`, 2026-11-25)

**Run type: Full (Playwright chromium ทั้งชุด) + jest ทั้งชุด** [Recommended] — การแก้แตะคิวรีผู้รับเมลของทุกเหตุการณ์ที่ส่งถึงผู้เข้าร่วม จึงรันทั้งชุดแทนการเลือก · ต่อจาก [t7-regression-def05-fix-2026-11-20.md](t7-regression-def05-fix-2026-11-20.md) · ร่างโดย AI ให้ QA ตรวจ

## Change list (เทียบ `2bf82e6` → `d73529c`)

| # | Change | อยู่ใน |
|---|---|---|
| C1 | คิวรีรายชื่อผู้รับเมลกรอง `u.active = true` — ผู้เข้าร่วมที่ไม่ active/ถูกปิดบัง (ADR-017) ไม่ได้รับเมล · 7 คิวรี: ยกเลิก (ผู้จอง · RA แทน) · เปลี่ยนเวลา (ผู้จอง · RA) · ปฏิเสธ · เปลี่ยนผลเป็นปฏิเสธ · เตือน/ยกเลิกอัตโนมัติ (`loadSnapshots`) · เตือนทันทีตอนห้องเลิกต้องอนุมัติ | `apps/api/src/modules/booking/booking-edit.service.ts` · `booking-approval.service.ts` · `apps/api/src/modules/rooms/room-admin.service.ts` · `apps/api/src/common/booking-snapshots.ts` (commit `f83de74`) |
| C2 | unit test ใหม่ 8 เคส + helper `maskUser` | `apps/api/test/**` (commit `f83de74`) |
| C3 | เอกสาร QA | `docs/qa/*` (commit `d73529c`) |

ไม่เปลี่ยน: หน้าเว็บ (`apps/web`) · migration · `docker/` · `.aeon/` · REQ/BR (BR-mrr-007@v2 (3) ยังเขียน "ผู้เข้าร่วมทุกคน" — โค้ดนำหน้า BR จนกว่า Q-ADR017-3 ถูกบันทึกทางการ) · สูตรรายงาน · ค่าตั้งห้อง

## A) Impact table

| Change | Affected Function / BR | Risk |
|---|---|---|
| C1 | Notification ทุกเหตุการณ์ที่ส่งถึงผู้เข้าร่วม (BR-mrr-007, 008, 019, 020, 023) · Auto-cancel (FUN-mrr-013 — ส่งผู้จองคนเดียว ไม่เปลี่ยนผล) · Room management (เตือนทันทีตอนเลิกต้องอนุมัติ) · พฤติกรรมเปลี่ยนเฉพาะการจองที่มีผู้เข้าร่วม `active = false` | กลาง — แตะเส้นส่งเมลร่วมกับ DEF-05 (ผู้เข้าร่วมถูกปฏิเสธ = ทั้งก้อนล้ม) จึงต้องยืนยันว่า DEF-05 ยังผ่าน |
| C2 | เทสล้วน | ต่ำ |
| C3 | เอกสาร | ไม่มี |

trace: ผมไม่ได้ไล่ `.aeon/design/trace.design.json` รอบนี้ — ใช้รายการเส้นส่งเมลจากโค้ดโดยตรง (grep `booking_attendees` ใน `apps/api/src`)

## B) Selected suite และผลรัน

**ชุดที่รัน:** Playwright chromium ทั้งชุด 198 เคส (`npx playwright test --project=chromium`) **2 รอบติดกัน** บน stack `mrr` ที่ rebuild (`docker compose up -d --build`) หลัง `f83de74` · ผลรอบที่สองอยู่ใน `test/results.json` (startTime 2026-11-25T04:32:14Z) · รอบแรกใช้ `--reporter=list` จึงไม่ได้เขียน JSON (log อยู่ใน scratchpad ของเซสชัน — อาจถูกล้าง)

| ชุด | Total | Pass | Fail | Skip |
|---|---|---|---|---|
| Playwright chromium [real] | 188 | 187 | 0 | 1 |
| Playwright chromium [stub] | 9 | 9 | 0 | 0 |
| Playwright chromium [fixture] (ฐานรายงาน) | 1 | 1 | 0 | 0 |
| **รวม Playwright (รอบ 1 และรอบ 2 ผลเท่ากัน)** | **198** | **197** | **0** | **1** |
| jest (รันที่ `f83de74`) | 521 | 521 | 0 | 0 |

- ผล [stub] 9 เคสผ่านโดยไม่แตะ API จริง ไม่พิสูจน์พฤติกรรมของ API จริง
- jest ไม่ได้รันซ้ำที่ `d73529c` — ต่างจาก `f83de74` เฉพาะเอกสาร (precedent เดียวกับ T7 ของ DEF-05)

**เคสที่มีเหตุผลเฉพาะต่อ C1 — ผลรอบนี้:**

| TC / ชุด | ผล |
|---|---|
| TC-MYB-UI007-106 (ตัวเคสของ DEF-06) | ผ่าน (ก่อนแก้ล้ม) |
| ชุด ADR-017 ทั้งไฟล์ `t1-adr017.spec.ts` (11 เทสต์) รวม TC-APR-UI011-103 · TC-CAL-UI005-108 (ชื่อที่ปิดบังยังแสดง) | ผ่าน |
| `t1-partial-reject.spec.ts` (DEF-05 · ผู้เข้าร่วมถูก SMTP ปฏิเสธ 5 เคส) · TC-NTF-JOB-110 | ผ่าน |
| เมลปกติ / งานเตือน / ยกเลิกอัตโนมัติ (`t1-jobs`, `t1-round2`, `booking.spec`) | ผ่าน |

## C) Failure และ triage

ไม่มีเคสล้ม · ไม่มี flaky ในสองรอบ

| TC | Result | เหตุผล |
|---|---|---|
| `nfr-005-browsers.spec.ts:91` "[real] อุปกรณ์สัมผัส: ปุ่มยืนยันและ…" | Skip | `test.skip(!hasTouch, 'ตรวจเฉพาะอุปกรณ์สัมผัส')` — chromium desktop ไม่ใช่อุปกรณ์สัมผัส ข้ามโดยตั้งใจ (รันจริงใน project mobile ซึ่งไม่ได้รันรอบนี้) |

## D) ขนาดการรัน เทียบ Full suite

Full chromium 198 เคส ใช้ 259–261 วินาทีต่อรอบ (≈4.3 นาที) · jest 521 เคส (40 suites) · **ไม่ได้รัน:** project เบราว์เซอร์อื่น/มือถือของ NFR-mrr-005 และ vitest ของ `apps/web` (ไม่มี change ฝั่งหน้าเว็บ)

## Open Questions (TBD)

1. ผู้จองที่ถูกปิดบังยังได้รับเมล (อนุมัติ · ปฏิเสธ · ยกเลิกอัตโนมัติ · เตือน) — การแก้ DEF-06 ครอบเฉพาะผู้เข้าร่วมตามคำตอบ Q-ADR017-3 · ต้องให้ design/PO ตัดสิน
2. Q-ADR017-1..4 รอ design/req/PO ([req-design-request-adr017-2026-11-25.md](req-design-request-adr017-2026-11-25.md))
3. PO ยืนยัน Severity ของ DEF-06

## Next Actions

1. ~~QA ตรวจรายงานนี้~~ **QA_Noppasorn review ผ่าน 2026-11-25** (ผู้ใช้แจ้งในเซสชัน)
2. ~~ปิด DEF-06~~ **ปิดแล้ว 2026-11-25** ใน [t4-defects-2026-11-18.md](t4-defects-2026-11-18.md)
3. T5 Quality Gate รอบใหม่ (ถ้าต้องการ) ใช้ผลนี้เป็น input
