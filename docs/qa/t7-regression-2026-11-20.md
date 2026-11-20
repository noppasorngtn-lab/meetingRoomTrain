# รายงาน T7 — เลือก Regression (Build `73550c7`, 2026-11-20)

**Run type: Core + changed-area (Extended แบบเจาะ)** · ผู้ขอไม่ได้ระบุ run type — QA เลือกเอง [Recommended] เพราะรอบนี้ไม่มีการแก้โค้ดระบบ แต่แก้โครง stack ที่ทุกเคส E2E พึ่งพา · ร่างโดย AI ให้ QA ตรวจก่อนใช้ · ใช้ trace จาก `.aeon/design/trace.design.json` (766 edge) และคอลัมน์ Function/Priority ใน `t1-test-cases.csv` · **ชุดที่เลือกรันแล้ว 2026-11-20 ผลอยู่ในหัวข้อ "ผลรัน" ท้ายไฟล์** (ผลรันเต็มชุดวันนี้อยู่ใน [T5](t5-quality-gate-2026-11-20.md): 173/1/1)

## Change list (เทียบ `3fe3836` → `73550c7`)

| # | Change | ชนิด | อยู่ใน |
|---|---|---|---|
| C1 | เพิ่ม service `tls-proxy` (Caddy :4443) และ volume `caddy-data` | infra / compose | `docker/docker-compose.yml`, `docker/Caddyfile` |
| C2 | เพิ่มวิธีสลับ mailpit เป็น SMTP ที่ปฏิเสธเฉพาะ U3 · เลิก `test.fixme` ของ TC-NTF-JOB-110 | test helper | `test/e2e/support/partial-reject-mail.ts`, `t1-round2.spec.ts`, `partial-reject-smtp.mjs` |
| C3 | เพิ่มเคส TC-NFR-REQ001-103 | test ใหม่ | `test/e2e/t1-nfr-https.spec.ts` |
| C4 | เอกสาร QA (T2/T4/T5, finding) | docs | `docs/qa/*` |

โค้ดระบบ `apps/` ไม่เปลี่ยนในช่วงนี้ (ตรวจด้วย `git diff --stat 3fe3836 HEAD -- apps` ว่างเปล่า) · REQ/BR ไม่เปลี่ยน · ค่าตั้งห้อง ไม่เปลี่ยน · migration ไม่มี · สูตรรายงาน ไม่เปลี่ยนในช่วงนี้ (BR-006@v2/CHG-004 เป็นของรอบก่อนและมีเคส golden ครบแล้ว)

## A) Impact table

| Change | Affected Function / BR | Risk |
|---|---|---|
| C1 tls-proxy | ทุก function ที่เข้าผ่าน stack เดียวกัน (compose เปลี่ยน) · NFR-mrr-003 | **กลาง** — ไม่แตะพอร์ต 4173/3000 ที่ suite ใช้ แต่เปลี่ยนไฟล์ที่ยกทั้ง stack · ผลรันเต็มวันนี้ผ่านหลังเพิ่ม (ลดความเสี่ยง) |
| C2 สลับ mailpit | Notification / BR-mrr-019, 020, 023 · INT-001 (trace: API-004/008/009/011/014/015, FUN-mrr-011/012 `integratesWith` INT-001) | **กลาง** — เคสที่ใช้ `mailDown`/`ensureMailUp` (`t1-jobs`, `t1-round2`) อาศัยกลไก start/stop mailpit เดียวกัน ถ้า cleanup พลาด mailpit จะไม่กลับและเคสถัดไปล้มทั้งแถว |
| C3 เคส HTTPS | NFR-mrr-003 (SCN-mrr-078 `verifiedBy`) | ต่ำ — เคสใหม่ ไม่กระทบเคสอื่น |
| C4 เอกสาร | — | ไม่มี |

ข้อควรระวัง: พฤติกรรมของ DEF-05 (เปิดอยู่) ไม่ได้เปลี่ยนในรอบนี้ แต่ถ้า Dev แก้ในรอบหน้า จะกระทบทุก function ที่ผ่าน `SmtpMailTransport` (ดู INT-001) — ต้องขยาย suite ตอนนั้น

## B) Selected suite

ลำดับตามความเสี่ยง · Priority ตามคอลัมน์ CSV เว้นแต่ระบุ · Automated = Y ทั้งหมด (มีสคริปต์ Playwright ทุกเคส)

### B1) Core (ทุก build) — ตามกติกา test/CLAUDE.md และ T7

| กลุ่ม | TC ID | Reason | Priority | Auto |
|---|---|---|---|---|
| จองซ้อน (BR-mrr-001) | TC-BKG-UI006-019, 020, 021, 022 · TC-BKG-UI004-101, 102, 103 · เคส "จองช่วงเวลาเดิมซ้ำ" ใน `booking.spec.ts:138` | ขอบ [start, end) · ทับ 1 นาที · ทับกับ PENDING · ช่วงที่ยกเลิกแล้ว · ค้นหาห้องว่าง | Critical* | Y |
| สิทธิ์ผู้จอง (BR-mrr-003, 021) | TC-MYB-UI008-101 · TC-MYB-UI007-101, 102 · TC-CAL-UI005-101–104 | ผู้ใช้ไม่เห็น/แก้การจองของคนอื่น | Critical | Y |
| สิทธิ์ผู้ดูแล (BR-mrr-005) | TC-RMM-UI012-101 · TC-RMM-UI013-101, 102, 103, 110, 111 · TC-RMM-UI014-101 | สิทธิ์ผู้ดูแลห้อง ห้ามรั่ว | Critical | Y |
| อนุมัติ (BR-mrr-004, 011) | TC-APR-UI009-101, 102 · TC-APR-UI010-103, 104, 105, 106, 110 | สถานะ PENDING/CONFIRMED/REJECTED และการเปลี่ยนผล | High | Y |
| ยกเลิกอัตโนมัติ (BR-mrr-016) | TC-APR-JOB-101, 102, 103 · TC-APR-UI009-106 | ลำดับงานตามเวลา | High | Y |
| เข้าสู่ระบบ (BR-mrr-026–028) | TC-AUTH-UI001-101, 108, 109 · TC-AUTH-UI002-101–106 | รหัส 6 หลัก/magic link | Critical | Y |

\* เคส TC-BKG-UI006-019–021 และเคส `booking.spec.ts:138` อยู่ใน `booking.spec.ts` ไม่อยู่ใน CSV จึงไม่มีช่อง Priority — ระบุ Critical ตาม §3.3 (จองซ้อน = Critical) เป็น [Inferred]

จำนวน Core: **43 เคส** (CSV 39 + legacy 4) แต่ **TC-MYB-UI007-103 อยู่ในนั้น 1 เคสและเป็น flaky** → แยกรายงาน (ข้อ B3) จึงนับ Core ที่ใช้ตัดสิน pass/fail = **42**

### B2) Changed-area (เพิ่มเพราะ C1–C3)

| TC ID | Reason | Priority | Auto |
|---|---|---|---|
| TC-NTF-JOB-104, 105 · TC-BKG-UI006-109 (`t1-jobs.spec.ts`) | ใช้ `mailDown`/`mailUp` — พิสูจน์ว่ากลไกสลับ mailpit (C2) ยังกลับสู่สภาพเดิม | Medium (JOB) / ไม่อยู่ใน CSV (UI006-109) | Y |
| TC-NTF-JOB-109 (`t1-round2.spec.ts`) | เมลเตือนปกติ ผ่าน mailpit หลังเคส C2 รันก่อนหน้า | Medium | Y |
| TC-NTF-JOB-110 (`t1-round2.spec.ts`) | ตัวเคส C2 · **ล้มโดยรู้ล่วงหน้า (DEF-05)** → รายงานเป็น known defect ไม่นับเป็น regression ใหม่ | Medium | Y |
| TC-BKG-UI006-026 (`booking.spec.ts`) | เมลจองสำเร็จถึงผู้จองผ่าน mailpit — ตรวจ INT-001 พื้นฐาน | ไม่อยู่ใน CSV | Y |
| TC-NFR-REQ001-103 (`t1-nfr-https.spec.ts`) | เคส NFR-003 ใหม่ (C3) | ตาม T1 proposal: High | Y |

จำนวน changed-area: **7 เคส** (รวม TC-NTF-JOB-110 ที่ล้มอยู่)

### B3) Flaky — แยกรายงาน ไม่นับ pass/fail

| TC ID | เหตุผล |
|---|---|
| TC-MYB-UI007-103 | ล้มเป็นช่วง ๆ (T3 2026-11-19: Test Data Issue · ข้อมูลสะสมของ U1) · รอบวันนี้ผ่าน · รันและรายงานแยก ไม่นับในตัวเลข Core |

## C) Excluded + เหตุผล

| กลุ่มที่ไม่เลือก | จำนวนโดยประมาณ | เหตุผล |
|---|---|---|
| รายงานการใช้งาน (TC-RPT-RPT001-xxx, 12 เคส) | 12 | สูตร/ค่าตั้งห้องไม่เปลี่ยนในช่วงนี้ → ไม่ต้องเพิ่มเคส golden (T7 ข้อ 3 ใช้เฉพาะเมื่อสูตรเปลี่ยน) |
| ร่องรอยการกระทำ (AUD) | 12 | ไม่มี change ที่แตะ · ไม่อยู่ใน Core ตามกติกา (Medium) |
| การแจ้งเตือนส่วนข้อความ (NTF, ที่ไม่ผ่าน mailpit down) | ส่วนใหญ่ของ 22 | หัวเรื่อง/ถ้อยคำไม่เปลี่ยน |
| ห้อง/อุปกรณ์ส่วนที่ไม่ใช่สิทธิ์ (RMM High ที่เหลือ) | ส่วนหนึ่ง | ไม่เกี่ยวกับ change |
| เคส [stub] เดิม 9 เคส | 9 | ผ่านไม่พิสูจน์ API จริง (กติกาข้อ 7) — ไม่ใช้เป็นหลักฐาน regression |
| NFR-005 ข้ามเบราว์เซอร์ (firefox, webkit, edge, mobile) | — | ไม่มี change ฝั่งหน้าเว็บ |
| jest/vitest | 478 / 300 | ไม่มีการแก้โค้ด `apps/` — รันซ้ำเป็นส่วนของ build ปกติได้ ไม่จำเป็นต่อ regression นี้ |

ตัวเลขจำนวนที่ระบุ "โดยประมาณ" ไม่ได้นับซ้ำรายเคสหลังหักเคสที่เลือก

## D) ขนาดการรัน เทียบ Full suite

| ชุด | เคส | สัดส่วน | เวลาโดยประมาณ |
|---|---|---|---|
| Full chromium (วันนี้) | 175 | 100% | 5.1 นาที (วัดจริง) |
| Core | 42 (+1 flaky แยก) | ≈ 25% | ≈ 1.3 นาที (**ประมาณเชิงสัดส่วน ไม่ได้วัด** — เวลาต่อเคสต่างกันมาก เคส clock/jobs ช้ากว่า) |
| Core + changed-area | 49 (+1 flaky แยก) | ≈ 29% | ≈ 1.5 นาที (ประมาณ) |

## ผลรัน (2026-11-20 · Build `73550c7` · chromium · stack จริง · รอบเดียว)

| ชุด | แผน | ผ่าน | ล้ม | หมายเหตุ |
|---|---|---|---|---|
| Core | 42 | 42 | 0 | |
| Changed-area | 7 | 6 | 1 | ล้ม: TC-NTF-JOB-110 (known defect DEF-05 · Expected `FAILED` Received `SENT` · ไม่นับเป็น regression ใหม่) |
| เคสเตรียมข้อมูลที่ต้องรันก่อน (เกินแผน) | — | 2 | 0 | "เตรียมข้อมูล: จอง 09:00–10:00" และเคส CONFIRMED ใน `booking.spec.ts` (อยู่ใน `describe.serial`) |
| Flaky แยกรายงาน: TC-MYB-UI007-103 | 1 | 1 | 0 | รันเดี่ยว ผ่าน · ไม่นับในตัวเลข Core |

- รวมชุดหลัก 51 เคส: ผ่าน 50 · ล้ม 1 · ใช้เวลา 1.7 นาที (แผนประมาณ ≈1.5 นาที สำหรับ 49 เคส) · เทียบ TC ID ในผลรันกับแผนแล้ว (48 ID + เคสจองซ้ำเดิมที่ไม่มี ID) ไม่ขาดเคสใด
- กลไกสลับ mailpit (C2) กลับสภาพเดิมได้: TC-NTF-JOB-104/105 และ TC-BKG-UI006-109 ผ่าน และ mailpit ยังรันอยู่หลังจบ · TC-NFR-REQ001-103 (C3) ผ่านในชุดนี้
- **ข้อจำกัด:** รันรอบเดียว เฉพาะ chromium · เคสบางกลุ่มอยู่ใน `describe.serial` (เช่น เข้าสู่ระบบ ปฏิทิน) รันเฉพาะเคสที่เลือกในกลุ่ม — ผ่าน แต่ไม่พิสูจน์เคสอื่นในกลุ่มเดียวกัน
- ผลนี้ยังไม่ตอบ Open Question ข้อ 3: Core ที่มี known defect ถือว่า "ผ่าน" หรือไม่ — รอ PO

## Open Questions (TBD)

| # | คำถาม | ผู้ตอบที่เสนอ |
|---|---|---|
| 1 | ยืนยัน run type และเกณฑ์ Core (กติกา T7 ระบุหัวข้อไว้ แต่ชุด 42 เคสเป็นการคัดของ QA — [Recommended]) | QA / PO |
| 2 | Priority ของ TC-BKG-UI006-019–021, 026, 109 และเคสเก่าใน `booking.spec.ts` ไม่มีใน CSV — ยืนยันระดับและ TC ID | QA |
| 3 | นิยาม "ผ่าน" ของ Core เมื่อมี known defect (TC-NTF-JOB-110): ให้ตัดออกจากเกณฑ์ หรือถือว่า Core ไม่ผ่าน (TBD - Require Business Confirmation) | PO |

## Next Actions
1. ~~รันชุด Core + changed-area~~ ทำแล้ว (ดูผลรัน) · QA ตรวจรายการคัดเคสและผลรัน
2. ถ้า Dev แก้ DEF-05 → รัน T7 ใหม่ด้วย run type Extended (ผ่าน `SmtpMailTransport` กระทบทุกเมล INT-001)

## ภาคผนวก — ตรวจ build `2a64d70` (2026-11-20 · หลังรัน T1–T5)

เทียบ `73550c7` → `2a64d70` ด้วย `git diff --name-only`: จำนวนไฟล์ที่เปลี่ยนใน `apps/` · `docker/` · `.aeon/` · `docs/wiki` · `docs/requirements` · `test/e2e` · `test/fixtures` · `test/playwright.config.ts` = **0 ทุกที่** · ที่เปลี่ยนคือ `docs/qa/*` (เอกสาร QA, `t1-generate.py`, CSV/MD ของ T1) และ `test/results.json` (ผลรัน)

- ไม่มีการเปลี่ยนโค้ดระบบ ค่าตั้งห้อง สูตรรายงาน (ไม่มี GD ใหม่) migration หรือสคริปต์เทส → ไม่มี BR/function ที่ได้รับผลกระทบเพิ่ม · **selection ข้างต้น (Core + changed-area) ยังใช้ได้ตามเดิม**
- ผลรัน Playwright chromium ทั้งชุดบน build เดียวกันนี้ (T3 [2026-11-20](t3-results-2026-11-20.md), `16c3eb6`): 173 ผ่าน · 1 ล้ม (TC-NTF-JOB-110 / DEF-05) · 1 ข้าม — ครอบเคส Core ทั้งหมดแล้ว จึงไม่รันชุดเลือกซ้ำ [Recommended]
- ความเสี่ยงที่ยังเหลือเหมือนเดิม: TC-MYB-UI007-103 (flaky · ข้อมูลสะสมของ U1) ผ่านในรันนี้แต่ต้นเหตุยังไม่แก้ · เมื่อ Dev แก้ DEF-05 จะกระทบทุกอย่างที่ใช้ `SmtpMailTransport` ต้องทำ T7 ใหม่ตอนนั้น
