# รายงาน T7 — Regression หลังแก้ DEF-08 และเคสหน้าจอ Q-6 (Build `5d3fbcb`, 2026-11-26)

**สถานะ: QA_Noppasorn review ผ่าน 2026-11-26 (ผู้ใช้แจ้งในเซสชัน · บันทึกโดย AI ตามคำแจ้ง · AI ไม่ได้ลงนามแทน) · DEF-08 ปิดแล้ว**

**Run type: Full (Playwright chromium ทั้งชุด) + jest ทั้งชุด** [Recommended] — แตะเส้นอนุมัติคำขอแก้ไข การแปลง error ของ controller และย้ายฟังก์ชันตรวจผู้เข้าร่วมที่เส้นแก้ทุกทางใช้ร่วมกัน · ต่อจาก [t7-regression-def07-2026-11-26.md](t7-regression-def07-2026-11-26.md) · ร่างโดย AI ให้ QA ตรวจ

## Change list (เทียบ `d5ab93d` → `5d3fbcb`)

| # | Change | อยู่ใน |
|---|---|---|
| C1 | `approve()` ตรวจผู้ใช้ที่คำขอเพิ่มและไม่อยู่ในรายชื่อของการจองตอนอนุมัติว่ายัง active (`checkAttendeesForEdit`) — ไม่ active → `BookingInvalid` ทั้งธุรกรรม rollback คำขอยัง PENDING | `apps/api/src/modules/booking/adjustment-request.service.ts` |
| C2 | ย้าย `checkAttendeesForEdit` จาก `booking-edit.service.ts` ไป `booking.service.ts` (export · เนื้อหาเดิม) ให้เส้นแก้และเส้นอนุมัติใช้ตัวเดียวกัน | `booking-edit.service.ts` · `booking.service.ts` |
| C3 | controller ของคำขอแก้ไขแปลง `BookingInvalid` เป็น 400 พร้อม `field` (เดิมหลุดเป็น 500) | `adjustment-request.controller.ts` |
| C4 | unit test 3 เคส · E2E 2 เคส (TC-APR-UI011-104 · TC-MYB-UI008-105) | `apps/api/test/booking/adjustment-decision*.spec.ts` · `test/e2e/t1-inactive-recipients.spec.ts` |

ไม่เปลี่ยน: หน้าเว็บ (`apps/web`) · migration · `docker/` · ข้อความ error · การสร้าง/แก้การจอง (พฤติกรรมเดิม — ย้ายตำแหน่งฟังก์ชันเท่านั้น)
กฎ: BR-mrr-002@v2 · EX-mrr-140 (req `4fc4333`) · AC-mrr-143 (design ADR-019 `8fe0fdb` · เซ็นใหม่แล้ว)

## A) Impact table

| Change | Affected Function / BR | Risk |
|---|---|---|
| C1 | FUN-mrr-007 · UC-mrr-011 (FE-mrr-032 API · FE-mrr-011 หน้าจอ) · BR-mrr-002@v2 | กลาง — ธุรกรรมอนุมัติเดิมอัปเดตหัวข้อ/เวลา/อุปกรณ์ในก้อนเดียวกัน ต้องยืนยันว่า rollback ครบ |
| C2 | เส้นแก้ทั้งสามทางของ DEF-07 (FE-mrr-025/030/031) | ต่ำ — ย้ายโดยไม่แก้เนื้อหา · เคส DEF-07 ทั้งหมดต้องยังผ่าน |
| C3 | API-018 อนุมัติคำขอแก้ไข (คำตอบ HTTP) | ต่ำ |

## B) Selected suite และผลรัน

**ชุดที่รัน:** Playwright chromium ทั้งชุด 225 เคส บน stack ที่ rebuild (`docker compose up -d --build`) หลังแก้ · รอบที่ 13 ผลอยู่ใน `test/results.json` (startTime 2026-11-26T06:56:55Z · expected 224 · skipped 1 · unexpected 0 · flaky 0)

| ชุด | Total | Pass | Fail | Skip |
|---|---|---|---|---|
| Playwright chromium [real] | 215 | 214 | 0 | 1 |
| Playwright chromium [stub] | 9 | 9 | 0 | 0 |
| Playwright chromium [fixture] | 1 | 1 | 0 | 0 |
| **รวม Playwright (รอบที่ 13)** | **225** | **224** | **0** | **1** |
| jest | 555 | 555 | 0 | 0 |

**หลักฐาน red ก่อนแก้ / green หลังแก้:**

| ขั้น | ผล |
|---|---|
| unit AC-mrr-143 ก่อนแก้ service | ล้ม "Received promise resolved instead of rejected" (อนุมัติผ่าน) · เคสคู่ "ผู้เข้าร่วมเดิมที่ไม่ active ไม่บล็อกการอนุมัติ" ผ่านอยู่แล้ว |
| หลังแก้ service | `adjustment-decision.spec.ts` 17/17 |
| E2E TC-APR-UI011-104 ครั้งแรก (หลัง rebuild) | **ล้ม 500** — log api: `BookingInvalid` ไม่มีใครแปลง · unit ระดับ service มองไม่เห็นข้อนี้ |
| HTTP test ใหม่ (`adjustment-decision.http.spec.ts`) ก่อนแก้ controller | ล้ม Expected 400 · Received 500 |
| หลังแก้ controller | HTTP spec 9/9 · jest 555/555 · E2E ไฟล์ `t1-inactive-recipients` 17/17 |
| TC-MYB-UI008-105 (หน้าจอ · Q-6) | ผ่าน · **ไม่ได้แสดง red** (การแก้ DEF-07 อยู่ในโค้ดแล้ว) |

**รอบกลาง (ไม่นับเป็นผล):** ชุดเต็มรอบก่อนรอบที่ 13 ได้ 222 ผ่าน · **2 ล้ม** (TC-APR-UI011-103 · TC-AUD-UI011-101 "ต้องมีคำขอแก้ไขที่รออนุมัติ") — สาเหตุ: TC-APR-UI011-104 รุ่นแรกทิ้งคำขอ PENDING ไว้ทุกครั้ง คำขอรอรวม 24 รายการเกินหน้าแรก (20 ต่อหน้า) คำขอของสองเคสนั้นจึงไปอยู่หน้า 2 · แก้: TC-APR-UI011-104 ปฏิเสธคำขอของตัวเองตอนจบ · ตั้งคำขอค้าง 3 รายการของเคสนี้เป็น REJECTED ใน dev DB · รันใหม่ผ่านครบ

## C) Failure และ triage

รอบที่ 13 ไม่มีเคสล้ม

| TC | Result | เหตุผล |
|---|---|---|
| `nfr-005-browsers.spec.ts:91` | Skip | อุปกรณ์สัมผัส — ข้ามโดยตั้งใจบน desktop |

## D) ขนาดการรัน

Full chromium 225 เคส ใช้ 334 วินาที (≈5.6 นาที) · jest 555 เคส (40 suites) · **ไม่ได้รัน:** vitest ของ `apps/web` และ NFR-005 บนเบราว์เซอร์อื่น (ไม่มี change ฝั่งหน้าเว็บ)

## ไม่ได้ครอบคลุม / ข้อสังเกต

1. **คำขอแก้ไขที่ค้าง PENDING ใน dev DB เพิ่มขึ้นทุกรอบ** — หลังรอบที่ 13 เหลือ 22 รายการ (ไม่ใช่ของเคสใหม่แล้ว) · เคส TC-APR-UI011-103 และ TC-AUD-UI011-101 หาคำขอของตัวเองจากหน้าแรกของ API-017 เท่านั้น จึงจะล้มอีกเมื่อคำขอค้างเกิน 20 · [Recommended] ให้สองเคสนั้นหาคำขอด้วย id/booking หรือทุกเคสที่สร้างคำขอปิดคำขอของตัวเอง — **ยังไม่ได้แก้ ต้องให้ QA ตัดสิน** · **แก้แล้ว 2026-11-26 (Q-8 · ผู้ใช้ตัดสิน "ล้างคำขอค้างก่อนรัน"):** `test/e2e/global-setup.ts` ตั้งคำขอแก้ไข PENDING ของการจอง `E2E%` เป็น REJECTED ก่อนเริ่มทุกรอบ (ผู้ตัดสินเป็น RA ของ E2E ที่ไม่ใช่ผู้ขอ ตาม CHECK ของตาราง · ไม่เขียนร่องรอย · ไม่แตะการจอง) · รอบที่ 14: ก่อนรันค้าง 22 → เริ่มรอบ 0 · 225 เคส 224 ผ่าน 1 ข้าม flaky 0 · หลังรันเหลือ 1 (ที่เคสอื่นสร้างระหว่างรอบ — รอบหน้าถูกล้างตอนเริ่ม)
2. TC-MYB-UI008-105 ตรวจการแก้หัวข้อผ่านหน้าจอเท่านั้น การ "เพิ่มผู้ใช้ที่ไม่ active" ทำผ่านหน้าจอไม่ได้ (ช่องค้นหาแสดงเฉพาะผู้ใช้ active · API-005) จึงตรวจที่ระดับ API (TC-MYB-UI008-103/104)
3. ไม่มีเคสหน้าจอของการอนุมัติคำขอแก้ไข (UI-mrr-011) — TC-APR-UI011-104 ตรวจที่ระดับ API

## Open Questions (TBD)

1. ~~ข้อสังเกต 1~~ ผู้ใช้ตัดสินให้ล้างคำขอค้างก่อนรัน — ทำแล้ว (ดูข้อสังเกต 1)
2. ~~PO ยืนยัน Severity ของ DEF-08~~ **Medium — PO ยืนยัน 2026-11-26 (ผู้ใช้แจ้งในเซสชัน · ยังไม่มีบันทึกคำตัดสินเป็นไฟล์)**

## Next Actions

1. ~~QA ตรวจรายงานนี้ และ T4 DEF-08~~ **QA_Noppasorn review ผ่าน 2026-11-26 (ผู้ใช้แจ้งในเซสชัน · บันทึกโดย AI ตามคำแจ้ง · AI ไม่ได้ลงนามแทน)**
2. ~~ปิด DEF-08~~ **ปิดแล้ว 2026-11-26**
3. ~~`/dev:plan` ผูก AC-mrr-143 กับ FE-mrr-032/011~~ **ทำแล้ว `4abe450`**
