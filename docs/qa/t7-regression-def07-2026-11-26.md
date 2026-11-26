# รายงาน T7 — Regression หลังแก้ DEF-07 (Build `80a4e96`, 2026-11-26)

**สถานะ: QA_Noppasorn review ผ่าน 2026-11-26 (ผู้ใช้แจ้งในเซสชัน) · DEF-07 ปิดแล้ว**

**Run type: Full (Playwright chromium ทั้งชุด) + jest ทั้งชุด** [Recommended] — การแก้แตะการตรวจรายชื่อผู้เข้าร่วมของการแก้ทุกทาง (ผู้จอง · Room Administrator แก้แทน · คำขอแก้ไขหลังจบประชุม) จึงรันทั้งชุดแทนการเลือก · ต่อจาก [t7-regression-def06-2026-11-25.md](t7-regression-def06-2026-11-25.md) · ร่างโดย AI ให้ QA ตรวจ

## Change list (เทียบ `5462b92` → `80a4e96`)

| # | Change | อยู่ใน |
|---|---|---|
| C1 | ตอนแก้การจอง ตรวจว่า active **เฉพาะผู้ใช้ที่ไม่อยู่ในรายชื่อที่บันทึกอยู่ขณะนั้น** (ฟังก์ชันใหม่ `checkAttendeesForEdit`) แทนการตรวจทั้งรายชื่อ · ใช้ทั้ง `apply()` (ผู้จองแก้ · RA แก้แทนระหว่างประชุม) และ `requestAdjustment()` (คำขอแก้ไขหลังจบประชุม) · ตอนสร้างการจองยังตรวจทุกคนเหมือนเดิม | `apps/api/src/modules/booking/booking-edit.service.ts` (commit `80a4e96`) |
| C2 | unit test ใหม่ 8 เคส | `apps/api/test/booking/booking-edit.service.spec.ts` · `booking-admin.spec.ts` · `booking-adjustment.spec.ts` (commit `80a4e96`) |
| C3 | เอา `test.fail()` ออกจาก TC-MYB-UI008-102 และ TC-NTF-UI008-108 | `test/e2e/t1-inactive-recipients.spec.ts` (commit `80a4e96`) |

ไม่เปลี่ยน: หน้าเว็บ (`apps/web` — ฟอร์มแก้ไขยังส่ง `attendeeIds` ทั้งรายชื่อ ซึ่งตอนนี้ api รับได้) · migration · `docker/` · ข้อความ error · การสร้างการจอง · การอนุมัติคำขอแก้ไข
กฎที่ใช้: BR-mrr-002@v2 (CHG-mrr-008 · req `5163d2b` · design/mock รับแล้ว `65623da` `ad5e501` `5462b92`)

## A) Impact table

| Change | Affected Function / BR | Risk |
|---|---|---|
| C1 | FUN-mrr-004 (UC-mrr-004 ผู้จองแก้) · FUN-mrr-006 (UC-mrr-009 RA แก้แทน) · FUN-mrr-007 (UC-mrr-010 คำขอแก้ไข) · BR-mrr-002@v2 · การตรวจว่ามีการเปลี่ยนรายชื่อหรือไม่ (ร่องรอย `detail` ของ RA และ `proposed_changes`) ใช้รายชื่อเดิมที่อ่านจากฟังก์ชันใหม่ | กลาง — เส้นที่ใช้ร่วมกับเมลเปลี่ยนเวลา (BR-mrr-007@v3) และร่องรอย (BR-mrr-017@v3) จึงต้องยืนยันว่าเคสเดิมยังผ่าน |
| C2 | เทสล้วน | ต่ำ |
| C3 | เคส E2E สองเคสกลับมาตรวจจริง (ไม่ผ่านเพราะ "ล้มตามคาด" อีกต่อไป) | ต่ำ |

trace: ใช้รายงานผลกระทบของ `/design:change CHG-mrr-008` (32 รายการ · ผ่าน FUN-mrr-003) และเส้น `governedBy BR-mrr-002@v2` ที่เพิ่มให้ FUN-mrr-004/006/007 · grep `activeAttendees` ใน `apps/api/src` พบ 3 จุด: สร้างการจอง (`booking.service.ts:130` ไม่แตะ) และ 2 จุดในเส้นแก้ (แก้แล้ว)

## B) Selected suite และผลรัน

**ชุดที่รัน:** Playwright chromium ทั้งชุด 220 เคส (`npx playwright test --project=chromium`) **1 รอบ** (รอบที่ 11) บน stack `mrr` ที่ rebuild (`docker compose up -d --build`) หลังแก้ · ผลอยู่ใน `test/results.json` (startTime 2026-11-26T04:29:51Z · expected 219 · skipped 1 · unexpected 0 · flaky 0)

| ชุด | Total | Pass | Fail | Skip |
|---|---|---|---|---|
| Playwright chromium [real] | 210 | 209 | 0 | 1 |
| Playwright chromium [stub] | 9 | 9 | 0 | 0 |
| Playwright chromium [fixture] (ฐานรายงาน) | 1 | 1 | 0 | 0 |
| **รวม Playwright** | **220** | **219** | **0** | **1** |
| jest (รันที่ working tree ก่อน commit `80a4e96` · เนื้อหาเดียวกัน) | 551 | 551 | 0 | 0 |

- **ไม่มีเคสไหนผ่านเพราะ `test.fail()` แล้ว** — รอบที่ 10 มี 2 เคสที่ผ่านเพราะ "ล้มตามคาด" รอบนี้ 219 ผ่านคือระบบทำถูกจริงทั้ง 219
- ผล [stub] 9 เคสไม่พิสูจน์พฤติกรรมของ API จริง
- รันรอบเดียว ไม่ได้รันซ้ำเพื่อดู flaky

**หลักฐาน red ก่อนแก้ / green หลังแก้:**

| ขั้น | ผล |
|---|---|
| unit test ใหม่ 8 เคส ก่อนแก้โค้ด | 4 ล้มด้วย `BookingInvalid: ไม่พบผู้เข้าร่วมบางคนในรายชื่อผู้ใช้` (AC-mrr-139 · AC-mrr-141 · คำขอแก้ไขที่มีผู้ไม่ active ในรายชื่อเดิม · เปลี่ยนเวลาโดยส่งรายชื่อเดิม) · 4 ผ่านอยู่แล้ว (AC-mrr-140 · AC-mrr-142 · RA เพิ่มผู้ไม่ active · คำขอเพิ่มผู้ไม่ active) — เป็นเคสกันไม่ให้การแก้หลวมเกิน |
| หลังแก้ | 3 ไฟล์ spec 81/81 · jest ทั้งชุด 551/551 (40 suites · เดิม 543) |
| E2E หลัง rebuild แต่ยังมี `test.fail()` | TC-MYB-UI008-102 และ TC-NTF-UI008-108 รายงาน "Expected to fail, but passed" ทั้งคู่ |
| เอา `test.fail()` ออก | `t1-inactive-recipients.spec.ts` 12/12 · ชุดเต็ม 219 ผ่าน |

**เคสที่มีเหตุผลเฉพาะต่อ C1 — ผลรอบนี้:**

| TC / ชุด | ผล |
|---|---|
| TC-MYB-UI008-102 (แก้หัวข้อ ส่งรายชื่อเดิม) · TC-NTF-UI008-108 (เปลี่ยนเวลา ส่งรายชื่อเดิม · เมลถึง u1 u2 เท่านั้น) | ผ่าน (ก่อนแก้ล้มด้วย 400) |
| ชุด §B15 ทั้งไฟล์ `t1-inactive-recipients.spec.ts` รวม TC-NTF-UI008-106 · TC-MYB-UI007-107/108 | ผ่าน |
| DEF-05 `t1-partial-reject.spec.ts` รวม TC-NTF-UI008-107 (เอาผู้ถูกปฏิเสธออกจากรายชื่อ) | ผ่าน |
| เส้นแก้/ร่องรอย/คำขอแก้ไข (`t1-round2`, `t1-adr017`, `booking.spec`) | ผ่าน |

## C) Failure และ triage

ไม่มีเคสล้ม · ไม่มี flaky

| TC | Result | เหตุผล |
|---|---|---|
| `nfr-005-browsers.spec.ts:91` "[real] อุปกรณ์สัมผัส: ปุ่มยืนยันและ…" | Skip | `test.skip(!hasTouch, …)` — chromium desktop ไม่ใช่อุปกรณ์สัมผัส ข้ามโดยตั้งใจ |

## D) ขนาดการรัน เทียบ Full suite

Full chromium 220 เคส ใช้ 352 วินาที (≈5.9 นาที) · jest 551 เคส (40 suites) · **ไม่ได้รัน:** project เบราว์เซอร์อื่น/มือถือของ NFR-mrr-005 และ vitest ของ `apps/web` (ไม่มี change ฝั่งหน้าเว็บ)

## ไม่ได้ครอบคลุม (Not covered)

1. **ไม่ได้ทดสอบผ่านฟอร์มแก้ไขบนหน้าจอ** — เคส E2E ทั้งสองตรวจที่ระดับ API (ส่ง `attendeeIds` แบบเดียวกับที่ `EditBookingPage.tsx` ส่ง) เหมือนที่ T4 ระบุไว้ตั้งแต่ต้น
2. **EX-mrr-137 · 138 · 139 (AC-mrr-140 · 141 · 142) มีแค่ unit test** ยังไม่มีเคส E2E และยังไม่ได้ลงใน `e2e-ex-map.json` / T2 · AC-mrr-139 ตรงกับ TC-MYB-UI008-102 แต่เคสนั้นยังไม่ตรวจว่าผู้เข้าร่วมที่ไม่ active ยังอยู่ในรายชื่อหลังบันทึก (unit test ตรวจแล้ว)
3. **การอนุมัติคำขอแก้ไข (UC-mrr-011)** — ตรวจจากโค้ดเท่านั้น: `adjustment-request.service.ts` บรรทัด 131–134 ใส่ `attendeeIds` ที่ขอไว้ลงตรง ๆ โดยไม่ตรวจ active จึงไม่โดน DEF-07 · ข้อสังเกต (ไม่ได้ตัดสิน): ถ้าผู้ใช้ที่ "เพิ่มใหม่" ในคำขอถูกตั้งไม่ active ระหว่างรออนุมัติ การอนุมัติจะใส่คนนั้นลงได้
4. **dev gate:** `verify-features.mjs --cp4` ยังไม่ผ่าน — DV4 72 ข้อ (หน่วยงานของ dev ตกรุ่นเพราะไฟล์ design เปลี่ยนจาก CHG-mrr-008) และ DV6 (AC-mrr-139..142 ยังไม่มีหน่วยงานไหนอ้าง) · ต้องให้ `/dev:plan` ตัดหน่วยใหม่ตามแบบ `8cc997a`

## Open Questions (TBD)

1. ต้องการเคส E2E ของ EX-mrr-137/138/139 หรือยอมรับ unit test · และต้องเพิ่ม assert รายชื่อใน TC-MYB-UI008-102 หรือไม่ (เคสนั้น review แล้ว แก้แล้วต้อง review ใหม่)
2. ข้อสังเกตเรื่องการอนุมัติคำขอแก้ไข (ข้อ 3 ข้างบน) เป็นเรื่องที่ต้องเปิดใหม่หรือไม่ — ผู้ตอบ PO/BA

## Next Actions

1. ~~QA ตรวจรายงานนี้~~ **QA_Noppasorn review T7 ผ่าน 2026-11-26 (ผู้ใช้แจ้งในเซสชัน · บันทึกโดย AI ตามคำแจ้ง)**
2. ~~ปิด DEF-07~~ **ปิดแล้ว 2026-11-26** ใน [t4-defects-2026-11-18.md](t4-defects-2026-11-18.md) และ [t4-def-07-2026-11-25.md](t4-def-07-2026-11-25.md)
3. `/dev:plan` ตัดหน่วยใหม่ให้ dev gate ตรงกับ design หลัง CHG-mrr-008
