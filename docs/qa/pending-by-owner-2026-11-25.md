# งานที่รอแต่ละฝ่าย (อัปเดต 2026-11-26 บ่าย · HEAD `4abe450` · ฉบับแรก 2026-11-25 ที่ `61255fe`)

ร่างโดย AI จากผลรันด่านและเอกสารใน `docs/qa/` · **ไม่มีข้อไหนที่ AI ปิดเองได้** ทุกข้อต้องให้คนตัดสิน บันทึกทางการ หรือเซ็น
แหล่งหลัก: [t5-quality-gate-2026-11-25.md](t5-quality-gate-2026-11-25.md) §E, §F, Next Actions · [t7-regression-def07-2026-11-26.md](t7-regression-def07-2026-11-26.md) · [req-design-request-adr017-2026-11-25.md](req-design-request-adr017-2026-11-25.md) · [t5-critical-assertion-sample-2026-11-25.md](t5-critical-assertion-sample-2026-11-25.md)

## สถานะด่าน (รันซ้ำ 2026-11-26 · read-only)

| เฟส | ผล |
|---|---|
| req | `verify-rules --cp1` PASS · `--cp2` PASS · BR 28/28 มี EX · red card 0 · CP1 เซ็นแล้ว (Noppasorn 2026-11-18) · ล่าสุด CHG-mrr-008 → BR-mrr-002@v2 · EX-mrr-136..140 |
| design | `status` 9/9 · `check` PASS 40/41 · `--cp3` clear · `approve --ready` 9/9 · ADR-019 absorbed · 6 ไฟล์เซ็นใหม่ (Noppasorn 2026-11-26 บ่าย) · ทุกไฟล์เป็น schema ปัจจุบัน · ข้อสังเกต: S18 มีการ์ดตัดสินใจ 1 ใบที่ยังไม่มีคนเลือก (DEC-005) |
| mock | `status` 6/6 · `check` PASS 32/32 · prompt 15 ใบสถานะ WAITING (เป็นสถานะ ไม่ใช่ finding) |
| dev | `verify-features` PASS · `--cp4` clear ครบห้าข้อ · re-cut หลัง ADR-019 (`4abe450`) — หน่วยงานไม่ได้ผ่าน `/dev:build` สำหรับโค้ดที่แก้ตรง (DEF-06/07/08 · F5) ตามที่ผู้ใช้เลือก |
| qa | jest 555/555 · Playwright chromium รอบที่ 13: 225 เคส · 224 ผ่าน · 1 ข้าม · flaky 0 · defect 8 ตัว แก้ครบ · **เปิด 1 (DEF-08 รอ QA review ก่อนปิด)** |

ทุกด่านเขียวแล้ว แต่ด่านที่เขียวไม่ได้แปลว่ามีคนอนุมัติ งานที่เหลือด้านล่างเป็นเรื่องที่ต้องให้คนตัดสินหรือบันทึกทั้งหมด

## ปิดแล้วตั้งแต่ฉบับแรก (2026-11-25 → 2026-11-26)

| เรื่อง | ปิดอย่างไร |
|---|---|
| DEF-07 ผู้จองบันทึกการแก้ไขไม่ได้เมื่อมีผู้เข้าร่วมที่ไม่ active | PO ยืนยัน Severity Medium · กฎ BR-mrr-002@v2 (CHG-mrr-008) · design/mock รับและเซ็นใหม่ · แก้ `80a4e96` · T7 QA_Noppasorn review ผ่าน · ปิด 2026-11-26 ([t4-def-07](t4-def-07-2026-11-25.md)) |
| เคส E2E ของ BR-mrr-002@v2 (TC-MYB-UI008-102 assert เพิ่ม · 103 · 104 · TC-APR-UI010-111) | QA_Noppasorn review ผ่าน 2026-11-26 ([t1-test-cases.md §B15.3](t1-test-cases.md)) |
| TC ID ซ้ำ TC-NTF-UI008-107 | เคส DEF-07 เปลี่ยนเป็น TC-NTF-UI008-108 (ผู้ใช้เลือก) |
| dev gate ตกรุ่นหลัง CHG-mrr-007 (AC-mrr-135..138 ไม่มีหน่วยอ้าง) | `/dev:plan` re-cut `c3f24bc` |
| PO-10 การอนุมัติคำขอแก้ไขไม่ตรวจ active (ผู้ใช้ตัดสิน: ต้องตรวจ · ไม่อนุมัติ คำขอยังรอ) | EX-mrr-140 · ADR-019 · AC-mrr-143 · แก้ `5d3fbcb` เป็น DEF-08 (ยังไม่ปิด — รอ QA review ดู Q-7) |
| D-6 อ้างกฎรุ่นล่าสุด | ADR-019: แก้ 11 จุดใน screens/datamodel/functions/interfaces (แถว ruleEnforcement ของรุ่นเก่าเก็บเป็นประวัติ) |
| D-7 schema รุ่นใหม่ | ADR-019: functions 1.3 · rbac 1.1 (ไม่มี anonymous) · sitemap 1.2 (แอปเดียว) · datamodel 1.1 + key 10 เอนทิตี (ป้ายรุ่น datamodel เปลี่ยนด้วยมือ — plugin ไม่มี migrate · design-plugin-manual-steps.md ข้อ 4) |
| Q-6 ทดสอบผ่านหน้าจอ | TC-MYB-UI008-105 เปิดฟอร์มแก้ไข UI-mrr-008 จริง (ยังไม่ผ่าน QA review ดู Q-7) |

## PO

| # | เรื่อง | ที่มา |
|---|---|---|
| PO-1 | ตัดสินว่ารับ **Conditional Go** ตามเงื่อนไข 1–6 ใน T5 §E หรือไม่ | T5 §E · Next Actions 3 |
| PO-2 | ยืนยันตัวเลข Gate G0–G3 และ Severity ของ DEF-01–05 (ตอนนี้ยังเป็น [Recommended]) | T5 F6 |
| PO-3 | G3 ข้อ (1) "รันครบ 100%": ยกเว้นเคสที่ข้ามโดยออกแบบ (NFR-005 อุปกรณ์สัมผัสบนเดสก์ท็อป) หรือไม่ | T5 F7 · เงื่อนไข 1 |
| PO-4 | NFR-002: ยอมรับผลบน Docker dev หรือกำหนดวัน staging · NFR-004: พิสูจน์อย่างไรก่อนขึ้นระบบ | T5 F8 · เงื่อนไข 5 |
| PO-5 | เคส HTTPS ต้องรวม Secure cookie และ HSTS หรือไม่ | T5 F9 |
| PO-6 | ผู้ตัดสิน Q1–Q3 ของ DEF-05 เป็น PO ตามบทบาทหรือไม่ | T5 F11 |
| PO-7 | DEC-005 ผู้ให้บริการส่งเมล (SMTP องค์กร / บริการภายนอก) ยังเป็น `chosen: null` หรือจะยอมรับว่า E2E ใช้ mailpit เท่านั้น (ร่วมกับ IT องค์กร) | T5 F12 · เงื่อนไข 4 · design S18 |
| PO-8 | OQ-NFR ข้อ 4: NFR-001/003/004 รอบนี้ต้องมีเคส หรือพิสูจน์ด้วยวิธีอื่น | oq-nfr-questions-2026-11-18.md |
| PO-9 | บันทึกคำตัดสิน Severity ของ DEF-06 (Medium) เป็นไฟล์ ตอนนี้มีแค่คำแจ้งในเซสชัน (ของ DEF-07 บันทึกไฟล์แล้วใน [req-request-def07-2026-11-26.md](req-request-def07-2026-11-26.md)) | T5 §D |
| PO-11 | **ใหม่** · ยืนยัน Severity ของ DEF-08 (Medium [Recommended]) | [t4-def-08-2026-11-26.md](t4-def-08-2026-11-26.md) |

## design

| # | เรื่อง | ที่มา |
|---|---|---|
| D-1 | บันทึกคำตอบ Q-ADR017-1 (วันที่เริ่มไม่ active บันทึกนอกระบบ) ให้เป็นทางการ | T5 F1 |
| D-2 | บันทึก Q-ADR017-2 (`masked-<uuid>@mrr.invalid`) ลงคู่มือผู้ดูแล | T5 F2 |
| D-5 | รับรู้ข้อค้นพบว่า "อนุมัติคำขอแก้ไขไม่ส่งอีเมลเลย" (UC-mrr-011) ถ้าตั้งใจให้ส่ง ต้องเปิดเป็นเรื่องใหม่ | req-design-request-adr017 |

(D-3 · D-4 ปิดแล้ว 2026-11-25 — CHG-mrr-007 · D-6 · D-7 ปิดแล้ว 2026-11-26 — ADR-019)

## req

| # | เรื่อง | ที่มา |
|---|---|---|
| R-2 | เพิ่ม EX / ปรับ BR-mrr-019 ตามคำตัดสิน DEF-05 (ตรวจแล้ว EX-129–131 เป็นของ CHG-mrr-006 ไม่ใช่ DEF-05) | T5 F6(เดิม) · F10 |
| R-3 | ตัดสินว่า Q-ADR017-3/4 นับเป็น red card ของ REQ ใดหรือไม่ (G0 ยังตัดสินไม่ได้ว่ากฎครบสำหรับ ADR-017) | T5 G0 |
| R-4 | NFR-004 `verified_by`: ตัดสินว่าทางที่ใช้ `/req:capture` เป็นทางที่ req ตั้งใจหรือไม่ · NFR-001/003/005 ยังว่าง · ต้องเซ็น Phase 1 ใหม่หรือไม่ (CP1 เซ็นเมื่อ 2026-11-18 ก่อน CHG-mrr-007/008) | req-request-nfr004-verified-by-and-resign-2026-11-23.md |

(R-1 ปิดแล้ว 2026-11-25 — CHG-mrr-007)

## QA

| # | เรื่อง | ที่มา |
|---|---|---|
| Q-1 | review การแก้ TC-MYB-UI007-103 (ตรวจ "เฉพาะ" ของผู้จองโดยเทียบกับฐานข้อมูล · `61255fe`) — ยังไม่มีบันทึกว่า review | t5-critical-assertion-sample §ท้ายไฟล์ |
| Q-2 | ตัดสินข้อสังเกต 2 (TC-AUTH-UI002-102 ไม่ตรวจหน้าจอ: เพิ่มเคสหน้าจอ หรือยอมรับว่าครอบด้วย API) | ตารางข้อสังเกต 13 เคส ข้อ 2 |
| Q-3 | ตัดสินข้อสังเกต 4 (Scenario ของ TC-AUTH-UI002-101 เขียน "10:09:59" ไม่ตรงกับสิ่งที่เคสทำ: แก้ข้อความ หรือยอมรับ) | ข้อ 4 |
| Q-4 | ตัดสินข้อสังเกต 5 (TC-AUTH-UI001-101/109 ตรวจข้อความแบบหลวม: ยอมรับ หรือแก้) | ข้อ 5 |
| Q-5 | ข้อสังเกตที่ยังเปิดของเคส F5 (ข้อ 2, 3, 5–8 — ยอมรับหรือรอ design/req) | t1-test-cases.md §B12.1–B12.2 |
| Q-7 | **ใหม่** · review T4/T7 ของ DEF-08 และเคส §B15.4 (TC-APR-UI011-104 · TC-MYB-UI008-105) แล้วปิด DEF-08 | [t7-regression-def08-2026-11-26.md](t7-regression-def08-2026-11-26.md) · t1-test-cases.md §B15.4 |
| Q-8 | **ใหม่** · คำขอแก้ไขค้าง PENDING ใน dev DB สะสมทุกรอบ (22 หลังรอบที่ 13) · TC-APR-UI011-103 และ TC-AUD-UI011-101 หาคำขอจากหน้าแรกของ API-017 (20 ต่อหน้า) จึงจะล้มเมื่อเกิน 20 — แก้เคส หรือกำหนดให้ล้างก่อนรัน | T7 DEF-08 ข้อสังเกต 1 |

## งานก่อนปล่อยจริง (ทำได้เมื่อมี build ปลายทาง)

- รัน jest/vitest และ NFR-005 บนเบราว์เซอร์อื่นซ้ำบน **build ปลายทาง** (บนรีโปนี้รันแล้ว: jest 555/555 (2026-11-26 บ่าย) · vitest 333/333 · NFR-005 32 ผ่าน 3 ข้าม) · vitest และ NFR-005 ยังไม่ได้รันซ้ำหลัง `80a4e96` / `5d3fbcb` (ไม่มี change ฝั่งหน้าเว็บ)
- ล้างการจอง `E2E%` ใน dev DB ซ้ำหลังรัน E2E ครั้งใหม่ (การล้างครั้งล่าสุด `54a7f03` · รอบที่ 8–13 รันหลังจากนั้น) · ปิดคำขอแก้ไขที่ค้าง PENDING ด้วย (Q-8)

## เอกสารเก่าที่หัวเอกสารยังเขียนว่า "รอ" (ต้องให้เจ้าของยืนยันว่ายังเปิดอยู่จริง)

หัวเอกสารเหล่านี้ไม่ได้อัปเดตหลังวันที่เขียน และ T5 รอบนี้ไม่ได้ยกขึ้นมาเป็นข้อที่ยังเปิด จึง **อาจล้าสมัยแล้ว** AI ไม่ได้ตรวจทีละข้อ

- [req-questions-search-delete-logout.md](req-questions-search-delete-logout.md) (2026-11-17)
- [req-notice-room-photos-out-of-scope.md](req-notice-room-photos-out-of-scope.md) (ADR-007 ลดขอบเขตรูปภาพห้อง · รอ req ตอบ 2 ข้อ)
- [req-request-ex-validation-delete-2026-11-18.md](req-request-ex-validation-delete-2026-11-18.md) · [req-request-ex-partial-reject-2026-11-20.md](req-request-ex-partial-reject-2026-11-20.md) (ร่างสำหรับส่ง)
- [req-question-ex-wording-reject-edit-2026-11-18.md](req-question-ex-wording-reject-edit-2026-11-18.md) (EX ของ Email ตอนเปลี่ยนผลเป็นปฏิเสธ)
- [finding-partial-recipient-reject-2026-11-18.md](finding-partial-recipient-reject-2026-11-18.md) (น่าจะกลายเป็น DEF-05 แล้ว)
