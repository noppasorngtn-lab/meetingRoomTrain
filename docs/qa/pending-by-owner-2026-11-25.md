# งานที่รอแต่ละฝ่าย (อัปเดต 2026-11-26 เย็น · HEAD `e195e01` · PO · design · req (งานโปรเจกต์) · **มีข้อใหม่จากรอบ T1 delta — ดูหัวข้อ "ข้อใหม่จากรอบ T1 delta"** · ฉบับแรก 2026-11-25 ที่ `61255fe`)

ร่างโดย AI จากผลรันด่านและเอกสารใน `docs/qa/` · **ไม่มีข้อไหนที่ AI ปิดเองได้** ทุกข้อต้องให้คนตัดสิน บันทึกทางการ หรือเซ็น
แหล่งหลัก: [t5-quality-gate-2026-11-25.md](t5-quality-gate-2026-11-25.md) §E, §F, Next Actions · [t7-regression-def07-2026-11-26.md](t7-regression-def07-2026-11-26.md) · [t7-regression-def08-2026-11-26.md](t7-regression-def08-2026-11-26.md) · [req-design-request-adr017-2026-11-25.md](req-design-request-adr017-2026-11-25.md) · [t5-critical-assertion-sample-2026-11-25.md](t5-critical-assertion-sample-2026-11-25.md)

## สถานะด่าน (รันซ้ำ 2026-11-26 เย็นที่ `8c97244` · read-only)

| เฟส | ผล |
|---|---|
| req | `verify-rules --cp1` PASS · `--cp2` PASS · BR 28/28 มี EX · red card 0 · CP1 เซ็นใหม่ (Noppasorn 2026-11-26 · เดิม 2026-11-18) · ล่าสุด CHG-mrr-008 → BR-mrr-002@v2 · EX-mrr-136..140 |
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
| R-4 `verified_by` | NFR-mrr-001 · 003 · 005 = `e2e_test` (ผู้ใช้เลือก 2026-11-26 · SRC-045) · CP1 เซ็นใหม่โดย Noppasorn 2026-11-26T08:27:13Z (ลายเซ็นเดิม 2026-11-18 ปลดด้วย `--because CHG-mrr-008`) · CP1 PASS · red card 0 |
| D-5 อนุมัติคำขอแก้ไขไม่ส่ง Email | ผู้ใช้ตัดสิน 2026-11-26: **ไม่ส่ง ตั้งใจแบบนี้** (แก้บันทึกหลังประชุมจบ) · ไม่มีงาน dev · ตัวอักษรของ BR-mrr-007@v3 (3) ยังไม่ตรง → ส่ง req เป็น R-5 ([req-request-adjustment-no-email](req-request-adjustment-no-email-2026-11-26.md)) |

## ข้อใหม่จากรอบ T1 delta (2026-11-26)

ที่มา: [t1-test-cases.md](t1-test-cases.md) §B16–B17 และ §D · ข้อความ "ไม่มีข้อค้าง" ในหัวข้อ PO · req · QA ด้านล่างหมายถึงข้อชุดเดิม (PO-1..9 · R-1..5 · Q-1..9) เท่านั้น

| ฝ่าย | เรื่อง |
|---|---|
| (ปิดแล้ว) เจ้าของ | EX-mrr-147 validated 2026-11-27 (ผู้ใช้อนุมัติ) · ตามที่ผู้ใช้ตอบในเซสชัน 2026-11-27: ยอมรับให้รอบเตือนถัดไปเป็นผู้ส่งถ้ารอบช่วง 09:45 ผ่านไปก่อนบันทึกการจอง · ยังต้องให้ design/mock/dev รับ |
| (ปิดแล้ว) QA | QA review ผ่าน — QA_Noppasorn 2026-11-27 (ตามที่ผู้ใช้แจ้งในเซสชัน · AI ไม่ได้ลงนามแทน) · ข้อความเดิม: review §B19: แถวและสคริปต์ TC-NTF-JOB-118 และข้อความที่ต่อท้าย Note ของ TC-NTF-UI006-103 |
| (ปิดแล้ว) QA | QA review ผ่าน — QA_Noppasorn 2026-11-27 (ตามที่ผู้ใช้แจ้งในเซสชัน · AI ไม่ได้ลงนามแทน) · ข้อความเดิม: review §B20: การผูก TC-NTF-UI008-110 กับ EX-mrr-146 / AC-mrr-149 (แถว CSV และ `e2e-ex-map.json`) และ AC-mrr-150 ของ TC-NTF-JOB-118 |
| (ปิดแล้ว) BA / PO | OQ-T1-20 ตามที่ผู้ใช้ตอบในเซสชัน 2026-11-26: ส่งครั้งเดียว โดยงานเตือนรอบ 15 นาที |
| (ปิดแล้ว) PO | OQ-T1-05 ตามที่ผู้ใช้ตอบในเซสชัน 2026-11-26: ยอมรับ · ข้อความเดิม: EX-mrr-003 ยอมรับผู้จองคนเดียวกันได้ไหม (ไม่พบคำตอบในตาราง §D) · เกี่ยวกับช่องว่างข้อ 5 ใน [t2-coverage-report.md](t2-coverage-report.md) |
| (ปิดแล้ว) req | OQ-T1-21: EX-mrr-146 validated 2026-11-26 (ผู้ใช้ตรวจ) · ยังต้องให้ design/mock/dev รับ และ QA ผูกเคส |
| (ปิดแล้ว) QA | แถว CSV ของ 3 เคสใหม่ (§B17.4) และการแก้ `req-handoff-links.py`: QA review ผ่าน — QA_Noppasorn 2026-11-26 (ตามที่ผู้ใช้แจ้งในเซสชัน · AI ไม่ได้ลงนามแทน) |
| (ปิดแล้ว) QA | TC-BKG-UI006-110 ตามที่ผู้ใช้ตอบในเซสชัน 2026-11-26: คงการผูกกับ BR-mrr-002 (§B18) |
| QA | สคริปต์ 3 เคส ผลรัน และตัวกรองของ `req-handoff-links.py` (§B17.5): QA review ผ่าน — QA_Noppasorn 2026-11-26 (ตามที่ผู้ใช้แจ้งในเซสชัน · AI ไม่ได้ลงนามแทน) · ข้อความแถว TC-NTF-UI006-103 ที่ปรับเป็นขอบเขต unit และไฟล์หลักฐานที่สร้างใหม่ (§B17.6): QA review ผ่าน — QA_Noppasorn 2026-11-26 (ตามที่ผู้ใช้แจ้งในเซสชัน · AI ไม่ได้ลงนามแทน) · รันชุดเต็มซ้ำแล้ว 2026-11-26: jest 556/556 · Playwright chromium 227 ผ่าน 1 ข้าม ([t3-results-2026-11-26.md](t3-results-2026-11-26.md) · QA_Noppasorn review ผ่าน 2026-11-26 ตามที่ผู้ใช้แจ้ง) · ล้าง `E2E%` หลังรันอีก 171 การจอง เหลือ 1,988 · ยอดอื่นในเอกสารนี้เป็นของรอบก่อน |

## PO

ไม่มีข้อค้าง — PO-1 ถึง PO-9 ปิดแล้วเมื่อ 2026-11-26 (ดูตาราง "ปิดแล้ว" ด้านบน)

## design

ไม่มีข้อค้าง — D-1 ถึง D-7 ปิดแล้ว (D-3 · D-4 ปิด 2026-11-25 — CHG-mrr-007 · D-6 · D-7 ปิด 2026-11-26 — ADR-019 · D-1 ปิด 2026-11-26 — ADR-020 · D-2 · D-5 ปิด 2026-11-26 — คู่มือผู้ดูแล / R-5)

## req

| # | เรื่อง | ที่มา |
|---|---|---|
| R-4 (ส่วนที่เหลือ) | คำถามว่า `/req:capture` เป็นทางที่ req ตั้งใจให้ใช้แก้ `verified_by` หรือไม่ ยังไม่มีคำตอบจาก plugin (ไม่มีคำสั่งเฉพาะ) — เป็นคำถามถึงผู้ดูแล plugin ไม่ใช่งานของโปรเจกต์ · ลายเซ็น CP1 เซ็นใหม่แล้ว (Noppasorn 2026-11-26T08:27:13Z) | req-request-nfr004-verified-by-and-resign-2026-11-23.md |

(R-1 ปิดแล้ว 2026-11-25 — CHG-mrr-007 · R-3 ปิด 2026-11-26 · R-2 · R-5 และส่วน `verified_by` ของ R-4 ทำแล้ว 2026-11-26 — ดูตาราง "ปิดแล้ว")

### งานที่ตามมาจาก EX-mrr-141..145 — ทำแล้ว 2026-11-26 · Q-9 (QA review) ปิดแล้ว: QA_Noppasorn review ผ่าน 2026-11-26 ตามที่ผู้ใช้แจ้ง

| ฝ่าย | ผล |
|---|---|
| design | ADR-021 (design · added · absorbed) · AC-mrr-144..148 · `functions.json` เซ็นใหม่ Noppasorn 2026-11-26 · `check` PASS · `approve --ready` 9/9 · `41a18f7` |
| mock | ผู้ใช้เลือกไม่ mark stale — ADR-021 แตะแค่ AC · `wireframes --validate` PASS 15/15 · `/mock:sync` หลัง absorb: nothing moved |
| dev | `/dev:plan` re-cut (`4382688`) — AC ใหม่ผูกกับหน่วยเดิม · ไม่มีงานโค้ด · `--cp4` clear |
| QA | ผูก 4 เคสของ `t1-partial-reject.spec.ts` กับ EX-141..144 · เปลี่ยน TC-NTF-UI008-106 (ซ้ำ) เป็น **TC-NTF-UI008-109** · เคสใหม่ **TC-APR-UI011-105** (EX-145) · CSV +6 แถว · e2e-ex-map +5 · t1-test-cases.md §B15.5 · chromium 2 ไฟล์ **23 passed** · T2: AC 148 ทุกข้อมีเทส · EX ที่ E2E คลุม **145/145** · AC-mrr-144..148 มีแค่ชั้น E2E (ไม่มี jest อ้าง AC — แบบเดียวกับ AC-mrr-135..138) |

## QA

ไม่มีข้อค้าง — Q-1 ถึง Q-9 ปิดแล้ว (2026-11-26 · ผู้ใช้ตัดสินในเซสชัน):

| # | ผล |
|---|---|
| Q-1 | การแก้ TC-MYB-UI007-103 (`61255fe`) QA review ผ่าน — QA_Noppasorn 2026-11-26 (ตามที่ผู้ใช้แจ้ง · AI ไม่ได้ลงนามแทน) |
| Q-2 | TC-AUTH-UI002-102: ยอมรับว่า API ครอบ ไม่เพิ่มเคสหน้าจอ |
| Q-3 | Scenario ของ TC-AUTH-UI002-101 แก้เป็น "กรอกรหัสภายในอายุรหัส" · ขอบเวลา 10:09:59 อยู่ที่ TC-AUTH-UI002-107 |
| Q-4 | TC-AUTH-UI001-101/109: ยอมรับ (TC-AUTH-UI001-108 ตรวจเท่ากันทั้งสตริงอยู่แล้ว) |
| Q-5 | ข้อสังเกตเคส F5: ยอมรับข้อ 2, 3, 5, 7 · ข้อ 6 แก้ Requirement ID เป็น BR-mrr-007@v3 แล้ว (6 แถว) · ข้อ 8 อยู่ในงานก่อนปล่อยจริง |

บันทึกใน `t1-test-cases.csv` (Note/Scenario/Requirement ID 11 แถว) · `t5-critical-assertion-sample-2026-11-25.md` · `t1-test-cases.md` §B12.2

## งานก่อนปล่อยจริง (= เงื่อนไข 6 ของ Conditional Go) — ทำแล้ว 2026-11-26 บน Docker เครื่องนี้

**ปลายทาง:** ไม่มี staging/production ให้เข้าถึง · **ผู้ใช้ตัดสิน 2026-11-26 ให้ถือว่า Docker stack บนเครื่องนี้คือ build ปลายทาง** (image build ใหม่จาก HEAD `6dc80cd` ด้วย `--build`) · ถ้ามีปลายทางจริงภายหลัง ต้องรันชุดนี้ซ้ำที่นั่น

| งาน | ผล |
|---|---|
| jest (`apps/api`) | **555/555** · 40 suites |
| vitest (`apps/web`) | **333/333** · 21 ไฟล์ |
| NFR-005 เบราว์เซอร์อื่น (firefox · webkit-safari · edge · mobile-chrome · mobile-safari) | **32 ผ่าน · 3 ข้าม (โดยออกแบบ · PO-3) · 0 ล้ม · flaky 0** · `test/results-nfr005-browsers.json` |
| (PO-5) Secure cookie | ตรวจชั่วคราว: รัน api ด้วย `COOKIE_SECURE=true` (override นอกรีโป · ไม่แก้ config) เข้าผ่าน `https://localhost:4443` → login: `Set-Cookie: mrr_session=…; Path=/; HttpOnly; SameSite=Lax; Secure` · logout: `mrr_session=; …; Max-Age=0; Secure` · แล้วคืน api เป็น config เดิม (`COOKIE_SECURE` ไม่ได้ตั้ง) |
| (PO-5) HSTS | **ไม่มี** header `Strict-Transport-Security` (Caddy ไม่ได้ตั้ง · api ไม่ส่ง) — ผู้ใช้เลือกไม่แก้ config · **ยังเป็นงานของคนตั้ง reverse proxy บนปลายทางจริง** และ `COOKIE_SECURE=true` ต้องตั้งที่ปลายทางจริงด้วย |
| ล้างการจอง `E2E%` | สำรองก่อน (`pg_dump -Fc` 1.2 MB · อยู่ในโฟลเดอร์ชั่วคราวนอกรีโป · ตรวจแล้วอ่านได้ 16 ตาราง) · ลบใน transaction เดียวเฉพาะการจอง `E2E%` ที่ไม่มีร่องรอยและไม่มีคำขอแก้ไข: **591 การจอง** พร้อมผู้เข้าร่วม 629 แถว · อุปกรณ์ 27 แถว · **เหลือ `E2E%` 1,948** ที่ลบไม่ได้ (ร่องรอยเพิ่มอย่างเดียว BR-mrr-018 · ไม่ได้แตะ trigger) · การจองที่ไม่ใช่ E2E 1 รายการไม่ถูกแตะ · ร่องรอย 2,367 เท่าเดิม |

ไม่ได้รัน Playwright chromium ทั้งชุดในรอบนี้ (เงื่อนไข 6 ไม่ได้ขอ) · ผลล่าสุดของชุดเต็มคือรอบที่ 14 บน `8c97244` · หลังจากนั้นรันเฉพาะ `t1-partial-reject` + `t1-inactive-recipients` 23 passed

## เอกสารเก่าที่หัวเอกสารยังเขียนว่า "รอ" (ต้องให้เจ้าของยืนยันว่ายังเปิดอยู่จริง)

หัวเอกสารเหล่านี้ไม่ได้อัปเดตหลังวันที่เขียน และ T5 รอบนี้ไม่ได้ยกขึ้นมาเป็นข้อที่ยังเปิด จึง **อาจล้าสมัยแล้ว** AI ไม่ได้ตรวจทีละข้อ

- [req-questions-search-delete-logout.md](req-questions-search-delete-logout.md) (2026-11-17)
- [req-notice-room-photos-out-of-scope.md](req-notice-room-photos-out-of-scope.md) (ADR-007 ลดขอบเขตรูปภาพห้อง · รอ req ตอบ 2 ข้อ)
- [req-request-ex-validation-delete-2026-11-18.md](req-request-ex-validation-delete-2026-11-18.md) · [req-request-ex-partial-reject-2026-11-20.md](req-request-ex-partial-reject-2026-11-20.md) (ร่างสำหรับส่ง)
- [req-question-ex-wording-reject-edit-2026-11-18.md](req-question-ex-wording-reject-edit-2026-11-18.md) (EX ของ Email ตอนเปลี่ยนผลเป็นปฏิเสธ)
- [finding-partial-recipient-reject-2026-11-18.md](finding-partial-recipient-reject-2026-11-18.md) (น่าจะกลายเป็น DEF-05 แล้ว)
