# งานที่รอแต่ละฝ่าย (อัปเดต 2026-11-26 เย็น · HEAD `e195e01` · PO-1–9 ปิดทั้งหมด · D ปิดทั้งหมด · R-5 ใหม่ · ฉบับแรก 2026-11-25 ที่ `61255fe`)

ร่างโดย AI จากผลรันด่านและเอกสารใน `docs/qa/` · **ไม่มีข้อไหนที่ AI ปิดเองได้** ทุกข้อต้องให้คนตัดสิน บันทึกทางการ หรือเซ็น
แหล่งหลัก: [t5-quality-gate-2026-11-25.md](t5-quality-gate-2026-11-25.md) §E, §F, Next Actions · [t7-regression-def07-2026-11-26.md](t7-regression-def07-2026-11-26.md) · [t7-regression-def08-2026-11-26.md](t7-regression-def08-2026-11-26.md) · [req-design-request-adr017-2026-11-25.md](req-design-request-adr017-2026-11-25.md) · [t5-critical-assertion-sample-2026-11-25.md](t5-critical-assertion-sample-2026-11-25.md)

## สถานะด่าน (รันซ้ำ 2026-11-26 เย็นที่ `8c97244` · read-only)

| เฟส | ผล |
|---|---|
| req | `verify-rules --cp1` PASS · `--cp2` PASS · BR 28/28 มี EX · red card 0 · CP1 เซ็นแล้ว (Noppasorn 2026-11-18) · ล่าสุด CHG-mrr-008 → BR-mrr-002@v2 · EX-mrr-136..140 |
| design | `status` 9/9 · `check` PASS 40/41 · `--cp3` clear · `approve --ready` 9/9 · ADR-019 absorbed · 6 ไฟล์เซ็นใหม่ (Noppasorn 2026-11-26 บ่าย) · ทุกไฟล์เป็น schema ปัจจุบัน · ข้อสังเกต: S18 มีการ์ดตัดสินใจ 1 ใบที่ยังไม่มีคนเลือก (DEC-005) |
| mock | `status` 6/6 · `check` PASS 32/32 · prompt 15 ใบสถานะ WAITING (เป็นสถานะ ไม่ใช่ finding) |
| dev | `verify-features` PASS · `--cp4` clear ครบห้าข้อ · re-cut หลัง ADR-019 (`4abe450`) — หน่วยงานไม่ได้ผ่าน `/dev:build` สำหรับโค้ดที่แก้ตรง (DEF-06/07/08 · F5) ตามที่ผู้ใช้เลือก |
| qa | jest 555/555 · Playwright chromium รอบที่ 14: 225 เคส · 224 ผ่าน · 1 ข้าม · flaky 0 · defect 8 ตัว แก้ครบ · เปิด 0 (DEF-08 ปิด 2026-11-26) |

ทุกด่านเขียวแล้ว แต่ด่านที่เขียวไม่ได้แปลว่ามีคนอนุมัติ งานที่เหลือด้านล่างเป็นเรื่องที่ต้องให้คนตัดสินหรือบันทึกทั้งหมด

## ปิดแล้วตั้งแต่ฉบับแรก (2026-11-25 → 2026-11-26)

| เรื่อง | ปิดอย่างไร |
|---|---|
| DEF-07 ผู้จองบันทึกการแก้ไขไม่ได้เมื่อมีผู้เข้าร่วมที่ไม่ active | PO ยืนยัน Severity Medium · กฎ BR-mrr-002@v2 (CHG-mrr-008) · design/mock รับและเซ็นใหม่ · แก้ `80a4e96` · T7 QA_Noppasorn review ผ่าน · ปิด 2026-11-26 ([t4-def-07](t4-def-07-2026-11-25.md)) |
| เคส E2E ของ BR-mrr-002@v2 (TC-MYB-UI008-102 assert เพิ่ม · 103 · 104 · TC-APR-UI010-111) | QA_Noppasorn review ผ่าน 2026-11-26 ([t1-test-cases.md §B15.3](t1-test-cases.md)) |
| TC ID ซ้ำ TC-NTF-UI008-107 | เคส DEF-07 เปลี่ยนเป็น TC-NTF-UI008-108 (ผู้ใช้เลือก) |
| dev gate ตกรุ่นหลัง CHG-mrr-007 (AC-mrr-135..138 ไม่มีหน่วยอ้าง) | `/dev:plan` re-cut `c3f24bc` |
| PO-10 การอนุมัติคำขอแก้ไขไม่ตรวจ active (ผู้ใช้ตัดสิน: ต้องตรวจ · ไม่อนุมัติ คำขอยังรอ) | EX-mrr-140 · ADR-019 · AC-mrr-143 · แก้ `5d3fbcb` เป็น DEF-08 · ปิด 2026-11-26 (QA_Noppasorn review T4/T7 · PO ยืนยัน Medium ตามที่ผู้ใช้แจ้ง) |
| D-6 อ้างกฎรุ่นล่าสุด | ADR-019: แก้ 11 จุดใน screens/datamodel/functions/interfaces (แถว ruleEnforcement ของรุ่นเก่าเก็บเป็นประวัติ) |
| D-7 schema รุ่นใหม่ | ADR-019: functions 1.3 · rbac 1.1 (ไม่มี anonymous) · sitemap 1.2 (แอปเดียว) · datamodel 1.1 + key 10 เอนทิตี (ป้ายรุ่น datamodel เปลี่ยนด้วยมือ — plugin ไม่มี migrate · design-plugin-manual-steps.md ข้อ 4) |
| Q-6 ทดสอบผ่านหน้าจอ | TC-MYB-UI008-105 เปิดฟอร์มแก้ไข UI-mrr-008 จริง (QA_Noppasorn review แล้ว 2026-11-26) |
| Q-8 คำขอแก้ไขค้างดันเคสอื่นตกหน้าแรก | ผู้ใช้ตัดสินให้ล้างก่อนรัน — `global-setup.ts` ปิดคำขอ PENDING ของการจอง E2E ทุกรอบ · รอบที่ 14 ผ่านครบ |
| PO-1 Conditional Go | **PO รับ Conditional Go** (ตามที่ผู้ใช้แจ้ง 2026-11-26) · เงื่อนไข 1–5 ครบ · **เงื่อนไข 6 (รันซ้ำบน build ปลายทาง) ยังเปิด** — ดู "งานก่อนปล่อยจริง" · บันทึกใน [po-decision-conditional-go-2026-11-26.md](po-decision-conditional-go-2026-11-26.md) |
| PO-3 G3 ข้อ (1) | PO ยกเว้นให้เคสที่ข้ามโดยออกแบบ (NFR-005 อุปกรณ์สัมผัสบนเดสก์ท็อป) |
| PO-4 NFR-002/004 | PO ยอมรับผล NFR-002 บน Docker dev (ไม่กำหนดวัน staging) · NFR-004 วัดหลังขึ้นระบบจริง |
| PO-7 DEC-005 | PO ยอมรับว่า E2E ใช้ mailpit อย่างเดียว · ยังไม่ได้เลือกผู้ให้บริการจริง (`chosen: null` ใน design คงเดิม) |
| PO-2 Gate / Severity | PO ยืนยันตัวเลข Gate ใน qa-playbook §3.4 และนิยาม Severity ใน §3.3 ตามที่เสนอ · DEF-01 High · 02 High · 03 Medium · 04 Medium · 05 High (ตามที่ผู้ใช้แจ้ง 2026-11-26) · [po-decision-gate-severity-2026-11-26.md](po-decision-gate-severity-2026-11-26.md) |
| PO-5 Secure cookie / HSTS | PO ตัดสินว่าไม่รวมในเคส HTTPS ให้ตรวจบน build ปลายทางตอน deploy (ตามที่ผู้ใช้แจ้ง 2026-11-26) — ดู "งานก่อนปล่อยจริง" · [po-decision-https-cookie-hsts-2026-11-26.md](po-decision-https-cookie-hsts-2026-11-26.md) |
| PO-6 ผู้ตัดสิน DEF-05 | ผู้ใช้แจ้งว่าผู้ตัดสิน Q1–Q3 เมื่อ 2026-11-20 คือ PO ตามบทบาท · PO ยืนยันคำตอบเดิม (2026-11-26) · ลง Sign-off ใน [po-decision-def-05-scope-2026-11-20.md](po-decision-def-05-scope-2026-11-20.md) · R-2 (req เพิ่ม EX และปรับ BR-mrr-019) ยังเปิด |
| PO-8 OQ-NFR ข้อ 4 | PO ยืนยันคำตอบของวันที่ 2026-11-23 (ตามที่ผู้ใช้แจ้ง 2026-11-26): NFR-001 และ NFR-003 พิสูจน์ด้วยเคสที่มีอยู่ (TC-NFR-REQ001-101 · 103 · เคส RBAC เดิม) · NFR-004 วิเคราะห์ log หลังขึ้นระบบ · บันทึกใน [oq-nfr-questions-2026-11-18.md](oq-nfr-questions-2026-11-18.md) · R-4 (`verified_by` ใน spec) ยังเปิด |
| PO-9 Severity DEF-06/08 | บันทึกคำตัดสิน Medium ทั้งคู่เป็นไฟล์ (PO ตามที่ผู้ใช้แจ้ง 2026-11-25 และ 2026-11-26) · [po-decision-severity-def06-def08-2026-11-26.md](po-decision-severity-def06-def08-2026-11-26.md) · Severity ของ defect ทั้ง 8 ตัวมีบันทึกเป็นไฟล์ครบแล้ว |
| D-1 Q-ADR017-1 (วันที่เริ่มไม่ active บันทึกนอกระบบ) | design บันทึกเป็นทางการ 2026-11-26: ADR-020 (design · added · absorbed) · `context.json` scope.outOfScope `inactive-since-date-tracking` · เซ็นใหม่ Noppasorn 2026-11-26 (`approve --ready` 9/9 · `check` PASS) · `design-document.md` export ใหม่ · `/mock:sync` ไม่มีอะไรต้องบันทึก · `/mock:check` PASS 32/32 — ผลต่อ mock ตรวจด้วยมือ: ไม่กระทบ wireframe/mockup · `mrr-theme-brief.md` ขาดบรรทัด out of scope ข้อใหม่ (ไม่มีผลต่อ theme · สร้างใหม่ได้ด้วย `/mock:theme --prompt` ถ้าต้องการ) |
| D-2 Q-ADR017-2 รูปแบบ email ที่ปิดบัง | ผู้ใช้เลือกให้สร้างคู่มือผู้ดูแลใหม่ (2026-11-26): [docs/admin-manual.md](../admin-manual.md) §1 — จดวันเริ่มไม่ active นอกระบบ · ครบ 1 ปีเขียนทับ `full_name` = "ผู้ใช้ที่ถูกปิดบังชื่อ" และ `email` = `masked-<uuid>@mrr.invalid` · ห้ามลบแถว · ไม่แตะไฟล์ design ที่เซ็นแล้ว |
| R-3 Q-ADR017-3/4 เป็น red card หรือไม่ | ผู้ใช้ตัดสิน 2026-11-26: **ไม่นับ** — ตอบแล้วและบันทึกเป็น BR-mrr-007@v3 (CHG-mrr-007) · `/req:check` red card 0 · CP1 PASS · CP2 PASS · T5 G0 เปลี่ยนเป็น Pass |
| R-2 EX ของ DEF-05 | ผู้ใช้เลือกเพิ่ม EX โดยไม่แก้ข้อความกฎ (2026-11-26): EX-mrr-141..144 พิสูจน์ BR-mrr-019@v1 (ผู้รับบางคนถูก mail server ปฏิเสธ → ยกเลิก · RA ยกเลิกแทน · ปฏิเสธ · เปลี่ยนเวลา ล้มทั้งการกระทำ) · ที่มา SRC-045 · CP1/CP2 PASS |
| R-5 BR-mrr-007 กับคำขอแก้ไข | ผู้ใช้เลือก (ข) (2026-11-26): EX-mrr-145 พิสูจน์ BR-mrr-007@v3 — อนุมัติคำขอแก้ไขหลังจบประชุมที่เปลี่ยนเวลา ไม่ส่ง Email · ไม่ขึ้นรุ่นกฎ · ที่มา SRC-045 |
| R-4 `verified_by` | NFR-mrr-001 · 003 · 005 = `e2e_test` (ผู้ใช้เลือก 2026-11-26 · SRC-045) · ส่วนลายเซ็น CP1 ยังค้าง (ดูส่วน req) |
| D-5 อนุมัติคำขอแก้ไขไม่ส่ง Email | ผู้ใช้ตัดสิน 2026-11-26: **ไม่ส่ง ตั้งใจแบบนี้** (แก้บันทึกหลังประชุมจบ) · ไม่มีงาน dev · ตัวอักษรของ BR-mrr-007@v3 (3) ยังไม่ตรง → ส่ง req เป็น R-5 ([req-request-adjustment-no-email](req-request-adjustment-no-email-2026-11-26.md)) |

## PO

ไม่มีข้อค้าง — PO-1 ถึง PO-9 ปิดแล้วเมื่อ 2026-11-26 (ดูตาราง "ปิดแล้ว" ด้านบน)

## design

ไม่มีข้อค้าง — D-1 ถึง D-7 ปิดแล้ว (D-3 · D-4 ปิด 2026-11-25 — CHG-mrr-007 · D-6 · D-7 ปิด 2026-11-26 — ADR-019 · D-1 ปิด 2026-11-26 — ADR-020 · D-2 · D-5 ปิด 2026-11-26 — คู่มือผู้ดูแล / R-5)

## req

| # | เรื่อง | ที่มา |
|---|---|---|
| R-4 (ส่วนที่เหลือ) | **รอเจ้าของเซ็น CP1 ใหม่** ด้วย `/req:approve --by <ชื่อ>` (ผู้ใช้เลือกเซ็นใหม่ 2026-11-26 · ลายเซ็นเดิม 2026-11-18 ถูกปลดด้วย `--because CHG-mrr-008` — ลายเซ็นเดิมมาก่อน CHG-mrr-004/007/008 และการแก้ NFR) · คำถามว่า `/req:capture` เป็นทางที่ req ตั้งใจให้ใช้แก้ `verified_by` หรือไม่ ยังไม่มีคำตอบจาก plugin (ไม่มีคำสั่งเฉพาะ) | req-request-nfr004-verified-by-and-resign-2026-11-23.md |

(R-1 ปิดแล้ว 2026-11-25 — CHG-mrr-007 · R-3 ปิด 2026-11-26 · R-2 · R-5 และส่วน `verified_by` ของ R-4 ทำแล้ว 2026-11-26 — ดูตาราง "ปิดแล้ว")

### งานที่ตามมาจาก EX-mrr-141..145 (ยังไม่ได้ทำ · รอผู้ใช้สั่ง)

| ฝ่าย | งาน |
|---|---|
| design | ADR-021 (design · added · moved = EX-mrr-141..145) → ปลดลายเซ็น `modules/mrr/functions.json` → `/design:function` เพิ่ม AC ให้ EX ทั้งห้า → เซ็นใหม่ · ตอนนี้ `check` = 0 error · 5 warning (S16) · `approve --ready` ยัง 9/9 |
| mock | `/mock:sync` **ก่อน** design absorb ADR-021 |
| dev | `/dev:plan` re-cut ให้ AC ใหม่มีหน่วยอ้าง · ไม่มีงานโค้ด (โค้ดทำตาม EX ทั้งห้าอยู่แล้ว) |
| QA | ผูกเคส `t1-partial-reject.spec.ts` 4 เคสกับ EX-141..144 · **เพิ่มเคสใหม่ให้ EX-145** (TC-APR-UI011-103 เปลี่ยนแค่หัวข้อ ไม่ได้เปลี่ยนเวลา) · เพิ่มแถวใน `t1-test-cases.csv` · รัน T2 ใหม่ (EX ที่ E2E คลุมจะเป็น 140/145 จนกว่าจะทำ) |

## QA

| # | เรื่อง | ที่มา |
|---|---|---|
| Q-1 | review การแก้ TC-MYB-UI007-103 (ตรวจ "เฉพาะ" ของผู้จองโดยเทียบกับฐานข้อมูล · `61255fe`) — ยังไม่มีบันทึกว่า review | t5-critical-assertion-sample §ท้ายไฟล์ |
| Q-2 | ตัดสินข้อสังเกต 2 (TC-AUTH-UI002-102 ไม่ตรวจหน้าจอ: เพิ่มเคสหน้าจอ หรือยอมรับว่าครอบด้วย API) | ตารางข้อสังเกต 13 เคส ข้อ 2 |
| Q-3 | ตัดสินข้อสังเกต 4 (Scenario ของ TC-AUTH-UI002-101 เขียน "10:09:59" ไม่ตรงกับสิ่งที่เคสทำ: แก้ข้อความ หรือยอมรับ) | ข้อ 4 |
| Q-4 | ตัดสินข้อสังเกต 5 (TC-AUTH-UI001-101/109 ตรวจข้อความแบบหลวม: ยอมรับ หรือแก้) | ข้อ 5 |
| Q-5 | ข้อสังเกตที่ยังเปิดของเคส F5 (ข้อ 2, 3, 5–8 — ยอมรับหรือรอ design/req) | t1-test-cases.md §B12.1–B12.2 |

## งานก่อนปล่อยจริง (ทำได้เมื่อมี build ปลายทาง · = เงื่อนไข 6 ของ Conditional Go ที่ PO รับแล้ว)

- (PO-5) บน build ปลายทางที่เป็น HTTPS: ตั้ง `COOKIE_SECURE=true` แล้วตรวจว่า cookie `mrr_session` มี flag `Secure` · ตรวจ header `Strict-Transport-Security` (ยังไม่ได้กำหนดว่าใครตั้งและใช้ค่าอะไร)
- รัน jest/vitest และ NFR-005 บนเบราว์เซอร์อื่นซ้ำบน **build ปลายทาง** (บนรีโปนี้รันแล้ว: jest 555/555 (2026-11-26 บ่าย) · vitest 333/333 · NFR-005 32 ผ่าน 3 ข้าม) · vitest และ NFR-005 ยังไม่ได้รันซ้ำหลัง `80a4e96` / `5d3fbcb` (ไม่มี change ฝั่งหน้าเว็บ)
- ล้างการจอง `E2E%` ใน dev DB ซ้ำหลังรัน E2E ครั้งใหม่ (การล้างครั้งล่าสุด `54a7f03` · รอบที่ 8–14 รันหลังจากนั้น — การจองค้างอนาคตถูกยกเลิกอัตโนมัติตอนเริ่มรอบอยู่แล้ว แต่แถวเก่ายังสะสม) · คำขอแก้ไขที่ค้าง PENDING ถูกปิดอัตโนมัติตอนเริ่มรอบ E2E แล้ว (Q-8)

## เอกสารเก่าที่หัวเอกสารยังเขียนว่า "รอ" (ต้องให้เจ้าของยืนยันว่ายังเปิดอยู่จริง)

หัวเอกสารเหล่านี้ไม่ได้อัปเดตหลังวันที่เขียน และ T5 รอบนี้ไม่ได้ยกขึ้นมาเป็นข้อที่ยังเปิด จึง **อาจล้าสมัยแล้ว** AI ไม่ได้ตรวจทีละข้อ

- [req-questions-search-delete-logout.md](req-questions-search-delete-logout.md) (2026-11-17)
- [req-notice-room-photos-out-of-scope.md](req-notice-room-photos-out-of-scope.md) (ADR-007 ลดขอบเขตรูปภาพห้อง · รอ req ตอบ 2 ข้อ)
- [req-request-ex-validation-delete-2026-11-18.md](req-request-ex-validation-delete-2026-11-18.md) · [req-request-ex-partial-reject-2026-11-20.md](req-request-ex-partial-reject-2026-11-20.md) (ร่างสำหรับส่ง)
- [req-question-ex-wording-reject-edit-2026-11-18.md](req-question-ex-wording-reject-edit-2026-11-18.md) (EX ของ Email ตอนเปลี่ยนผลเป็นปฏิเสธ)
- [finding-partial-recipient-reject-2026-11-18.md](finding-partial-recipient-reject-2026-11-18.md) (น่าจะกลายเป็น DEF-05 แล้ว)
