# รายงาน T1 — สร้าง Test Case (E2E) · REQ-mrr-001 ถึง 005

วันที่: 2026-11-17 (อัปเดตรอบ 2026-11-18 เพิ่ม EX-106–110 และรอบ 2 เพิ่ม EX-111–122 ตาม CHG-mrr-003) · Test Level: E2E · ขอบเขต: ทั้ง 5 REQ (28 BR ที่ใช้อยู่ · 128 EX) · ใช้ template T1 ของ [qa-playbook.md](qa-playbook.md)

ไฟล์ที่เกี่ยวข้อง: [t1-test-cases.csv](t1-test-cases.csv) (นำเข้า Excel/Test Management ได้) · สร้างโดย [t1-generate.py](t1-generate.py) (`python docs/qa/t1-generate.py`)

> **รอบ 2 (EX-111–122, CHG-mrr-003): เคสใหม่ 11 เคส (EX-119 ผูกเข้ากับ TC-BKG-UI006-104 ตามคำตัดสิน QA) · ยังไม่ผ่าน QA review · เขียนสคริปต์แล้ว 11 เคส (`t1-round2.spec.ts`; TC-NTF-JOB-110 เป็น test.fixme) · หลัง Dev แก้ตาม v2 และเจ้าของตอบเรื่องถ้อยคำ (2026-11-18): ผ่าน 10 · ล้ม 0 · ข้าม 1 (ดู §B6 · EX-118/120/122 ต้องให้ req แก้ถ้อยคำข้อความ — OQ-T1-16)** (ไม่นับใน 'review เสร็จ' ด้านล่าง) · BR-mrr-007/017/020 เป็น @v2 — เคสเดิมที่ EX ผูกทั้ง v1+v2 ถูกอัปเดตช่อง Requirement ID เป็น v2 (ถ้อยคำ Expected ของเคสเดิมไม่เปลี่ยน — ตรวจซ้ำว่ายังตรงกับ EX-019–022, 054–057, 066–067 ปัจจุบัน)
>
> **สถานะรอบ 1: QA review เสร็จสมบูรณ์ (completed) · ผู้ review: QA_Noppasorn · 2026-11-18 · ขอบเขต: ทุกเคส (CSV 101 เคส + §B3 ออกจากระบบ + §B4 อุปกรณ์เสริม)** — Tag ในคอลัมน์ยังเป็น AI-generated เพราะบอกที่มาของเคส ไม่ใช่สถานะ review · เขียนสคริปต์ Playwright ครบและรันกับระบบจริงแล้ว (เฉพาะเคสรอบ 1 · ข้อ 0) · ผลรันผ่านไม่ใช่การ review เคส · §B3/B4 เป็นเคส [Recommended] นอก BR (B3 PO รับแล้ว: OQ-T1-10)
>
> **review ซ้ำ TC-RMM-UI013-108/109 (EX-031/032): เสร็จแล้ว 2026-11-18** (QA แจ้ง) — Expected ถูกแก้ให้ตรง wiki v2 หลังรอบ review ที่ปิดไป (REQ-mrr-003 ซิงก์เป็น v2 แล้ว 2026-11-18 · commit e01d23c · คำขอ: [req-request-sync-req003-ex031-032-2026-11-18.md](req-request-sync-req003-ex031-032-2026-11-18.md)) · ผลการ review (ผ่าน/แก้) ไม่ได้ระบุมา — ไม่บันทึกเป็นผลลัพธ์
> **รอบ 4 (EX-125–127, CHG-mrr-004 · BR-mrr-006@v2 อันดับเท่ากัน 1,1,3): เคสใหม่ 4 เคส (111–114) · **QA review เสร็จ (completed) โดย QA_Noppasorn 2026-11-20 ดู §B7** · เขียนสคริปต์แล้วทั้ง 4 (`t1-reports.spec.ts` + fixture ใน `support/report-fixture.ts`, ห้อง E2E Rpt F/G/H ใน `support/accounts.ts`) **รันกับระบบจริงแล้ว 2026-11-19 (Chromium · Docker stack mrr): ผ่าน 3/3 · ทั้งไฟล์ t1-reports.spec.ts 12/12** — พิสูจน์ว่า assertion จับผิดได้: ตั้งให้ห้อง D คาดหวังอันดับ 2 แล้วล้ม (Received 3) · ยังไม่ผ่าน QA review · ผูก EX-125–127 ใน e2e-ex-map.json แล้ว · ค่าที่ใช้ใน EX รันจาก CALC-mrr-001@v1.mjs แล้ว**
>
## 0. สรุป

- EX ทั้งหมด **128** รายการ · มีสคริปต์แล้ว **9** (ไม่สร้างซ้ำ) · คลุมบางส่วน **1** · **เคสใหม่ 118**
- Automation (จัดตอนออกแบบเคส 2026-11-17: Yes 19 · Partial 65 · No 34) — **ปรับเมื่อ 2026-11-25 ตามที่ผู้ใช้สั่ง: 34 แถวที่เดิม No เป็น Yes** เพราะมีสคริปต์และผ่านใน `test/results.json` ทุกแถว · ปัจจุบันใน CSV: **Yes 75** · **Partial 65** (ต้องเตรียมข้อมูล §C) · **No 0** (Yes 75 รวมเคสที่เพิ่มหลังออกแบบ) — กลไกที่ขาด (ผู้ใช้หลายบทบาท นาฬิกา งานตามเวลา อีเมลล่ม fixture รายงาน) ทำครบแล้ว ดู OQ-T1-01–03
- **เขียนสคริปต์แล้ว 118 จาก 118 เคส** (คอลัมน์ Script ใน CSV · อ่านจากชื่อเคสใน `test/e2e/*.spec.ts` · TC-AUD-UI010-107/108 ตั้งชื่อจาก loop จึงใช้ mapping ใน t1-generate.py)
- **ผลรัน 2026-11-18** (Chromium · ระบบจริงบน Docker · suite เต็ม): 145 ผ่าน · 1 ข้าม (NFR-005 อุปกรณ์สัมผัสบนเดสก์ท็อป ข้ามโดยออกแบบ) · 0 ล้ม · รัน 2 รอบติด ผลเหมือนกัน · ตัวเลขนี้รวมเคสเดิมนอก T1 ด้วย ไม่ใช่เฉพาะเคสในไฟล์นี้
- Priority: Critical 35 · High 42 · Medium 41 · Low 0 — ตาม §3.3 ของ playbook ซึ่งเป็น [Recommended] รอ PO ยืนยัน
- Data Source: เคสใหม่ทั้งหมดออกแบบเป็น `real` (คุยกับ API/DB จริง) — ไม่มีเคส stub ใหม่ เพราะ stub พิสูจน์ได้แค่หน้าจอ ไม่ใช่กฎ
- **ข้อควรระวัง:** ผู้ใช้ 9 บัญชี ห้อง E2E นาฬิกาฝั่งเซิร์ฟเวอร์ งานตามเวลา และการหยุด mailpit พร้อมแล้ว (global-setup.ts, support/*) · สิ่งอำนวยความสะดวกใน dev พร้อมแล้ว 2 รายการ (E2E Projector, E2E Whiteboard) มีเคสใช้แล้ว §B4 · เคสที่รอ EX จาก req (OQ-T1-11, 12) · เคสออกจากระบบ §B3 มีสคริปต์แล้ว (t1-logout.spec.ts) แต่ AC-112 พิสูจน์ที่ชั้น [stub] เท่านั้น · มี 8 เคส [stub] เดิมนอก T1 (booking.spec.ts, nfr-005) ซึ่งไม่ใช่เคสใหม่

## A) Test Condition

| Condition ID | Condition | Source (BR / EX) |
|---|---|---|
| TCND-001-01 | ช่วงเวลาที่จบเท่ากับเริ่มของอีกรายการ ไม่ทับ (ขอบ [start,end)) | BR-mrr-001 · EX-mrr-001 |
| TCND-001-02 | ทับกัน 1 นาที ต้องปฏิเสธ | BR-mrr-001 · EX-mrr-002 |
| TCND-001-03 | การจอง PENDING_APPROVAL กันช่วงเวลา | BR-mrr-001 · EX-mrr-003 |
| TCND-001-04 | การจองที่ถูกยกเลิกไม่กันช่วงเวลา | BR-mrr-001 · EX-mrr-004 |
| TCND-001-05 | ค้นหาห้องว่าง: แสดงเฉพาะห้องที่ความจุพอ ไม่ถูกจองทับ · ไม่พบห้องแสดงข้อความแนะนำ | BR-mrr-001 · EX-mrr-106, 107 |
| TCND-001-06 | ค้นหาห้องว่าง: การจองรออนุมัติกันช่วงเวลา · ห้องปิดปรับปรุงไม่แสดง | BR-mrr-001 · EX-mrr-108 |
| TCND-002-01 | หัวข้อ+ผู้เข้าร่วมครบ อุปกรณ์เสริมไม่บังคับ | BR-mrr-002 · EX-mrr-005 |
| TCND-002-02 | ขาดหัวข้อ | BR-mrr-002 · EX-mrr-006 |
| TCND-002-03 | ขาดผู้เข้าร่วม | BR-mrr-002 · EX-mrr-007 |
| TCND-002-04 | เลือกอุปกรณ์เสริม 1 รายการ → การจองบันทึกอุปกรณ์นั้น | BR-mrr-002 · EX-mrr-119 |
| TCND-003-01 | แก้ไข/ยกเลิกของตัวเอง | BR-mrr-003 · EX-mrr-008, 009 |
| TCND-003-02 | แก้ไข/ยกเลิกของผู้อื่น (ยิงตรง) ต้องปฏิเสธ | BR-mrr-003 · EX-mrr-010 |
| TCND-003-03 | หน้าการจองของฉันแสดงเฉพาะของตัวเอง | BR-mrr-003 · EX-mrr-011 |
| TCND-004-01 | ห้องต้องอนุมัติ → PENDING_APPROVAL → CONFIRMED | BR-mrr-004 · EX-mrr-012, 013 |
| TCND-004-02 | ผู้จองอนุมัติเองไม่ได้ | BR-mrr-004 · EX-mrr-014 |
| TCND-004-03 | ห้องไม่ต้องอนุมัติ → CONFIRMED ทันที | BR-mrr-004 · EX-mrr-001 |
| TCND-005-01 | เพิ่ม/แก้/ปิดปรับปรุงห้อง โดย RA | BR-mrr-005 · EX-mrr-015, 016 |
| TCND-005-02 | General User / System Administrator ทำไม่ได้ | BR-mrr-005 · EX-mrr-017, 018, 090 |
| TCND-005-03 | ลบห้อง = ARCHIVED ไม่แสดงในค้นหา/จอง โดย RA | BR-mrr-005 · EX-mrr-109 |
| TCND-005-04 | ผู้ที่ไม่ใช่ RA ลบห้องไม่ได้ ห้องไม่เปลี่ยน | BR-mrr-005 · EX-mrr-110 |
| TCND-006-01 | อัตราการใช้งาน = นาทีที่จองใช้ได้ ÷ นาทีทำการ × 100 ปัด round half up 2 ตำแหน่ง | BR-mrr-006 · EX-mrr-084 |
| TCND-006-02 | ขอบเขตชั่วโมงทำการ (หลัง 18:00 / เสาร์ไม่นับ) | BR-mrr-006 · EX-mrr-085 |
| TCND-006-03 | ตัวหารหักช่วงปิดปรับปรุง | BR-mrr-006 · EX-mrr-086 |
| TCND-006-04 | ตัวหาร 0 แสดง '—' ไม่จัดอันดับ | BR-mrr-006 · EX-mrr-087 |
| TCND-007-01 | จองสำเร็จ → Email ถึงผู้จองเท่านั้น | BR-mrr-007 · EX-mrr-019 |
| TCND-007-02 | ใกล้เริ่ม/เปลี่ยนเวลา → ถึงผู้จองและผู้เข้าร่วมทุกคน | BR-mrr-007 · EX-mrr-020, 021 |
| TCND-007-03 | แก้เฉพาะหัวข้อไม่ส่ง Email | BR-mrr-007 · EX-mrr-022 |
| TCND-007-04 | การจองรออนุมัติยังไม่ส่ง 'จองสำเร็จ' (กฎ v2) | BR-mrr-007 · EX-mrr-114 |
| TCND-007-05 | อนุมัติ → Email 'อนุมัติแล้ว' ถึงผู้จองเท่านั้น (กฎ v2) | BR-mrr-007 · EX-mrr-115 |
| TCND-007-06 | ยกเลิก (ผู้จอง/RA) → Email 'ยกเลิกการจอง' ถึงผู้จองและผู้เข้าร่วมทุกคน (กฎ v2) | BR-mrr-007 · EX-mrr-116, 117 |
| TCND-007-07 | ปฏิเสธ → Email 'ปฏิเสธการจอง' ถึงผู้จองและผู้เข้าร่วมทุกคน (กฎ v2) | BR-mrr-007 · EX-mrr-118 |
| TCND-008-01 | เตือน 15 นาทีก่อนเริ่ม ขอบ 09:44/09:45 | BR-mrr-008 · EX-mrr-020, 023 |
| TCND-008-02 | จองเมื่อเหลือ < 15 นาที เตือนทันที | BR-mrr-008 · EX-mrr-024 |
| TCND-008-03 | PENDING_APPROVAL ไม่เตือน | BR-mrr-008 · EX-mrr-025 |
| TCND-009-01 | ก่อนเริ่ม/ที่เริ่มพอดี ผู้จองยกเลิกเอง | BR-mrr-009 · EX-mrr-026, 027 |
| TCND-009-02 | RA ยกเลิกแทน ต้องมีเหตุผล | BR-mrr-009 · EX-mrr-028, 029 |
| TCND-009-03 | System Administrator ไม่มีปุ่มแก้/ยกเลิกแทน | BR-mrr-009 · EX-mrr-088 |
| TCND-010-01 | ห้องแก้เป็นต้องอนุมัติ → การจองที่ยังไม่เริ่มกลับเป็นรออนุมัติ | BR-mrr-010@v2 · EX-mrr-078 |
| TCND-010-02 | ห้องแก้เป็นไม่ต้องอนุมัติ → ใช้ได้ทันที | BR-mrr-010@v2 · EX-mrr-079 |
| TCND-010-03 | เริ่มพอดีเวลาที่แก้ นับว่าเริ่มแล้ว | BR-mrr-010@v2 · EX-mrr-080 |
| TCND-010-04 | การจองหลังแก้ใช้ค่าตั้งใหม่ · นับเวลาที่กดยืนยัน | BR-mrr-010@v2 · EX-mrr-030, 033 |
| TCND-010-05 | ความจุไม่บังคับจำนวนผู้เข้าร่วม | BR-mrr-010@v2 · EX-mrr-034 |
| TCND-011-01 | เปลี่ยนผลอนุมัติ/ปฏิเสธ ต้องมีเหตุผล | BR-mrr-011 · EX-mrr-035, 036 |
| TCND-011-02 | ขอบเขต 1 นาทีก่อนเริ่ม / เริ่มแล้ว | BR-mrr-011 · EX-mrr-037, 038 |
| TCND-011-03 | System Administrator ไม่เห็นปุ่มเปลี่ยนผล | BR-mrr-011 · EX-mrr-089 |
| TCND-012-01 | ห้องปิดปรับปรุงรับจองใหม่ไม่ได้ การจองเดิมคงไว้ | BR-mrr-012 · EX-mrr-016, 081 |
| TCND-012-02 | แก้เวลาการจองนับเป็นจองใหม่ | BR-mrr-012 · EX-mrr-082 |
| TCND-012-03 | เปิดห้องกลับแล้วจองได้ | BR-mrr-012 · EX-mrr-083 |
| TCND-012-04 | ค้นหาห้องว่างไม่แสดงห้องปิดปรับปรุง | BR-mrr-012 · EX-mrr-106, 107, 108 |
| TCND-013-01 | ห้องกำหนดผู้อนุมัติ เฉพาะผู้นั้นอนุมัติได้ | BR-mrr-013 · EX-mrr-039, 040 |
| TCND-013-02 | ยังไม่กำหนด RA ทุกคนอนุมัติได้ | BR-mrr-013 · EX-mrr-041 |
| TCND-013-03 | กำหนดผู้อนุมัติทีหลังได้ | BR-mrr-013 · EX-mrr-042 |
| TCND-014-01 | หลังจบประชุม แก้ → สร้างคำขอแก้ ค่าเดิมคงไว้ | BR-mrr-014 · EX-mrr-043 |
| TCND-014-02 | ก่อนจบประชุม แก้มีผลทันที | BR-mrr-014 · EX-mrr-044 |
| TCND-014-03 | RA คนอื่นอนุมัติคำขอได้ · คนแก้อนุมัติเองไม่ได้ | BR-mrr-014 · EX-mrr-045, 046 |
| TCND-015-01 | ออกรายงานซ้ำ → ฉบับใหม่ ฉบับเดิมเก็บ | BR-mrr-015 · EX-mrr-047 |
| TCND-015-02 | แก้ฉบับที่ออกแล้วไม่ได้ | BR-mrr-015 · EX-mrr-048 |
| TCND-015-03 | ฉบับเดิมไม่เปลี่ยนตามข้อมูลที่แก้ภายหลัง | BR-mrr-015 · EX-mrr-049 |
| TCND-016-01 | PENDING_APPROVAL ที่ถึงเวลาเริ่ม → ยกเลิกอัตโนมัติ ขอบ 09:59/10:00 | BR-mrr-016 · EX-mrr-050, 051 |
| TCND-016-02 | ส่ง Email ไม่สำเร็จ → ยังไม่ยกเลิก รอรอบถัดไป | BR-mrr-016 · EX-mrr-052 |
| TCND-016-03 | RA อนุมัติได้ระหว่างค้าง | BR-mrr-016 · EX-mrr-053 |
| TCND-017-01 | การกระทำของ RA ถูกบันทึก ใคร·เมื่อไหร่·ทำอะไร·เหตุผล | BR-mrr-017 · EX-mrr-054, 055 |
| TCND-017-02 | การกระทำของผู้จองเอง/ที่ล้มเหลว ไม่บันทึก | BR-mrr-017 · EX-mrr-056, 057 |
| TCND-017-03 | ค่าช่อง 'การกระทำ' ปฏิเสธการจอง / ถอยผล / แก้แทนผู้จอง (กฎ v2) | BR-mrr-017 · EX-mrr-118, 120, 121, 122 |
| TCND-018-01 | RA และ System Administrator ดูร่องรอยได้ | BR-mrr-018 · EX-mrr-058, 059 |
| TCND-018-02 | ผู้จอง/ผู้ใช้อื่นดูไม่ได้ | BR-mrr-018 · EX-mrr-060, 061 |
| TCND-019-01 | ส่ง Email ไม่สำเร็จ → การกระทำล้มทันที ไม่สร้าง/ไม่เปลี่ยน | BR-mrr-019 · EX-mrr-062, 063, 064 |
| TCND-019-02 | การกระทำที่ไม่ส่ง Email ไม่ล้มตาม | BR-mrr-019 · EX-mrr-065 |
| TCND-019-03 | Email ปกติ → จองสำเร็จ ไม่มีข้อความล้ม | BR-mrr-019 · EX-mrr-113 |
| TCND-020-01 | งานเตือนส่งไม่สำเร็จ → บันทึกส่งไม่สำเร็จ ไม่ส่งซ้ำ | BR-mrr-020 · EX-mrr-066, 067 |
| TCND-020-02 | ส่งเตือนสำเร็จครบทุกคน → บันทึก 'ส่งสำเร็จ' | BR-mrr-020 · EX-mrr-111 |
| TCND-020-03 | ผู้รับบางคนล้ม → นับล้มทั้งการจอง ไม่แยกรายคน (กฎ v2) | BR-mrr-020 · EX-mrr-112 |
| TCND-021-01 | ผู้จอง/ผู้เข้าร่วมเห็นรายละเอียดในปฏิทิน | BR-mrr-021 · EX-mrr-068, 069 |
| TCND-021-02 | คนอื่นเห็นแค่ 'ไม่ว่าง' | BR-mrr-021 · EX-mrr-070, 071 |
| TCND-022-01 | RA ดูรายงานได้ | BR-mrr-022 · EX-mrr-072 |
| TCND-022-02 | System Administrator / General User ดูไม่ได้ | BR-mrr-022 · EX-mrr-073, 074 |
| TCND-023-01 | เตือนครั้งเดียวต่อการจอง | BR-mrr-023 · EX-mrr-075 |
| TCND-023-02 | งานรันซ้ำต้องข้าม | BR-mrr-023 · EX-mrr-076 |
| TCND-023-03 | Email ที่ส่งทันทีตอนจองนับเป็นครั้งเดียว | BR-mrr-023 · EX-mrr-077 |
| TCND-024-01 | ส่งรหัสไม่สำเร็จ → ล้มทันที ไม่มีคิวส่งซ้ำ | BR-mrr-024 · EX-mrr-092, 093 |
| TCND-024-02 | ขอใหม่หลังล้ม ไม่ถูกกันการขอซ้ำ | BR-mrr-024 · EX-mrr-094 |
| TCND-024-03 | ขอรหัสสำเร็จ ข้อความเป็นกลาง | BR-mrr-024 · EX-mrr-091 |
| TCND-025-01 | ขอซ้ำขณะรหัสยังใช้ได้ → error ไม่ออกรหัสใหม่ | BR-mrr-025 · EX-mrr-095 |
| TCND-025-02 | หมดอายุพอดี 10:00 ขอใหม่ได้ | BR-mrr-025 · EX-mrr-096 |
| TCND-025-03 | รหัสถูกใช้แล้วขอใหม่ได้ | BR-mrr-025 · EX-mrr-097 |
| TCND-026-01 | Email นอกรายชื่อ/บัญชีไม่ active ได้ข้อความเดียวกัน แต่ไม่ส่งรหัส | BR-mrr-026 · EX-mrr-098, 099 |
| TCND-026-02 | Email ในรายชื่อได้รหัส | BR-mrr-026 · EX-mrr-091 |
| TCND-027-01 | รหัส 6 หลักอายุ 10 นาที ขอบ 09:59/10:00 | BR-mrr-027 · EX-mrr-100, 101 |
| TCND-027-02 | รหัสกับ magic link ใช้ร่วมกันครั้งเดียว | BR-mrr-027 · EX-mrr-102, 103 |
| TCND-028-01 | รหัสผิด/หมดอายุ/ถูกใช้ ไม่สร้าง session | BR-mrr-028 · EX-mrr-101, 102, 104 |
| TCND-028-02 | กรอกผิดไม่ทำให้รหัสเสีย | BR-mrr-028 · EX-mrr-105 |

หมายเหตุ: BR-mrr-010@v1 ถูก @v2 แทน — ไม่แตก condition จาก v1 (ดู OQ-T1-06)

## B) Test Case

### B1. เคสที่มีสคริปต์แล้ว — ใช้ TC ID เดิม ไม่สร้างซ้ำ

| EX | TC เดิม | หมายเหตุ |
|---|---|---|
| EX-mrr-001 | TC-BKG-UI006-019 |  |
| EX-mrr-002 | TC-BKG-UI006-020 |  |
| EX-mrr-003 | TC-BKG-UI006-021 | ผู้จองคนเดียวกัน ยังไม่พิสูจน์ "ผู้ใช้อีกคน" |
| EX-mrr-005 | เคส #8, #10 (booking.spec.ts) |  |
| EX-mrr-006 | TC-BKG-UI006-023 |  |
| EX-mrr-007 | TC-BKG-UI006-024 |  |
| EX-mrr-012 | TC-BKG-UI006-025 |  |
| EX-mrr-062 | TC-BKG-UI006-027 (stub) · TC-BKG-UI006-109 (real · §B9) | พิสูจน์ที่ชั้น stub เท่านั้น ไม่พิสูจน์ว่า "ไม่เกิดการจอง" (DQ-mrr-005 open) |
| EX-mrr-119 | TC-BKG-UI006-104 (§B4 · ผูกเพิ่มตามคำตัดสิน QA 2026-11-18) |  |
| EX-mrr-019 | TC-BKG-UI006-026 · TC-BKG-UI006-108 (§B9 ส่วน U2/U3 ไม่ได้รับ) (บางส่วน) | เสนอเพิ่ม assertion ใน TC เดิมว่า U2/U3 ไม่ได้รับอีเมล — ต้องมีผู้ใช้ที่สอง/สาม |

### B2. เคสใหม่ (118 เคส)

คอลัมน์เต็มอยู่ใน CSV · ตารางนี้แสดงคอลัมน์สำคัญ · Pre-condition/Test Data/Steps/Expected เต็มดูใน CSV

| TC ID | Requirement ID | Type | Priority | Data Source | Automation | Script | Scenario (เมื่อ) | Expected Result (ต้องได้) |
|---|---|---|---|---|---|---|---|---|
| TC-BKG-UI006-022 | BR-mrr-001@v1 / EX-mrr-004 | Positive | Critical | real | Partial | t1-roles.spec.ts | [alternate] ผู้ใช้อีกคนจองห้อง A เวลา 09:00–10:00 | [Explicit EX-mrr-004] ระบบรับการจอง และแสดงข้อความ 'จองห้องสำเร็จ' — การจองที่ถูกยกเลิกไม่กันช่วงเวลา |
| TC-MYB-UI008-101 | BR-mrr-003@v1 / EX-mrr-008 | Positive | Critical | real | Yes | t1-yes.spec.ts | [happy] U1 แก้หัวข้อเป็น 'ประชุมวางแผน' แล้วกดบันทึก | [Explicit EX-mrr-008] ระบบบันทึกการแก้ไข และแสดงข้อความ 'บันทึกการแก้ไขสำเร็จ' |
| TC-MYB-UI007-101 | BR-mrr-003@v1 / EX-mrr-009 | Positive | Critical | real | Yes | t1-yes.spec.ts | [happy] U1 กดยกเลิกการจองนี้ | [Explicit EX-mrr-009] ระบบยกเลิกการจอง และแสดงข้อความ 'ยกเลิกการจองสำเร็จ' |
| TC-MYB-UI007-102 | BR-mrr-003@v1 / EX-mrr-010 | Negative | Critical | real | Partial | t1-roles.spec.ts | [exception] U2 ส่งคำสั่งยกเลิกการจองนี้ (แม้หน้าจอจะซ่อนปุ่มไว้) | [Explicit EX-mrr-010] ระบบไม่ยกเลิก การจองคงเดิม และแสดงข้อความ 'เฉพาะผู้จองเท่านั้นที่แก้ไขหรือยกเลิกได้' |
| TC-MYB-UI007-103 | BR-mrr-003@v1 / EX-mrr-011 | Positive | Critical | real | Partial | t1-roles.spec.ts | [alternate] U1 เปิดหน้า My Bookings | [Explicit EX-mrr-011] รายการแสดงเฉพาะการจองห้อง A 10:00–11:00 ที่ U1 สร้างเอง ไม่แสดงการจองห้อง B ของ U2 |
| TC-APR-UI009-101 | BR-mrr-004@v1 / EX-mrr-013 | Positive | High | real | Partial | t1-roles.spec.ts | [happy] Room Administrator กดอนุมัติการจองนี้ | [Explicit EX-mrr-013] การจองเปลี่ยนเป็นสถานะ 'อนุมัติแล้ว' ใช้ห้องได้ และ Room Administrator เห็นข้อความ 'อนุมัติการจองสำเร็จ' |
| TC-APR-UI009-102 | BR-mrr-004@v1 / EX-mrr-014 | Negative | High | real | Partial | t1-roles.spec.ts | [exception] U1 ส่งคำสั่งอนุมัติการจองของตัวเอง | [Explicit EX-mrr-014] สถานะยังเป็น 'รออนุมัติ' และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่อนุมัติได้' |
| TC-RMM-UI013-101 | BR-mrr-005@v1 / EX-mrr-015 | Positive | Critical | real | Partial | t1-rooms.spec.ts | [happy] Room Administrator เพิ่มห้อง C ความจุ 10 คน แล้วกดบันทึก | [Explicit EX-mrr-015] ระบบสร้างห้อง C และแสดงข้อความ 'บันทึกข้อมูลห้องสำเร็จ' |
| TC-RMM-UI012-101 | BR-mrr-005@v1 / BR-mrr-012@v1 / EX-mrr-016 | Positive | Critical | real | Partial | t1-roles.spec.ts | [happy] Room Administrator ตั้งห้อง A เป็นปิดปรับปรุง | [Explicit EX-mrr-016] ห้อง A เป็นสถานะปิดปรับปรุง การจองพรุ่งนี้ 10:00–11:00 คงเดิม และแสดงข้อความ 'ตั้งห้องเป็นปิดปรับปรุงแล้ว การจองที่มีอยู่คงเดิม' |
| TC-RMM-UI013-102 | BR-mrr-005@v1 / EX-mrr-017 | Negative | Critical | real | Yes | t1-yes.spec.ts | [exception] General User ส่งคำสั่งแก้ความจุห้อง A เป็น 12 คน | [Explicit EX-mrr-017] ความจุห้อง A ยังเป็น 8 คน และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้' |
| TC-RMM-UI013-103 | BR-mrr-005@v1 / EX-mrr-018 | Negative | Critical | real | Partial | t1-roles.spec.ts | [exception] System Administrator ส่งคำสั่งแก้ความจุห้อง A เป็น 12 คน | [Explicit EX-mrr-018] ความจุห้อง A ยังเป็น 8 คน และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้' |
| TC-NTF-JOB-101 | BR-mrr-007@v2 / BR-mrr-008@v1 / EX-mrr-020 | Positive | High | real | Yes | t1-jobs.spec.ts | [happy] ถึงเวลา 09:45 วันที่ 17/10 | [Explicit EX-mrr-020] U1, U2 และ U3 ได้รับ Email หัวเรื่อง '[จองห้องประชุม] ใกล้ถึงเวลาประชุม: ประชุมทีม · ห้อง A 17/10 10:00–11:00' |
| TC-NTF-UI008-101 | BR-mrr-007@v2 / EX-mrr-021 | Positive | Medium | real | Partial | t1-clock.spec.ts | [happy] U1 เปลี่ยนเวลาเป็น 14:00–15:00 | [Explicit EX-mrr-021] U1, U2 และ U3 ได้รับ Email หัวเรื่อง '[จองห้องประชุม] เปลี่ยนเวลา: ประชุมทีม · ห้อง A 17/10 14:00–15:00' |
| TC-NTF-UI008-102 | BR-mrr-007@v2 / EX-mrr-022 | Positive | Medium | real | Yes | t1-yes.spec.ts | [alternate] U1 แก้หัวข้อเป็น 'ประชุมวางแผน' โดยไม่เปลี่ยนเวลา | [Explicit EX-mrr-022] ระบบบันทึกการแก้ไข แสดงข้อความ 'บันทึกการแก้ไขสำเร็จ' และไม่มีใครได้รับ Email |
| TC-NTF-JOB-102 | BR-mrr-008@v1 / EX-mrr-023 | Boundary | High | real | Yes | t1-jobs.spec.ts | [boundary] ถึงเวลา 09:44 วันที่ 17/10 | [Explicit EX-mrr-023] ยังไม่มีใครได้รับ Email หัวเรื่อง '[จองห้องประชุม] ใกล้ถึงเวลาประชุม: ประชุมทีม · ห้อง A 17/10 10:00–11:00' |
| TC-NTF-UI006-101 | BR-mrr-008@v1 / EX-mrr-024 | Boundary | High | real | Yes | t1-clock.spec.ts | [boundary] U1 จองห้อง A 17/10 10:00–11:00 หัวข้อ 'ประชุมด่วน' ผู้เข้าร่วม U2 | [Explicit EX-mrr-024] U1 ได้รับ Email หัวเรื่อง '[จองห้องประชุม] จองสำเร็จ: ประชุมด่วน · ห้อง A 17/10 10:00–11:00' และ U1, U2 ได้รับ Email หัวเรื่อง '[จองห้องประชุม] ใกล้ถึงเวลาประชุม: ประชุมด่วน · ห้อง A 17/10 10:00–11:00' ทันที |
| TC-NTF-JOB-103 | BR-mrr-008@v1 / EX-mrr-025 | Negative | High | real | Yes | t1-jobs.spec.ts | [exception] ถึงเวลา 09:45 วันที่ 17/10 | [Explicit EX-mrr-025] ไม่มีใครได้รับ Email หัวเรื่อง '[จองห้องประชุม] ใกล้ถึงเวลาประชุม: ประชุมลูกค้า · ห้อง B 17/10 10:00–11:00' |
| TC-MYB-UI007-104 | BR-mrr-009@v1 / EX-mrr-026 | Boundary | High | real | Yes | t1-clock.spec.ts | [boundary] U1 กดยกเลิกการจองนี้ | [Explicit EX-mrr-026] ระบบยกเลิกการจอง และแสดงข้อความ 'ยกเลิกการจองสำเร็จ' |
| TC-MYB-UI007-105 | BR-mrr-009@v1 / EX-mrr-027 | Boundary | High | real | Yes | t1-clock.spec.ts | [boundary] U1 กดยกเลิกการจองนี้ | [Explicit EX-mrr-027] การจองคงเดิม และแสดงข้อความ 'การประชุมเริ่มแล้ว กรุณาติดต่อผู้ดูแลห้องเพื่อแก้ไขหรือยกเลิก' |
| TC-APR-UI010-101 | BR-mrr-009@v1 / EX-mrr-028 | Positive | High | real | Partial | t1-roles.spec.ts | [happy] Room Administrator ยกเลิกการจองนี้แทน U1 พร้อมเหตุผล 'ห้องต้องใช้จัดงานด่วน' | [Explicit EX-mrr-028] ระบบยกเลิกการจอง และ Room Administrator เห็นข้อความ 'ยกเลิกการจองสำเร็จ' |
| TC-APR-UI010-102 | BR-mrr-009@v1 / EX-mrr-029 | Negative | High | real | Partial | t1-roles.spec.ts | [exception] Room Administrator ยกเลิกการจองนี้แทน U1 โดยเว้นช่องเหตุผลว่าง | [Explicit EX-mrr-029] การจองคงเดิม และแสดงข้อความ 'กรุณาระบุเหตุผล' |
| TC-BKG-UI006-101 | BR-mrr-010@v2 / EX-mrr-030 | Positive | High | real | Partial | t1-clock.spec.ts | [happy] วันที่ 16/10 เวลา 11:00 U2 จองห้อง A 18/10 13:00–14:00 หัวข้อ 'ประชุมทีม' ผู้เข้าร่วม 2 คน | [Explicit EX-mrr-030] การจองมีสถานะ 'รออนุมัติ' ยังใช้ห้องไม่ได้ และแสดงข้อความ 'ส่งคำขอจองแล้ว รอการอนุมัติ' — การจองที่สร้างหลังการแก้ใช้ค่าตั้งใหม่ |
| TC-RMM-UI013-108 | BR-mrr-010@v2 / EX-mrr-031 | Negative | High | real | Yes | t1-clock.spec.ts | [exception] Room Administrator เปิดรายการการจองที่ 'รออนุมัติ' | [Explicit EX-mrr-031] การจองของ U1 วันที่ 18/10 10:00–11:00 เปลี่ยนเป็นสถานะ 'รออนุมัติ' ยังใช้ห้องไม่ได้ และอยู่ในรายการ 'รออนุมัติ' — การจองเดิมที่ยังไม่ถึงเวลาเริ่มกลับไปรออนุมัติ |
| TC-RMM-UI013-109 | BR-mrr-010@v2 / EX-mrr-032 | Negative | High | real | Yes | t1-clock.spec.ts | [exception] วันที่ 16/10 เวลา 11:00 Room Administrator เปิดรายการการจองที่ 'รออนุมัติ' | [Explicit EX-mrr-032] การจองของ U1 ไม่อยู่ในรายการ 'รออนุมัติ' และใช้ห้องได้ทันทีโดยไม่ขึ้นสถานะ 'อนุมัติแล้ว' (เหมือนจองห้องที่ไม่ต้องอนุมัติ) — ไม่ต้องรอ Room Administrator กดอนุมัติ |
| TC-BKG-UI006-102 | BR-mrr-010@v2 / EX-mrr-033 | Boundary | High | real | Yes | t1-clock.spec.ts | [boundary] วันที่ 16/10 เวลา 10:01 U2 กดยืนยันการจองจากฟอร์มที่เปิดไว้ หัวข้อ 'ประชุมย่อย' ผู้เข้าร่วม 1 คน | [Explicit EX-mrr-033] การจองมีสถานะ 'รออนุมัติ' และแสดงข้อความ 'ส่งคำขอจองแล้ว รอการอนุมัติ' — นับเวลาสร้างที่กดยืนยัน ไม่ใช่เวลาที่เปิดฟอร์ม |
| TC-BKG-UI006-103 | BR-mrr-010@v2 / EX-mrr-034 | Positive | High | real | Partial | t1-clock.spec.ts | [alternate] วันที่ 16/10 เวลา 11:00 U2 จองห้อง A 18/10 13:00–14:00 หัวข้อ 'ประชุมใหญ่' ผู้เข้าร่วม 6 คน | [Explicit EX-mrr-034] ระบบรับการจองของ U2 และแสดงข้อความ 'จองห้องสำเร็จ' · การจองของ U1 (ผู้เข้าร่วม 8 คน) คงเดิมและยังใช้ห้องได้ — ความจุไม่บังคับจำนวนผู้เข้าร่วม ทั้งการจองเดิมและการจองที่สร้างหลังการแก้ |
| TC-APR-UI010-103 | BR-mrr-011@v1 / EX-mrr-035 | Positive | High | real | Partial | t1-roles.spec.ts | [happy] Room Administrator เปลี่ยนผลเป็นปฏิเสธ พร้อมเหตุผล 'อนุมัติผิดห้อง' | [Explicit EX-mrr-035] การจองเปลี่ยนเป็นสถานะ 'ปฏิเสธแล้ว' และ Room Administrator เห็นข้อความ 'เปลี่ยนผลการอนุมัติสำเร็จ' |
| TC-APR-UI010-104 | BR-mrr-011@v1 / EX-mrr-036 | Negative | High | real | Partial | t1-roles.spec.ts | [exception] Room Administrator เปลี่ยนผลเป็นปฏิเสธ โดยเว้นช่องเหตุผลว่าง | [Explicit EX-mrr-036] สถานะยังเป็น 'อนุมัติแล้ว' และแสดงข้อความ 'กรุณาระบุเหตุผล' |
| TC-APR-UI010-105 | BR-mrr-011@v1 / EX-mrr-037 | Boundary | High | real | Yes | t1-clock.spec.ts | [boundary] Room Administrator เปลี่ยนผลเป็นอนุมัติ พร้อมเหตุผล 'ปฏิเสธผิดคน' | [Explicit EX-mrr-037] การจองเปลี่ยนเป็นสถานะ 'อนุมัติแล้ว' และ Room Administrator เห็นข้อความ 'เปลี่ยนผลการอนุมัติสำเร็จ' — 1 นาทีก่อนเริ่มยังเปลี่ยนได้ |
| TC-APR-UI010-106 | BR-mrr-011@v1 / EX-mrr-038 | Boundary | High | real | Yes | t1-clock.spec.ts | [boundary] Room Administrator เปลี่ยนผลเป็นปฏิเสธ พร้อมเหตุผล 'อนุมัติผิดห้อง' | [Explicit EX-mrr-038] สถานะยังเป็น 'อนุมัติแล้ว' และแสดงข้อความ 'การประชุมเริ่มแล้ว ไม่สามารถเปลี่ยนผลการอนุมัติได้' |
| TC-APR-UI009-103 | BR-mrr-013@v1 / EX-mrr-039 | Positive | High | real | Partial | t1-roles.spec.ts | [happy] RA1 กดอนุมัติการจองนี้ | [Explicit EX-mrr-039] การจองเปลี่ยนเป็นสถานะ 'อนุมัติแล้ว' และ RA1 เห็นข้อความ 'อนุมัติการจองสำเร็จ' |
| TC-APR-UI009-104 | BR-mrr-013@v1 / EX-mrr-040 | Negative | High | real | Partial | t1-roles.spec.ts | [exception] RA2 กดอนุมัติการจองนี้ | [Explicit EX-mrr-040] สถานะยังเป็น 'รออนุมัติ' และแสดงข้อความ 'เฉพาะผู้อนุมัติประจำห้องนี้เท่านั้นที่อนุมัติได้' |
| TC-APR-UI009-105 | BR-mrr-013@v1 / EX-mrr-041 | Positive | High | real | Partial | t1-roles.spec.ts | [alternate] RA2 กดอนุมัติการจองนี้ | [Explicit EX-mrr-041] การจองเปลี่ยนเป็นสถานะ 'อนุมัติแล้ว' และ RA2 เห็นข้อความ 'อนุมัติการจองสำเร็จ' — ห้องที่ยังไม่กำหนด Room Administrator ทุกคนอนุมัติได้ |
| TC-RMM-UI013-104 | BR-mrr-013@v1 / EX-mrr-042 | Positive | High | real | Partial | t1-roles.spec.ts | [happy] Room Administrator แก้ข้อมูลห้อง B กำหนดผู้อนุมัติประจำห้องเป็น RA1 แล้วกดบันทึก | [Explicit EX-mrr-042] ผู้อนุมัติประจำห้อง B เป็น RA1 และแสดงข้อความ 'บันทึกข้อมูลห้องสำเร็จ' — กำหนดทีหลังได้ |
| TC-APR-UI010-107 | BR-mrr-014@v1 / EX-mrr-043 | Boundary | High | real | Yes | t1-clock.spec.ts | [boundary] RA1 แก้หัวข้อเป็น 'ประชุมวางแผน' พร้อมเหตุผล 'ผู้จองพิมพ์หัวข้อผิด' แล้วกดบันทึก | [Explicit EX-mrr-043] ระบบสร้างคำขอแก้ไข หัวข้อของการจองยังเป็น 'ประชุมทีม' และ RA1 เห็นข้อความ 'ส่งคำขอแก้ไขแล้ว รอผู้ดูแลห้องคนอื่นอนุมัติ' |
| TC-APR-UI010-108 | BR-mrr-014@v1 / EX-mrr-044 | Boundary | High | real | Partial | t1-clock.spec.ts | [boundary] RA1 แก้หัวข้อเป็น 'ประชุมวางแผน' พร้อมเหตุผล 'ผู้จองพิมพ์หัวข้อผิด' แล้วกดบันทึก | [Explicit EX-mrr-044] หัวข้อของการจองเปลี่ยนเป็น 'ประชุมวางแผน' ทันที ไม่มีคำขอแก้ไข และ RA1 เห็นข้อความ 'บันทึกการแก้ไขสำเร็จ' |
| TC-APR-UI011-101 | BR-mrr-014@v1 / EX-mrr-045 | Positive | High | real | Yes | t1-clock.spec.ts | [happy] RA2 กดอนุมัติคำขอแก้ไขนี้ | [Explicit EX-mrr-045] หัวข้อของการจองเปลี่ยนเป็น 'ประชุมวางแผน' และ RA2 เห็นข้อความ 'อนุมัติคำขอแก้ไขสำเร็จ' |
| TC-APR-UI011-102 | BR-mrr-014@v1 / EX-mrr-046 | Negative | High | real | Yes | t1-clock.spec.ts | [exception] RA1 กดอนุมัติคำขอแก้ไขของตัวเอง | [Explicit EX-mrr-046] หัวข้อของการจองยังเป็น 'ประชุมทีม' คำขอยังรออนุมัติ และแสดงข้อความ 'ผู้แก้ไขอนุมัติคำขอของตัวเองไม่ได้ ต้องให้ผู้ดูแลห้องคนอื่นอนุมัติ' |
| TC-RPT-RPT001-101 | BR-mrr-015@v1 / EX-mrr-047 | Positive | Medium | real | Partial | t1-reports.spec.ts | [happy] Room Administrator สั่งออกรายงานเดือน ต.ค. 2569 อีกครั้ง | [Explicit EX-mrr-047] ระบบสร้างรายงานฉบับที่ 2 ที่คิดจากข้อมูลการจองล่าสุด ฉบับที่ 1 ยังอยู่ในรายการรายงาน และแสดงข้อความ 'ออกรายงานฉบับใหม่แล้ว ฉบับเดิมยังเก็บไว้' |
| TC-RPT-RPT001-102 | BR-mrr-015@v1 / EX-mrr-048 | Negative | Medium | real | Partial | t1-reports.spec.ts | [exception] Room Administrator ส่งคำสั่งแก้ตัวเลขชั่วโมงที่ถูกจองของห้อง A ในรายงานฉบับที่ 1 | [Explicit EX-mrr-048] ตัวเลขในฉบับที่ 1 คงเดิม และแสดงข้อความ 'รายงานที่ออกแล้วแก้ไขไม่ได้ กรุณาออกฉบับใหม่' |
| TC-RPT-RPT001-103 | BR-mrr-015@v1 / EX-mrr-049 | Boundary | Medium | real | Partial | t1-reports.spec.ts | [boundary] Room Administrator เปิดดูรายงานเดือน ต.ค. 2569 ฉบับที่ 1 | [Explicit EX-mrr-049] ฉบับที่ 1 แสดงตัวเลขทุกค่าเท่ากับตอนออกเมื่อ 1/11 ไม่เปลี่ยนตามข้อมูลการจองที่แก้ทีหลัง — ตัวเลขที่เปลี่ยนแล้วอยู่ในฉบับที่ 2 เท่านั้น |
| TC-APR-JOB-101 | BR-mrr-016@v1 / EX-mrr-050 | Boundary | High | real | Yes | t1-jobs.spec.ts | [boundary] งานตามเวลารันตอน 18/10 09:59 | [Explicit EX-mrr-050] การจองยังเป็นสถานะ 'รออนุมัติ' ช่วงเวลายังถูกกันไว้ และ U1 ไม่ได้รับ Email — ยังไม่ถึงเวลาเริ่ม |
| TC-APR-JOB-102 | BR-mrr-016@v1 / EX-mrr-051 | Positive | High | real | Yes | t1-jobs.spec.ts | [happy] งานตามเวลารันตอน 18/10 10:00 และส่ง Email ถึง U1 สำเร็จ | [Explicit EX-mrr-051] การจองเปลี่ยนเป็นสถานะ 'ยกเลิกแล้ว' ช่วง 10:00–11:00 ของห้อง B ว่างให้จองได้ และ U1 ได้รับ Email หัวเรื่อง '[จองห้องประชุม] ยกเลิกอัตโนมัติ: ประชุมลูกค้า · ห้อง B 18/10 10:00–11:00' |
| TC-APR-JOB-103 | BR-mrr-016@v1 / EX-mrr-052 | Exception | High | real | Yes | t1-jobs.spec.ts | [exception] งานตามเวลารันตอน 18/10 10:00 แต่ส่ง Email ถึง U1 ไม่สำเร็จ | [Explicit EX-mrr-052] การจองยังเป็นสถานะ 'รออนุมัติ' ช่วงเวลายังถูกกันไว้ และรองานตามเวลารอบถัดไปลองยกเลิกและส่ง Email ใหม่ |
| TC-APR-UI009-106 | BR-mrr-016@v1 / EX-mrr-053 | Positive | High | real | Yes | t1-jobs.spec.ts | [alternate] Room Administrator กดอนุมัติการจองนี้ก่อนงานรอบถัดไปรัน | [Explicit EX-mrr-053] การจองเปลี่ยนเป็นสถานะ 'อนุมัติแล้ว' Room Administrator เห็นข้อความ 'อนุมัติการจองสำเร็จ' และงานรอบถัดไปไม่ยกเลิกการจองนี้ |
| TC-AUD-UI010-101 | BR-mrr-017@v2 / EX-mrr-054 | Positive | Medium | real | Partial | t1-roles.spec.ts | [happy] 16/10 14:05 RA1 กดอนุมัติการจองนี้ แล้วเปิดดูร่องรอยของการจองนี้ | [Explicit EX-mrr-054] RA1 เห็นข้อความ 'อนุมัติการจองสำเร็จ' และร่องรอยมีรายการใหม่ 1 รายการ: ผู้ทำ RA1 · เวลา 16/10 14:05 · การกระทำ 'อนุมัติ' · เหตุผล '—' |
| TC-AUD-UI010-102 | BR-mrr-017@v2 / EX-mrr-055 | Positive | Medium | real | Partial | t1-clock.spec.ts | [happy] RA1 ยกเลิกการจองนี้แทน U1 พร้อมเหตุผล 'ห้องต้องใช้จัดงานด่วน' แล้วเปิดดูร่องรอยของการจองนี้ | [Explicit EX-mrr-055] RA1 เห็นข้อความ 'ยกเลิกการจองสำเร็จ' และร่องรอยมีรายการใหม่ 1 รายการ: ผู้ทำ RA1 · เวลา 18/10 10:30 · การกระทำ 'ยกเลิกแทนผู้จอง' · เหตุผล 'ห้องต้องใช้จัดงานด่วน' |
| TC-AUD-UI010-103 | BR-mrr-017@v2 / EX-mrr-056 | Negative | Medium | real | Partial | t1-roles.spec.ts | [exception] U1 กดยกเลิกการจองของตัวเอง แล้ว Room Administrator เปิดดูร่องรอยของการจองนี้ | [Explicit EX-mrr-056] U1 เห็นข้อความ 'ยกเลิกการจองสำเร็จ' และร่องรอยของการจองนี้ไม่มีรายการใหม่ — การกระทำของผู้จองเองไม่บันทึกร่องรอย |
| TC-AUD-UI010-104 | BR-mrr-017@v2 / EX-mrr-057 | Negative | Medium | real | Partial | t1-roles.spec.ts | [exception] RA1 ยกเลิกการจองนี้แทน U1 โดยเว้นช่องเหตุผลว่าง แล้วเปิดดูร่องรอยของการจองนี้ | [Explicit EX-mrr-057] การจองคงเดิม แสดงข้อความ 'กรุณาระบุเหตุผล' และร่องรอยของการจองนี้ไม่มีรายการใหม่ — การกระทำที่ไม่สำเร็จไม่บันทึกร่องรอย |
| TC-AUD-UI010-105 | BR-mrr-018@v1 / EX-mrr-058 | Positive | Critical | real | Partial | t1-roles.spec.ts | [happy] RA2 เปิดดูร่องรอยของการจองนี้ | [Explicit EX-mrr-058] RA2 เห็นร่องรอย 1 รายการ: ผู้ทำ RA1 · เวลา 18/10 10:30 · การกระทำ 'ยกเลิกแทนผู้จอง' · เหตุผล 'ห้องต้องใช้จัดงานด่วน' |
| TC-AUD-UI010-106 | BR-mrr-018@v1 / EX-mrr-059 | Positive | Critical | real | Partial | t1-roles.spec.ts | [happy] System Administrator เปิดดูร่องรอยของการจองนี้ | [Explicit EX-mrr-059] System Administrator เห็นร่องรอย 1 รายการ: ผู้ทำ RA1 · เวลา 18/10 10:30 · การกระทำ 'ยกเลิกแทนผู้จอง' · เหตุผล 'ห้องต้องใช้จัดงานด่วน' |
| TC-AUD-UI010-107 | BR-mrr-018@v1 / EX-mrr-060 | Negative | Critical | real | Partial | t1-roles.spec.ts | [exception] U1 ส่งคำขอดูร่องรอยของการจองนี้ | [Explicit EX-mrr-060] U1 ไม่เห็นร่องรอย และแสดงข้อความ 'เฉพาะผู้ดูแลห้องและผู้ดูแลระบบเท่านั้นที่ดูร่องรอยได้' |
| TC-AUD-UI010-108 | BR-mrr-018@v1 / EX-mrr-061 | Negative | Critical | real | Partial | t1-roles.spec.ts | [exception] U2 ส่งคำขอดูร่องรอยของการจองนี้ | [Explicit EX-mrr-061] U2 ไม่เห็นร่องรอย และแสดงข้อความ 'เฉพาะผู้ดูแลห้องและผู้ดูแลระบบเท่านั้นที่ดูร่องรอยได้' |
| TC-NTF-UI008-103 | BR-mrr-019@v1 / EX-mrr-063 | Exception | Medium | real | Yes | t1-jobs.spec.ts | [exception] U1 เปลี่ยนเวลาเป็น 14:00–15:00 | [Explicit EX-mrr-063] การจองยังเป็น 10:00–11:00 ตามเดิม และแสดงข้อความ 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง' |
| TC-NTF-UI009-101 | BR-mrr-019@v1 / EX-mrr-064 | Exception | Medium | real | Yes | t1-jobs.spec.ts | [exception] Room Administrator กดอนุมัติการจองนี้ | [Explicit EX-mrr-064] สถานะยังเป็น 'รออนุมัติ' และ Room Administrator เห็นข้อความ 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง' |
| TC-NTF-UI008-104 | BR-mrr-019@v1 / EX-mrr-065 | Positive | Medium | real | Yes | t1-jobs.spec.ts | [alternate] U1 แก้หัวข้อเป็น 'ประชุมวางแผน' โดยไม่เปลี่ยนเวลา | [Explicit EX-mrr-065] ระบบบันทึกการแก้ไข และแสดงข้อความ 'บันทึกการแก้ไขสำเร็จ' — การกระทำนี้ไม่ส่ง Email จึงไม่ล้มตาม |
| TC-NTF-JOB-104 | BR-mrr-020@v2 / EX-mrr-066 | Exception | Medium | real | Yes | t1-jobs.spec.ts | [exception] งานตามเวลารันตอน 17/10 09:45 | [Explicit EX-mrr-066] U1, U2 และ U3 ไม่ได้รับ Email หัวเรื่อง '[จองห้องประชุม] ใกล้ถึงเวลาประชุม: ประชุมทีม · ห้อง A 17/10 10:00–11:00' · ระบบบันทึกการส่งเตือนของการจองนี้เป็น 'ส่งไม่สำเร็จ' และการจองยังใช้ได้ตามเดิม |
| TC-NTF-JOB-105 | BR-mrr-020@v2 / EX-mrr-067 | Exception | Medium | real | Yes | t1-jobs.spec.ts | [exception] งานตามเวลารันรอบถัดไปตอน 17/10 09:50 | [Explicit EX-mrr-067] ยังไม่มีใครได้รับ Email หัวเรื่อง '[จองห้องประชุม] ใกล้ถึงเวลาประชุม: ประชุมทีม · ห้อง A 17/10 10:00–11:00' และบันทึกการส่งเตือนยังเป็น 'ส่งไม่สำเร็จ' — ไม่ส่งซ้ำ |
| TC-CAL-UI005-101 | BR-mrr-021@v1 / EX-mrr-068 | Positive | Critical | real | Partial | t1-roles.spec.ts | [happy] U1 เปิดปฏิทินห้อง A วันที่ 17/10 | [Explicit EX-mrr-068] ช่อง 10:00–11:00 ของห้อง A แสดงผู้จอง 'U1' · หัวข้อ 'ประชุมทีม' · ผู้เข้าร่วม 'U2, U3' |
| TC-CAL-UI005-102 | BR-mrr-021@v1 / EX-mrr-069 | Positive | Critical | real | Partial | t1-roles.spec.ts | [happy] U2 เปิดปฏิทินห้อง A วันที่ 17/10 | [Explicit EX-mrr-069] ช่อง 10:00–11:00 ของห้อง A แสดงผู้จอง 'U1' · หัวข้อ 'ประชุมทีม' · ผู้เข้าร่วม 'U2, U3' |
| TC-CAL-UI005-103 | BR-mrr-021@v1 / EX-mrr-070 | Negative | Critical | real | Partial | t1-roles.spec.ts | [exception] U4 เปิดปฏิทินห้อง A วันที่ 17/10 | [Explicit EX-mrr-070] ช่อง 10:00–11:00 ของห้อง A แสดงแค่คำว่า 'ไม่ว่าง' ไม่แสดงผู้จอง หัวข้อ หรือผู้เข้าร่วม |
| TC-CAL-UI005-104 | BR-mrr-021@v1 / EX-mrr-071 | Negative | Critical | real | Partial | t1-roles.spec.ts | [exception] U4 เปิดปฏิทินห้อง B วันที่ 17/10 | [Explicit EX-mrr-071] ช่อง 10:00–11:00 ของห้อง B แสดงแค่คำว่า 'ไม่ว่าง' ไม่แสดงผู้จอง หัวข้อ ผู้เข้าร่วม หรือสถานะ 'รออนุมัติ' |
| TC-RPT-RPT001-104 | BR-mrr-022@v1 / EX-mrr-072 | Positive | Critical | real | Partial | t1-reports.spec.ts | [happy] Room Administrator เปิดหน้ารายงานการใช้ห้อง เดือน ต.ค. 2569 | [Explicit EX-mrr-072] เห็นรายงานเดือน ต.ค. 2569 พร้อมอันดับห้องที่มีอัตราการใช้งานสูงสุด |
| TC-RPT-RPT001-105 | BR-mrr-022@v1 / EX-mrr-073 | Negative | Critical | real | Partial | t1-roles.spec.ts | [exception] System Administrator ส่งคำขอเปิดหน้ารายงานการใช้ห้อง เดือน ต.ค. 2569 | [Explicit EX-mrr-073] System Administrator ไม่เห็นรายงานและสถิติ และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้' |
| TC-RPT-RPT001-106 | BR-mrr-022@v1 / EX-mrr-074 | Negative | Critical | real | Yes | t1-yes.spec.ts | [exception] U1 ส่งคำขอเปิดหน้ารายงานการใช้ห้อง เดือน ต.ค. 2569 | [Explicit EX-mrr-074] U1 ไม่เห็นรายงานและสถิติ และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้' |
| TC-NTF-JOB-106 | BR-mrr-023@v1 / EX-mrr-075 | Positive | High | real | Yes | t1-jobs.spec.ts | [happy] งานตามเวลารันตอน 17/10 09:45 | [Explicit EX-mrr-075] U1, U2 และ U3 ได้รับ Email หัวเรื่อง '[จองห้องประชุม] ใกล้ถึงเวลาประชุม: ประชุมทีม · ห้อง A 17/10 10:00–11:00' คนละ 1 ฉบับ และระบบบันทึกว่าการจองนี้ส่งเตือนแล้ว |
| TC-NTF-JOB-107 | BR-mrr-023@v1 / EX-mrr-076 | Exception | High | real | Yes | t1-jobs.spec.ts | [exception] งานตามเวลารันซ้ำตอน 17/10 09:50 | [Explicit EX-mrr-076] ไม่มีใครได้รับ Email หัวเรื่อง '[จองห้องประชุม] ใกล้ถึงเวลาประชุม: ประชุมทีม · ห้อง A 17/10 10:00–11:00' เพิ่ม — U1, U2 และ U3 มี Email นี้คนละ 1 ฉบับเท่าเดิม |
| TC-NTF-JOB-108 | BR-mrr-023@v1 / EX-mrr-077 | Boundary | High | real | Yes | t1-jobs.spec.ts | [boundary] งานตามเวลารันตอน 17/10 09:55 | [Explicit EX-mrr-077] ไม่มีใครได้รับ Email หัวเรื่อง '[จองห้องประชุม] ใกล้ถึงเวลาประชุม: ประชุมด่วน · ห้อง A 17/10 10:00–11:00' เพิ่ม — Email ที่ส่งทันทีตอนจองนับเป็นครั้งเดียวของการจองนี้แล้ว |
| TC-RMM-UI013-105 | BR-mrr-010@v2 / EX-mrr-078 | Positive | High | real | Yes | t1-clock.spec.ts | [happy] วันที่ 16/10 เวลา 10:00 Room Administrator แก้ห้อง A เป็นต้องอนุมัติ แล้วเปิดรายการการจองที่ 'รออนุมัติ' | [Explicit EX-mrr-078] Room Administrator เห็นข้อความ 'บันทึกข้อมูลห้องสำเร็จ' · การจองของ U1 วันที่ 18/10 10:00–11:00 เปลี่ยนเป็นสถานะ 'รออนุมัติ' ยังใช้ห้องไม่ได้ และอยู่ในรายการ 'รออนุมัติ' · U1 ไม่ได้รับ Email — การจองเดิมที่ยังไม่ถึงเวลาเริ่มกลับไปรออนุมัติ |
| TC-RMM-UI013-106 | BR-mrr-010@v2 / EX-mrr-079 | Positive | High | real | Yes | t1-clock.spec.ts | [alternate] วันที่ 16/10 เวลา 10:00 Room Administrator แก้ห้อง B เป็นไม่ต้องอนุมัติ แล้วเปิดรายการการจองที่ 'รออนุมัติ' | [Explicit EX-mrr-079] Room Administrator เห็นข้อความ 'บันทึกข้อมูลห้องสำเร็จ' · การจองของ U1 ไม่อยู่ในรายการ 'รออนุมัติ' และใช้ห้องได้ทันทีโดยไม่ขึ้นสถานะ 'อนุมัติแล้ว' (เหมือนจองห้องที่ไม่ต้องอนุมัติ) · U1 ได้รับ Email หัวเรื่อง '[จองห้องประชุม] จองสำเร็จ: ประชุมทีม · ห้อง B 18/10 10:00–11:00' |
| TC-RMM-UI013-107 | BR-mrr-010@v2 / EX-mrr-080 | Boundary | High | real | Yes | t1-clock.spec.ts | [boundary] วันที่ 16/10 เวลา 10:00 พอดี Room Administrator แก้ห้อง A เป็นต้องอนุมัติ แล้วเปิดรายการการจองที่ 'รออนุมัติ' | [Explicit EX-mrr-080] การจองของ U1 (เริ่ม 10:00 = เวลาที่แก้) ไม่อยู่ในรายการ 'รออนุมัติ' และยังใช้ห้องได้ตามเดิม — เริ่มพอดีนับว่าถึงเวลาเริ่มแล้ว · การจองของ U2 (เริ่ม 11:00) เปลี่ยนเป็นสถานะ 'รออนุมัติ' และอยู่ในรายการ 'รออนุมัติ' |
| TC-BKG-UI006-028 | BR-mrr-012@v1 / EX-mrr-081 | Negative | High | real | Partial | t1-roles.spec.ts | [exception] U2 จองห้อง A 18/10 13:00–14:00 หัวข้อ 'ประชุมทีม' ผู้เข้าร่วม 2 คน | [Explicit EX-mrr-081] ระบบไม่สร้างการจอง และแสดงข้อความ 'ห้องนี้ปิดปรับปรุง ไม่สามารถจองได้' |
| TC-BKG-UI008-101 | BR-mrr-012@v1 / EX-mrr-082 | Positive | High | real | Partial | t1-roles.spec.ts | [alternate] U1 แก้เวลาการจองของตนเป็น 18/10 14:00–15:00 แล้วกดบันทึก | [Explicit EX-mrr-082] ระบบไม่บันทึกการแก้ไข และแสดงข้อความ 'ห้องนี้ปิดปรับปรุง ไม่สามารถจองได้' · การจองของ U1 ยังเป็น 18/10 10:00–11:00 และใช้ห้องได้ตามเดิม — การเปลี่ยนเวลานับเป็นการจองใหม่ |
| TC-RMM-UI012-102 | BR-mrr-012@v1 / EX-mrr-083 | Boundary | High | real | Partial | t1-roles.spec.ts | [boundary] Room Administrator เปิดห้อง A กลับมาใช้งาน จากนั้น U2 จองห้อง A 18/10 13:00–14:00 หัวข้อ 'ประชุมทีม' ผู้เข้าร่วม 2 คน | [Explicit EX-mrr-083] Room Administrator เห็นข้อความ 'เปิดห้องใช้งานแล้ว' · การจองของ U2 สร้างสำเร็จทันที และแสดงข้อความ 'จองห้องสำเร็จ' — ออกจากปิดปรับปรุงแล้วรับการจองใหม่ได้ |
| TC-RPT-RPT001-107 | BR-mrr-006@v2 / EX-mrr-084 | Positive | Medium | real | Partial | t1-reports.spec.ts | [happy] จัดอันดับห้อง B (66.67%) เหนือห้อง A (33.33%) โดยการจองที่ยกเลิก/รออนุมัติ/ถูกปฏิเสธไม่นับ | [Explicit EX-mrr-084] อันดับ 1 ห้อง B '66.67%' · อันดับ 2 ห้อง A '33.33%' — การจองที่ยกเลิก / รออนุมัติ / ถูกปฏิเสธไม่นับ และ 66.666… ปัดแบบ round half up เป็น 66.67 |
| TC-RPT-RPT001-108 | BR-mrr-006@v2 / EX-mrr-085 | Boundary | Medium | real | Partial | t1-reports.spec.ts | [boundary] การจองเลยเวลาทำการ 17:00–19:00 วันศุกร์ + วันเสาร์ นับเฉพาะ 17:00–18:00 → 0.45% | [Explicit EX-mrr-085] ห้อง C แสดง '0.45%' — นับเฉพาะ 17:00–18:00 ของวันศุกร์ (60 นาที) ส่วนหลัง 18:00 และวันเสาร์ไม่นับ · 60 ÷ 13,200 × 100 = 0.4545… ปัดเป็น 0.45 |
| TC-RPT-RPT001-109 | BR-mrr-006@v2 / EX-mrr-086 | Positive | Medium | real | Partial | t1-reports.spec.ts | [alternate] ห้องปิดปรับปรุง 19–23 หักตัวหารเหลือ 10,200 นาที และการจองในช่วงปิดไม่นับ → 50.00% | [Explicit EX-mrr-086] ห้อง D แสดง '50.00%' — ตัวหารเหลือ 13,200 − 3,000 = 10,200 นาที และการจอง 21/10 ที่อยู่ในช่วงปิดปรับปรุงไม่นับในตัวตั้ง |
| TC-RPT-RPT001-110 | BR-mrr-006@v2 / EX-mrr-087 | Negative | Medium | real | Partial | t1-reports.spec.ts | [exception] ห้องปิดปรับปรุงทั้งเดือน ตัวหารเหลือ 0 → แสดง — ไม่มีอันดับ ไม่เข้าอันดับ | [Explicit EX-mrr-087] ห้อง E แสดง '—' ไม่มีเลขอันดับ และไม่อยู่ในอันดับห้องที่มีอัตราการใช้งานสูงสุด — ชั่วโมงทำการเหลือ 0 จึงไม่คำนวณ |
| TC-APR-UI010-109 | BR-mrr-009@v1 / EX-mrr-088 | Negative | High | real | Partial | t1-roles.spec.ts | [exception] System Administrator เปิดหน้าจัดการการจองนี้ | [Explicit EX-mrr-088] System Administrator เห็นข้อมูลการจองและร่องรอย แต่ไม่เห็นช่องเหตุผล ไม่เห็นปุ่ม 'แก้แทนผู้จอง' และ 'ยกเลิกแทนผู้จอง' — การจองคงเดิม |
| TC-APR-UI010-110 | BR-mrr-011@v1 / EX-mrr-089 | Negative | High | real | Partial | t1-roles.spec.ts | [exception] System Administrator เปิดหน้าจัดการการจองนี้ | [Explicit EX-mrr-089] System Administrator เห็นข้อมูลการจองและร่องรอย แต่ไม่เห็นช่องเหตุผล และไม่เห็นปุ่ม 'เปลี่ยนผลการอนุมัติ' — สถานะยังเป็น 'อนุมัติแล้ว' |
| TC-RMM-UI014-101 | BR-mrr-005@v1 / EX-mrr-090 | Negative | Critical | real | Yes | t1-yes.spec.ts | [exception] General User เปิดหน้าสิ่งอำนวยความสะดวก | [Explicit EX-mrr-090] แสดงข้อความ 'คุณไม่มีสิทธิ์เข้าหน้านี้' และไม่เห็นรายการสิ่งอำนวยความสะดวก |
| TC-AUTH-UI001-101 | BR-mrr-024@v1 / BR-mrr-026@v1 / EX-mrr-091 | Positive | Critical | real | Yes | t1-yes.spec.ts | [happy] U1 กรอก Email องค์กรของตนที่หน้าขอรหัสเข้าสู่ระบบ แล้วกด 'ขอรหัสเข้าสู่ระบบ' | [Explicit EX-mrr-091] แสดงข้อความ 'หากเป็น Email ในระบบ เราได้ส่งรหัสเข้าสู่ระบบไปแล้ว กรุณาตรวจสอบ Email' และ U1 ได้รับ Email ที่มีรหัสเข้าสู่ระบบ |
| TC-AUTH-UI001-102 | BR-mrr-024@v1 / EX-mrr-092 | Exception | Medium | real | Yes | t1-jobs.spec.ts | [exception] U1 กรอก Email องค์กรของตน แล้วกด 'ขอรหัสเข้าสู่ระบบ' ตอน 10:00 | [Explicit EX-mrr-092] แสดงข้อความ 'ส่งรหัสไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' · U1 ไม่ได้รับ Email และยังเข้าสู่ระบบไม่ได้ |
| TC-AUTH-UI001-103 | BR-mrr-024@v1 / EX-mrr-093 | Exception | Medium | real | Yes | t1-jobs.spec.ts | [boundary] U1 ไม่ได้กดขอรหัสอีก จนถึง 10:30 | [Explicit EX-mrr-093] U1 ไม่ได้รับ Email รหัสเข้าสู่ระบบเลย — ระบบไม่ส่งซ้ำให้เอง เพราะไม่มีคิวส่งซ้ำ |
| TC-AUTH-UI001-104 | BR-mrr-024@v1 / EX-mrr-094 | Positive | Medium | real | Yes | t1-jobs.spec.ts | [alternate] U1 กด 'ขอรหัสเข้าสู่ระบบ' อีกครั้งตอน 10:06 | [Explicit EX-mrr-094] แสดงข้อความ 'หากเป็น Email ในระบบ เราได้ส่งรหัสเข้าสู่ระบบไปแล้ว กรุณาตรวจสอบ Email' และ U1 ได้รับ Email ที่มีรหัสเข้าสู่ระบบ — การขอครั้งที่ล้มไม่นับเป็นรหัสที่ยังใช้ได้ จึงไม่ถูกกันการขอซ้ำ |
| TC-AUTH-UI001-105 | BR-mrr-025@v1 / EX-mrr-095 | Negative | Medium | real | Partial | t1-clock.spec.ts | [exception] U1 กด 'ขอรหัสเข้าสู่ระบบ' อีกครั้งตอน 10:09:59 | [Explicit EX-mrr-095] แสดงข้อความ 'ส่งรหัสไปแล้ว กรุณาใช้รหัสเดิมใน Email หรือรอให้รหัสหมดอายุก่อนขอใหม่' · ระบบไม่ออกรหัสใหม่ U1 ไม่ได้รับ Email ฉบับใหม่ และรหัสเดิมยังใช้เข้าสู่ระบบได้ |
| TC-AUTH-UI001-106 | BR-mrr-025@v1 / EX-mrr-096 | Boundary | Medium | real | Yes | t1-clock.spec.ts | [boundary] U1 กด 'ขอรหัสเข้าสู่ระบบ' อีกครั้งตอน 10:10:00 | [Explicit EX-mrr-096] แสดงข้อความ 'หากเป็น Email ในระบบ เราได้ส่งรหัสเข้าสู่ระบบไปแล้ว กรุณาตรวจสอบ Email' และ U1 ได้รับ Email ฉบับใหม่ที่มีรหัสใหม่ — รหัสเดิมหมดอายุพอดีที่ 10:10:00 จึงไม่ถูกกันการขอซ้ำ |
| TC-AUTH-UI001-107 | BR-mrr-025@v1 / EX-mrr-097 | Positive | Medium | real | Yes | t1-yes.spec.ts | [happy] U1 กด 'ขอรหัสเข้าสู่ระบบ' ตอน 10:04 | [Explicit EX-mrr-097] แสดงข้อความ 'หากเป็น Email ในระบบ เราได้ส่งรหัสเข้าสู่ระบบไปแล้ว กรุณาตรวจสอบ Email' และ U1 ได้รับ Email ฉบับใหม่ที่มีรหัสใหม่ — รหัสเดิมถูกใช้ไปแล้ว จึงขอใหม่ได้แม้ยังไม่ถึง 10:10:00 |
| TC-AUTH-UI001-108 | BR-mrr-026@v1 / EX-mrr-098 | Negative | Critical | real | Yes | t1-yes.spec.ts | [exception] U9 กรอก Email องค์กรของตนที่หน้าขอรหัสเข้าสู่ระบบ แล้วกด 'ขอรหัสเข้าสู่ระบบ' | [Explicit EX-mrr-098] แสดงข้อความ 'หากเป็น Email ในระบบ เราได้ส่งรหัสเข้าสู่ระบบไปแล้ว กรุณาตรวจสอบ Email' เหมือนกรณีปกติทุกตัวอักษร · แต่ระบบไม่ส่ง Email รหัสเข้าสู่ระบบ U9 จึงเข้าสู่ระบบไม่ได้ |
| TC-AUTH-UI001-109 | BR-mrr-026@v1 / EX-mrr-099 | Boundary | Critical | real | Partial | t1-roles.spec.ts | [boundary] U5 กรอก Email องค์กรของตนที่หน้าขอรหัสเข้าสู่ระบบ แล้วกด 'ขอรหัสเข้าสู่ระบบ' | [Explicit EX-mrr-099] แสดงข้อความ 'หากเป็น Email ในระบบ เราได้ส่งรหัสเข้าสู่ระบบไปแล้ว กรุณาตรวจสอบ Email' เหมือนกรณีปกติทุกตัวอักษร · แต่ระบบไม่ส่ง Email รหัสเข้าสู่ระบบ U5 จึงเข้าสู่ระบบไม่ได้ — อยู่ในรายชื่ออย่างเดียวไม่พอ ต้อง active ด้วย |
| TC-AUTH-UI002-101 | BR-mrr-027@v1 / EX-mrr-100 | Positive | Critical | real | Yes | t1-yes.spec.ts | [happy] U1 กรอกรหัส 482913 แล้วกดยืนยันตอน 10:09:59 | [Explicit EX-mrr-100] U1 เข้าสู่ระบบได้ และถูกพาไปหน้า 'ค้นหาห้องว่าง' ทันที โดยไม่มีข้อความแจ้ง |
| TC-AUTH-UI002-102 | BR-mrr-027@v1 / BR-mrr-028@v1 / EX-mrr-101 | Boundary | Critical | real | Yes | t1-clock.spec.ts | [boundary] U1 กรอกรหัส 482913 แล้วกดยืนยันตอน 10:10:00 | [Explicit EX-mrr-101] แสดงข้อความ 'รหัสหรือลิงก์เข้าสู่ระบบหมดอายุแล้ว กรุณาขอรหัสใหม่' · ระบบไม่สร้าง session และ U1 ยังอยู่หน้ากรอกรหัส |
| TC-AUTH-UI002-103 | BR-mrr-027@v1 / BR-mrr-028@v1 / EX-mrr-102 | Negative | Critical | real | Yes | t1-yes.spec.ts | [exception] U1 กรอกรหัส 482913 บนอีกเครื่องหนึ่งตอน 10:03 | [Explicit EX-mrr-102] แสดงข้อความ 'รหัสหรือลิงก์นี้ถูกใช้เข้าสู่ระบบไปแล้ว กรุณาขอรหัสใหม่' · ระบบไม่สร้าง session บนเครื่องนั้น — รหัสกับลิงก์นับการใช้ร่วมกัน |
| TC-AUTH-UI002-104 | BR-mrr-027@v1 / EX-mrr-103 | Negative | Critical | real | Yes | t1-yes.spec.ts | [exception] U1 กด magic link ใน Email ฉบับเดียวกันตอน 10:04 | [Explicit EX-mrr-103] แสดงข้อความ 'รหัสหรือลิงก์นี้ถูกใช้เข้าสู่ระบบไปแล้ว กรุณาขอรหัสใหม่' · ระบบไม่สร้าง session — ลิงก์ใช้ไม่ได้แม้ยังไม่ถึง 10:10:00 |
| TC-AUTH-UI002-105 | BR-mrr-028@v1 / EX-mrr-104 | Negative | Critical | real | Yes | t1-yes.spec.ts | [exception] U1 กรอกรหัส 482931 แล้วกดยืนยันตอน 10:03 | [Explicit EX-mrr-104] แสดงข้อความ 'รหัสไม่ถูกต้อง กรุณาตรวจสอบรหัสใน Email แล้วกรอกใหม่' · ระบบไม่สร้าง session และ U1 ยังอยู่หน้ากรอกรหัส |
| TC-AUTH-UI002-106 | BR-mrr-028@v1 / EX-mrr-105 | Positive | Critical | real | Yes | t1-yes.spec.ts | [happy] U1 กรอกรหัส 482913 แล้วกดยืนยันตอน 10:05 | [Explicit EX-mrr-105] U1 เข้าสู่ระบบได้ และถูกพาไปหน้า 'ค้นหาห้องว่าง' ทันที โดยไม่มีข้อความแจ้ง — กรอกผิดไม่ทำให้รหัสเสีย |
| TC-BKG-UI004-101 | BR-mrr-001@v1 / BR-mrr-012@v1 / EX-mrr-106 | Positive | Critical | real | Partial | t1-search-delete.spec.ts | [happy] ผู้ใช้ค้นหาห้องว่าง 18/10 13:00–14:00 ผู้เข้าร่วม 6 คน | [Explicit EX-mrr-106] ระบบแสดงห้อง A พร้อมชื่อ ความจุ และปุ่ม 'ไปหน้าจอง' · ไม่แสดงห้อง B เพราะความจุไม่พอ |
| TC-BKG-UI004-102 | BR-mrr-001@v1 / BR-mrr-012@v1 / EX-mrr-107 | Negative | Critical | real | Partial | t1-search-delete.spec.ts | [exception] ผู้ใช้ค้นหาห้องว่าง 18/10 13:00–14:00 | [Explicit EX-mrr-107] ระบบแสดง 'ไม่พบห้องว่าง' และ 'ลองเปลี่ยนเวลา จำนวนคน หรือตัวกรอง' |
| TC-BKG-UI004-103 | BR-mrr-001@v1 / BR-mrr-012@v1 / EX-mrr-108 | Boundary | Critical | real | Partial | t1-search-delete.spec.ts | [boundary] ผู้ใช้ค้นหาห้องว่าง 18/10 13:00–14:00 | [Explicit EX-mrr-108] ระบบไม่แสดงห้อง B เพราะไม่ว่าง (การจองที่รออนุมัติกันช่วงเวลาไว้) · ไม่แสดงห้อง C เพราะปิดปรับปรุง |
| TC-RMM-UI013-110 | BR-mrr-005@v1 / EX-mrr-109 | Positive | Critical | real | Partial | t1-search-delete.spec.ts | [happy] Room Administrator ลบห้อง A | [Explicit EX-mrr-109] ระบบแสดงข้อความ 'ลบห้องแล้ว' · ห้อง A เป็นสถานะ ARCHIVED ไม่แสดงในการค้นหาและการจอง |
| TC-RMM-UI013-111 | BR-mrr-005@v1 / EX-mrr-110 | Negative | Critical | real | Yes | t1-search-delete.spec.ts | [exception] ผู้ใช้พยายามลบห้อง A | [Explicit EX-mrr-110] ระบบไม่ลบห้อง และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้' · ห้อง A ไม่เปลี่ยน |
| TC-NTF-JOB-109 | BR-mrr-020@v2 / EX-mrr-111 | Positive | Medium | real | Partial | t1-round2.spec.ts | [happy] งานตามเวลารันตอน 17/10 09:45 | [Explicit EX-mrr-111] U1, U2 และ U3 ได้รับ Email หัวเรื่อง '[จองห้องประชุม] ใกล้ถึงเวลาประชุม: ประชุมทีม · ห้อง A 17/10 10:00–11:00' · ระบบบันทึกการส่งเตือนของการจองนี้เป็น 'ส่งสำเร็จ' |
| TC-NTF-JOB-110 | BR-mrr-020@v2 / EX-mrr-112 | Boundary | Medium | real | Partial | t1-round2.spec.ts | [boundary] งานตามเวลารันตอน 17/10 09:45 | [Explicit EX-mrr-112] ระบบบันทึกการส่งเตือนของการจองนี้เป็น 'ส่งไม่สำเร็จ' ทั้งการจอง (ไม่แยกรายคน) · งานรอบถัดไปตอน 09:50 ไม่ส่ง Email หัวเรื่อง '[จองห้องประชุม] ใกล้ถึงเวลาประชุม: ประชุมทีม · ห้อง A 17/10 10:00–11:00' ซ้ำให้ใครอีก · การจองยังใช้ได้ตามเดิม |
| TC-BKG-UI006-107 | BR-mrr-019@v1 / EX-mrr-113 | Positive | Medium | real | Partial | t1-round2.spec.ts | [happy] U1 จองห้อง A 17/10 13:00–14:00 หัวข้อ 'ประชุมทีม' ผู้เข้าร่วม U2 | [Explicit EX-mrr-113] ระบบสร้างการจอง ห้อง A ช่วง 13:00–14:00 เป็นของ U1 และแสดงข้อความ 'จองห้องสำเร็จ' · U1 ได้รับ Email หัวเรื่อง '[จองห้องประชุม] จองสำเร็จ: ประชุมทีม · ห้อง A 17/10 13:00–14:00' — ไม่แสดงข้อความ 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง' |
| TC-NTF-UI006-102 | BR-mrr-007@v2 / EX-mrr-114 | Negative | Medium | real | Partial | t1-round2.spec.ts | [exception] U1 จองห้อง B 17/10 10:00–11:00 หัวข้อ 'ประชุมลูกค้า' ผู้เข้าร่วม U2 การจองมีสถานะ 'รออนุมัติ' | [Explicit EX-mrr-114] ไม่มีใครได้รับ Email หัวเรื่อง '[จองห้องประชุม] จองสำเร็จ: ประชุมลูกค้า · ห้อง B 17/10 10:00–11:00' — การจองที่ยังรออนุมัติยังไม่นับเป็นจองสำเร็จ |
| TC-NTF-UI009-102 | BR-mrr-007@v2 / EX-mrr-115 | Positive | Medium | real | Partial | t1-round2.spec.ts | [happy] Room Administrator กดอนุมัติการจองนี้ | [Explicit EX-mrr-115] การจองเปลี่ยนเป็นสถานะ 'อนุมัติแล้ว' และ Room Administrator เห็นข้อความ 'อนุมัติการจองสำเร็จ' · U1 ได้รับ Email หัวเรื่อง '[จองห้องประชุม] อนุมัติแล้ว: ประชุมลูกค้า · ห้อง B 17/10 10:00–11:00' — U2 ไม่ได้รับ Email |
| TC-NTF-UI008-105 | BR-mrr-007@v2 / EX-mrr-116 | Positive | Medium | real | Partial | t1-round2.spec.ts | [happy] U1 กดยกเลิกการจองนี้ | [Explicit EX-mrr-116] ระบบยกเลิกการจอง และแสดงข้อความ 'ยกเลิกการจองสำเร็จ' · U1, U2 และ U3 ได้รับ Email หัวเรื่อง '[จองห้องประชุม] ยกเลิกการจอง: ประชุมทีม · ห้อง A 17/10 10:00–11:00' |
| TC-NTF-UI010-101 | BR-mrr-007@v2 / EX-mrr-117 | Positive | Medium | real | Yes | t1-round2.spec.ts | [happy] Room Administrator ยกเลิกการจองนี้แทน U1 พร้อมเหตุผล 'ห้องต้องใช้จัดงานด่วน' | [Explicit EX-mrr-117] ระบบยกเลิกการจอง และ Room Administrator เห็นข้อความ 'ยกเลิกการจองสำเร็จ' · U1, U2 และ U3 ได้รับ Email หัวเรื่อง '[จองห้องประชุม] ยกเลิกการจอง: ประชุมทีม · ห้อง A 17/10 10:00–11:00' |
| TC-NTF-UI009-103 | BR-mrr-007@v2 / BR-mrr-017@v2 / EX-mrr-118 | Negative | Medium | real | Yes | t1-round2.spec.ts | [exception] 16/10 14:10 Room Administrator ปฏิเสธการจองนี้ พร้อมเหตุผล 'ห้องไม่เหมาะกับการประชุมนี้' แล้วเปิดดูร่องรอยของการจองนี้ | [Explicit EX-mrr-118] การจองเปลี่ยนเป็นสถานะ 'ปฏิเสธแล้ว' · Room Administrator เห็นข้อความ 'ปฏิเสธการจองสำเร็จ' · U1 และ U2 ได้รับ Email หัวเรื่อง '[จองห้องประชุม] ปฏิเสธการจอง: ประชุมลูกค้า · ห้อง B 17/10 10:00–11:00' · ร่องรอยมีรายการใหม่ 1 รายการ: ผู้ทำ Room Administrator · เวลา 16/10 14:10 · การกระทำ 'ปฏิเสธการจอง' · เหตุผล 'ห้องไม่เหมาะกับการประชุมนี้' |
| TC-AUD-UI010-109 | BR-mrr-017@v2 / EX-mrr-120 | Positive | Medium | real | Partial | t1-round2.spec.ts | [happy] 16/10 14:10 RA1 ปฏิเสธการจองนี้ พร้อมเหตุผล 'ห้องไม่เหมาะกับการประชุมนี้' แล้วเปิดดูร่องรอยของการจองนี้ | [Explicit EX-mrr-120] การจองเปลี่ยนเป็นสถานะ 'ปฏิเสธแล้ว' · RA1 เห็นข้อความ 'ปฏิเสธการจองสำเร็จ' และร่องรอยมีรายการใหม่ 1 รายการ: ผู้ทำ RA1 · เวลา 16/10 14:10 · การกระทำ 'ปฏิเสธการจอง' · เหตุผล 'ห้องไม่เหมาะกับการประชุมนี้' |
| TC-AUD-UI010-110 | BR-mrr-017@v2 / EX-mrr-121 | Positive | Medium | real | Partial | t1-round2.spec.ts | [happy] 16/10 15:00 RA1 เปลี่ยนผลเป็นปฏิเสธ พร้อมเหตุผล 'อนุมัติผิดห้อง' แล้วเปิดดูร่องรอยของการจองนี้ | [Explicit EX-mrr-121] การจองเปลี่ยนเป็นสถานะ 'ปฏิเสธแล้ว' · RA1 เห็นข้อความ 'เปลี่ยนผลการอนุมัติสำเร็จ' และร่องรอยมีรายการใหม่ 1 รายการ: ผู้ทำ RA1 · เวลา 16/10 15:00 · การกระทำ 'ถอยผล' · เหตุผล 'อนุมัติผิดห้อง' |
| TC-AUD-UI010-111 | BR-mrr-017@v2 / EX-mrr-122 | Positive | Medium | real | Partial | t1-round2.spec.ts | [happy] RA1 แก้หัวข้อเป็น 'ประชุมวางแผน' แทน U1 พร้อมเหตุผล 'ผู้จองพิมพ์หัวข้อผิด' แล้วเปิดดูร่องรอยของการจองนี้ | [Explicit EX-mrr-122] หัวข้อของการจองเปลี่ยนเป็น 'ประชุมวางแผน' · RA1 เห็นข้อความ 'บันทึกการแก้ไขสำเร็จ' และร่องรอยมีรายการใหม่ 1 รายการ: ผู้ทำ RA1 · เวลา 18/10 10:30 · การกระทำ 'แก้แทนผู้จอง' · เหตุผล 'ผู้จองพิมพ์หัวข้อผิด' |
| TC-AUD-UI010-112 | BR-mrr-017@v2 / EX-mrr-123 | Negative | Medium | real | Yes | t1-round2.spec.ts | [exception] 16/10 14:10 RA1 ปฏิเสธการจองนี้โดยเว้นช่องเหตุผลว่าง แล้วเปิดดูร่องรอยของการจองนี้ | [Explicit EX-mrr-123] การจองคงสถานะ 'รออนุมัติ' · RA1 เห็นข้อความ 'กรุณาระบุเหตุผล' · ไม่มีใครได้รับ Email ปฏิเสธการจอง และร่องรอยของการจองนี้ไม่มีรายการใหม่ — การกระทำที่ไม่สำเร็จไม่บันทึกร่องรอย |
| TC-NTF-UI010-102 | BR-mrr-007@v2 / EX-mrr-124 | Negative | Medium | real | Yes | t1-round2.spec.ts | [exception] Room Administrator เปลี่ยนผลการอนุมัติของการจองนี้เป็นปฏิเสธ พร้อมเหตุผล 'อนุมัติผิดห้อง' | [Explicit EX-mrr-124] การจองเปลี่ยนเป็นสถานะ 'ปฏิเสธแล้ว' และ Room Administrator เห็นข้อความ 'เปลี่ยนผลการอนุมัติสำเร็จ' · U1 และ U2 ได้รับ Email หัวเรื่อง '[จองห้องประชุม] ปฏิเสธการจอง: ประชุมลูกค้า · ห้อง B 17/10 10:00–11:00' |
| TC-RPT-RPT001-111 | BR-mrr-006@v2 / EX-mrr-125 | Positive | Medium | real | Partial | t1-reports.spec.ts | [happy] ห้อง A และ B อัตราเท่ากัน (จอง 60 นาทีเท่ากัน) → อันดับ 1 ทั้งคู่ · ห้อง D (ไม่มีการจอง) อันดับ 3 ข้ามเลข 2 | [Explicit EX-mrr-125] ห้อง A แสดง '0.45%' และห้อง B แสดง '0.45%' ได้อันดับ 1 ทั้งคู่ · ห้อง D แสดง '0.00%' ได้อันดับ 3 (ไม่ใช่อันดับ 2 เพราะห้องถัดไปข้ามเลข) · 60 ÷ 13,200 × 100 = 0.4545… ปัดแบบ round half up เป็น 0.45 |
| TC-RPT-RPT001-112 | BR-mrr-006@v2 / EX-mrr-126 | Boundary | Medium | real | Partial | t1-reports.spec.ts | [boundary] จอง 60 นาทีกับ 59 นาทีเท่ากันหลังปัด (0.45%) → อันดับเท่ากัน · 58 นาที (0.44%) อันดับ 3 | [Explicit EX-mrr-126] ห้อง F แสดง '0.45%' และห้อง G แสดง '0.45%' ได้อันดับ 1 ทั้งคู่ แม้จำนวนนาทีต่างกัน เพราะเทียบกันหลังปัดเหลือทศนิยม 2 ตำแหน่ง (59 ÷ 13,200 × 100 = 0.4469… ปัดเป็น 0.45) · ห้อง H แสดง '0.44%' (58 ÷ 13,200 × 100 = 0.4393… ปัดเป็น 0.44) ได้อันดับ 3 |
| TC-RPT-RPT001-113 | BR-mrr-006@v2 / EX-mrr-127 | Negative | Medium | real | Partial | t1-reports.spec.ts | [exception] ห้องอัตราเท่ากัน + ห้องที่ปิดปรับปรุงทั้งเดือนแสดง — ไม่มีอันดับ และไม่ร่วมการข้ามเลข | [Explicit EX-mrr-127] ห้อง A และห้อง B ได้อันดับ 1 ทั้งคู่ · ห้อง C แสดง '0.00%' ได้อันดับ 3 · ห้อง E แสดง '—' ไม่มีเลขอันดับ และไม่ถูกนับเป็นอันดับถัดไป (ห้องที่ไม่ถูกจัดอันดับไม่ร่วมการข้ามเลข) |
| TC-RPT-RPT001-114 | BR-mrr-006@v2 / EX-mrr-128 | Boundary | Medium | real | Partial | t1-reports.spec.ts | [boundary] ห้องอัตราเท่ากันคร่อมรอยต่อหน้า 1/หน้า 2 (หน้าละ 50 ห้อง) → อันดับเท่ากันแม้คนละหน้า ห้องถัดไปข้ามเลข | [Explicit EX-mrr-128] ห้อง R50 แสดง '0.45%' อันดับ 50 อยู่แถวสุดท้ายของหน้า 1 · ห้อง R51 แสดง '0.45%' อันดับ 50 เช่นกัน อยู่แถวแรกของหน้า 2 (เลขเท่ากันแม้อยู่คนละหน้า) · ห้อง R52 แสดง '0.00%' อันดับ 52 (ข้ามเลข 51) |

**นิยาม Automation:** Yes = เขียนสคริปต์ได้ด้วย dev stack ตอนนี้ · Partial = ต้องเตรียมข้อมูล/ผู้ใช้ตาม §C · No = ต้องมีกลไกที่ยังไม่มีตาม §D
 · (ค่านี้บันทึกตอนออกแบบ — ปัจจุบันทุกเคสมีสคริปต์แล้ว ดูคอลัมน์ Script · **2026-11-25: 34 แถวที่เดิม No ปรับเป็น Yes ตามที่ผู้ใช้สั่ง** · `t1-generate.py` ยังให้ค่าเดิมถ้ารันซ้ำ ซึ่งจะเขียนทับค่านี้และทิ้งแถวที่เพิ่มด้วยมือ ห้ามรันซ้ำ)
**หมายเหตุ ID:** เคสใหม่ใช้เลขลำดับตั้งแต่ 101 ต่อท้ายของแต่ละ `TC-<Function>-<Screen>` เพื่อไม่ชนเลขที่ test/README ใช้ไปแล้ว (UI006: 019–027) · `TC-BKG-UI006-022` (EX-004) และ `TC-BKG-UI006-028` (EX-081 แบบ real) สงวนไว้ตาม README

### B3. [Recommended] ออกจากระบบ — ไม่มี BR/EX (AC ของ design เท่านั้น)

ไม่อยู่ใน CSV เพราะกฎข้อ 3 ต้องผูก BR · ข้อความ Expected คัดจาก AC-mrr-111–113 (.aeon/design/modules/mrr/functions.json) ตรงตัวอักษร · รอ PO ยืนยัน (OQ-T1-10)

| TC ID | Source | Type | Scenario | Expected Result | Data Source | Automation |
|---|---|---|---|---|---|---|
| TC-AUTH-UI003-101 | [Recommended] AC-mrr-111 | Positive | ผู้ใช้เข้าสู่ระบบอยู่ กดออกจากระบบ | ระบบยกเลิก session ของผู้ใช้ และแสดงหน้า 'ออกจากระบบแล้ว' พร้อมทางเข้าสู่ระบบอีกครั้ง · ตรวจเพิ่ม: ใช้ session เดิมเรียก `/auth/me` ได้ 401 (ทั้งจากเบราว์เซอร์และจากคุกกี้ที่คัดลอกไปเรียกใหม่) · กด 'เข้าสู่ระบบอีกครั้ง' ไปหน้า UI-mrr-001 | real | Yes · [สคริปต์แล้ว] t1-logout.spec.ts |
| TC-AUTH-UI003-102 | [Recommended] AC-mrr-112 | Exception | ผู้ใช้เข้าสู่ระบบอยู่ แต่ยกเลิก session ไม่สำเร็จ แล้วกดออกจากระบบ | แสดง 'ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง' และยังไม่แสดงว่าออกจากระบบแล้ว | stub (เบราว์เซอร์ตอบ 500 แทน API) | Partial · [สคริปต์แล้ว] t1-logout.spec.ts · ยังไม่พิสูจน์กับ API จริง เพราะไม่มีกลไกบังคับให้ logout ล้ม |
| TC-AUTH-UI003-103 | [Recommended] AC-mrr-113 | Positive (alternate) | ผู้ใช้ที่ยังไม่ได้เข้าสู่ระบบเปิดหน้าออกจากระบบ | แสดงหน้า 'ออกจากระบบแล้ว' พร้อมทางเข้าสู่ระบบอีกครั้ง เหมือนกับผู้ที่เพิ่งออกจากระบบ | real | Yes |

### B4. [Recommended] อุปกรณ์เสริม (BR-mrr-002) — ฝั่ง "เลือก" ที่ EX ไม่มี

ไม่อยู่ใน CSV เพราะไม่มี EX รองรับ (EX-005 คลุมฝั่ง "ไม่เลือก" แล้ว) · technique EP · สคริปต์ `t1-equipment.spec.ts` · ข้อมูล: E2E Projector / E2E Whiteboard (§C ข้อ 6)

| TC ID | Source | Type | Scenario | Expected Result | Data Source | Script |
|---|---|---|---|---|---|---|
| TC-BKG-UI006-104 | [Explicit EX-mrr-119] + [Recommended] BR-mrr-002@v1 | Positive | เลือกอุปกรณ์เสริม 1 รายการแล้วจองผ่านฟอร์ม | รับการจอง (CONFIRMED) · บันทึกอุปกรณ์ตรงที่เลือกใน booking_equipment_requests | real | t1-equipment.spec.ts |
| TC-BKG-UI006-105 | [Recommended] BR-mrr-002@v1 | Positive | เลือกอุปกรณ์เสริมทั้ง 2 รายการ | ตอบ 201 (สร้างการจอง) · บันทึกอุปกรณ์ E2E Projector และ E2E Whiteboard ครบทั้งสองใน booking_equipment_requests · [Inferred] สถานะ CONFIRMED เหมือนเคส 104 แต่สคริปต์ยังไม่ตรวจสถานะของเคสนี้ | real | t1-equipment.spec.ts |
| TC-BKG-UI006-106 | [Recommended] BR-mrr-002@v1 · [TBD] OQ-T1-13 | Negative | ส่งอุปกรณ์เสริมที่ไม่มีอยู่ (ยิงตรง) | 400 "ไม่พบอุปกรณ์เสริมบางรายการ" (ข้อความจากโค้ด) · ไม่เกิดการจอง | real | t1-equipment.spec.ts |

### B5. [Recommended] ร่าง EX A/B/C — ตรวจเวลาค้นหาและข้อความยืนยันลบห้อง (ยังไม่มี EX จาก req)

ประโยคมาจากคำตัดสินของ PO/BA 2026-11-18 (ตามโค้ด) · ร่าง EX อยู่ใน req-request-ex-validation-delete-2026-11-18.md · สคริปต์ `t1-draft-ex.spec.ts` · เมื่อ req ออก EX ให้ผูก TC เข้ากับ EX นั้นและเปลี่ยน Tag เป็น [Explicit] · ร่าง D (กดไม่ยืนยันตอนลบ) และ E (ลบห้องที่มีการจอง) **ไม่มีเคส** เพราะยังไม่มีคำตอบ (OQ-T1-12)

| TC ID | Source | Type | Scenario | Expected Result | Data Source | Script |
|---|---|---|---|---|---|---|
| TC-BKG-UI004-104 | [Recommended] ร่าง EX A · BR [TBD] OQ-T1-11 | Negative | ค้นหาโดยเวลาสิ้นสุดก่อนเวลาเริ่ม (14:00 → 13:00) | ไม่ค้นหา · ไม่มีคำขอไป API · แสดง 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม' · API ยิงตรงตอบ 400 ประโยคเดียวกัน | real | t1-draft-ex.spec.ts |
| TC-BKG-UI004-105 | [Recommended] ร่าง EX B · BR [TBD] OQ-T1-11 | Boundary | เวลาเริ่มเท่ากับเวลาสิ้นสุด (14:00 → 14:00) | ไม่ค้นหา (ไม่มีหัวข้อ 'ผลการค้นหา') · ไม่มีคำขอไป API · แสดง 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม' · API ยิงตรงตอบ 400 ประโยคเดียวกัน (ตอบแล้วว่าเท่ากันถูกปฏิเสธ) | real | t1-draft-ex.spec.ts |
| TC-BKG-UI004-106 | [Recommended] ขอบ BVA ฝั่งผ่านของ ร่าง EX B | Boundary | สิ้นสุดมากกว่าเริ่ม 1 นาที (14:00 → 14:01) | ค้นหาได้ ไม่มีข้อความตรวจเวลา · [Inferred] จาก 'ต้องมากกว่า' | real | t1-draft-ex.spec.ts |
| TC-RMM-UI013-112 | [Recommended] ร่าง EX C · OQ-T1-12 | Positive | RA กดลบห้อง | ถามด้วย 'ลบห้อง <ชื่อห้อง>' + 'การลบจะเลิกใช้ห้องถาวรและเปิดกลับไม่ได้ การจองเดิมคงไว้ ยืนยันลบหรือไม่' ตรงตัวอักษร · ตอนถามห้องยัง ACTIVE | real | t1-draft-ex.spec.ts |

### B5b. [Recommended] DEF-04 — ปฏิเสธโดยไม่ระบุเหตุผลผ่านหน้าจอจริง (EX-mrr-123 คลุมระดับ API ที่ TC-AUD-UI010-112 ใน §B2)

ไม่อยู่ใน CSV เพราะเป็นเคสระดับหน้าจอที่ EX-mrr-123 ไม่ได้ระบุ (EX ระบุผลลัพธ์ ไม่ระบุว่าผ่านปุ่มหรือ API) · ที่มา: BR-mrr-017@v2 + EX-mrr-123 · สคริปต์ `t1-round2.spec.ts` · Dev บังคับเหตุผลแล้ว (UI-mrr-009 ช่องเหตุผล + API 400) ด้วยถ้อยคำ 'กรุณาระบุเหตุผล' ที่เจ้าของยืนยัน 2026-11-18 และ design รับแล้ว (ADR-010, ADR-011) · ผ่านกับระบบจริง

| TC ID | Source | Type | Scenario | Expected Result | Data Source | Script |
|---|---|---|---|---|---|---|
| TC-AUD-UI009-101 | [Recommended] BR-mrr-017@v2 · EX-mrr-123 · DEF-04 (ถ้อยคำยืนยันแล้ว · รูปแบบช่องเหตุผลคือที่ design รับใน ADR-010) | Negative + Positive | RA กด 'ปฏิเสธ' บน UI-mrr-009 → กด 'ยืนยันปฏิเสธ' โดยไม่กรอกเหตุผล แล้วกรอกเหตุผลและกดอีกครั้ง | ครั้งแรกแจ้ง 'กรุณาระบุเหตุผล' และไม่ส่งคำขอ (สถานะยังรออนุมัติ ไม่มีร่องรอย) · ครั้งที่สองแจ้ง 'ปฏิเสธการจองสำเร็จ' · ร่องรอยมี 1 รายการ การกระทำ REJECT พร้อมเหตุผล | real | t1-round2.spec.ts |

### B6. ผลรันสคริปต์รอบ 2 (2026-11-18 · Chromium · ระบบจริง · รันเฉพาะ t1-round2.spec.ts + t1-equipment.spec.ts — ยังไม่ใช่ T3)

| TC ID | EX | ผล | สิ่งที่พบ (หลักฐานจากสคริปต์และโค้ด) | ประเภทเบื้องต้น |
|---|---|---|---|---|
| TC-NTF-JOB-109 | EX-mrr-111 | ผ่าน | — | — |
| TC-NTF-JOB-110 | EX-mrr-112 | ข้าม (test.fixme) | ยังไม่มี fixture ผู้รับล้มเฉพาะ U3 · OQ-T1-15 | Environment (ขาดกลไก) |
| TC-BKG-UI006-107 | EX-mrr-113 | ผ่าน | — | — |
| TC-NTF-UI006-102 | EX-mrr-114 | ผ่าน | — | — |
| TC-NTF-UI009-102 | EX-mrr-115 | ผ่านหลังแก้ | รอบแรกล้ม: Email ใช้คำ 'อนุมัติ' (v1) · แก้ booking-notifier.ts เป็น 'อนุมัติแล้ว' | Product Bug (แก้แล้ว) |
| TC-NTF-UI008-105 | EX-mrr-116 | ผ่านหลังแก้ | รอบแรกล้ม: ระบบใช้คำ 'ยกเลิก' · แก้เป็น 'ยกเลิกการจอง' | Product Bug (แก้แล้ว) |
| TC-NTF-UI010-101 | EX-mrr-117 | ผ่านหลังแก้ | root cause เดียวกับ EX-116 | Product Bug (แก้แล้ว) |
| TC-NTF-UI009-103 | EX-mrr-118 | ผ่านหลังแก้ | Email 'ปฏิเสธการจอง:' ถึง U1/U2 และร่องรอยผ่านหลังแก้ · เจ้าของตอบว่าข้อความที่ถูกคือ 'ปฏิเสธการจองสำเร็จ' (EX-118 แก้เป็น 'ปฏิเสธการจองสำเร็จ' แล้ว 2026-11-18 ตามเจ้าของ · OQ-T1-16) | No Defect ฝั่งระบบ · แก้ EX แล้ว |
| TC-BKG-UI006-104 | EX-mrr-119 | ผ่าน | เพิ่มตรวจข้อความ 'จองห้องสำเร็จ' · EX ระบุผู้เข้าร่วม 3 คน เคสนี้ใช้ 1 คน | — |
| TC-AUD-UI010-109 | EX-mrr-120 | ผ่านหลังแก้ | API /reject รับและบันทึกเหตุผล · ป้าย 'ปฏิเสธการจอง' ผ่าน · ข้อความ 'ปฏิเสธการจองสำเร็จ' ตามเจ้าของ (EX-120 แก้แล้ว · OQ-T1-16) · บังคับเหตุผลแล้ว (DEF-04 → TC-AUD-UI010-112, TC-AUD-UI009-101) | No Defect ฝั่งระบบ · แก้ EX แล้ว |
| TC-AUD-UI010-110 | EX-mrr-121 | ผ่านหลังแก้ | รอบแรกล้ม: ป้ายเป็น 'เปลี่ยนผลการอนุมัติ' · แก้ AuditTrail.tsx เป็น 'ถอยผล' | Product Bug (แก้แล้ว) |
| TC-AUD-UI010-111 | EX-mrr-122 | ผ่านหลังแก้ | เจ้าของตอบว่าข้อความที่ถูกคือ 'บันทึกการแก้ไขสำเร็จ' (EX-122 แก้เป็น 'บันทึกการแก้ไขสำเร็จ' แล้ว · OQ-T1-16) · ร่องรอยและป้าย 'แก้แทนผู้จอง' ผ่าน | No Defect ฝั่งระบบ · แก้ EX แล้ว |

เคสที่ล้มทั้งหมดเป็นการตรวจถ้อยคำตาม EX (แหล่งความจริง) — ไม่ได้ปรับ assertion ให้ผ่าน · ประเภทเบื้องต้นยังต้องยืนยันใน T3

### B7. Review เคสรอบ 4 (TC-RPT-RPT001-111–114 · EX-mrr-125–128)

**สถานะ: QA review เสร็จสมบูรณ์ (completed) · ผู้ review: QA_Noppasorn · 2026-11-20 · ขอบเขต: TC-RPT-RPT001-111–114 (EX-mrr-125–128) และการแก้ข้อความของ 107–110 (R9)** — AI pre-review ทำก่อน (ตาราง R1–R9) แล้วเจ้าของงานอ่านและสั่งลงชื่อในเซสชัน QA · ข้อ R9 (เคสเดิม 107–110) ปิดแล้วและอยู่ในขอบเขตการลงชื่อนี้ (ดูแถว R9) · ผลรันไม่ใช่การ review

| # | สิ่งที่ตรวจ | ผล | สถานะ |
|---|---|---|---|
| R1 | Test Data ของ 111–114 บอกว่า "วันที่ใช้วันอนาคตแบบสุ่ม" แต่เคสใช้เดือนอดีตคงที่ (2007-03 · 2008-05 · 2010-07 · 2011-12) และสร้างการจองด้วย SQL | ผิดจริง | **แก้แล้ว 2026-11-20** — เขียน Test Data ใหม่ของ 4 เคสให้ตรงสคริปต์ (CSV) |
| R2 | EX เขียนว่า "ต.ค. 2569" และห้อง R50/R51/R52 แต่ fixture ใช้เดือน/ชื่ออื่น (เดือนที่เริ่มวันพฤหัส 31 วันให้ปฏิทินเท่า ต.ค. 2569 · P50/P51) | ช่องว่างของเอกสาร | **แก้แล้ว** — บันทึกการแมปไว้ใน Test Data ของแต่ละเคส |
| R3 | ช่อง Scenario ของ 107–114 ซ้ำกันทุกเคส ("Room Administrator เปิดรายงานการใช้ห้องเดือน ต.ค. 2569") เพราะคัดจากช่อง 'เมื่อ' ของ EX | ไล่แยกเคสด้วย Scenario ไม่ได้ (ต้องดูช่อง TC ID/EX) | **แก้แล้ว 2026-11-20** (ตามที่เจ้าของเลือก) — ตั้ง Scenario เฉพาะเคสให้ 111–114 · เคสเดิม 107–110 ยังซ้ำกัน (ยังไม่แก้) |
| R4 | Expected ของ 111–114 เทียบกับ `then` ของ EX-125–128 ใน spec.json | ตรงทุกตัวอักษร (ตรวจด้วยสคริปต์) | ผ่าน |
| R5 | ลิงก์ BR/EX | ทั้งสี่ผูก BR-mrr-006@v2 (is_current) และ EX ที่ validated และ `proves` ตรงกัน | ผ่าน |
| R6 | สคริปต์เทียบ Expected | 111 ตรวจ % และ rank ของ A/B/D + API · 112 ตรวจนาที (60/59/58) % และ rank · 113 ตรวจ A/B/C/E + API (E เป็น null) · 114 ตรวจแถวสุดท้ายหน้า 1 แถวแรกหน้า 2 อันดับ 52 และ API · ข้อที่ตรวจทางอ้อม: "ไม่ถูกนับเป็นอันดับถัดไป" ของ 113 (ตรวจผ่าน C = 3 และ E ไม่มีอันดับ) | ยอมรับได้ | ผ่าน (มีข้อสังเกต) |
| R7 | พิสูจน์ว่า assertion ล้มได้ (เปลี่ยน Expected เป็นค่าผิดแล้วต้องล้ม) | ทำครบทั้ง 4 เคส: 111 (D อันดับ 2 → ล้ม Received 3) · 112 (G อันดับ 2 → ล้ม Received 1) · 113 (C อันดับ 4 → ล้ม Received 3 · E อันดับ 4 → ล้ม Received "") · 114 (P51 อันดับ 51 → ล้ม Received 50) — รันสำเนาที่แก้ Expected แล้วลบทิ้ง 2026-11-20 | **ผ่าน** |
| R8 | ผลรัน: ผ่านทั้ง 4 (ทั้งชุด chromium 172 ผ่าน · 0 ล้ม) | ผลรันไม่ใช่การ review | บันทึกไว้ที่ t3-results-2026-11-19.md |
| R9 | เคสเดิม 107–110 (EX-084–087) มี Test Data "วันอนาคตแบบสุ่ม" ทั้งที่ใช้เดือนอดีต และ Scenario ซ้ำกัน | **ตรวจทีละเคสแล้ว 2026-11-20: ผิดจริงทั้ง 4** (Expected ตรงกับ EX และผูก BR-mrr-006@v2 ถูกต้อง) | **แก้แล้ว** — Test Data เฉพาะเคส (เดือน · ห้อง · นาที ตามสคริปต์) และ Scenario เฉพาะเคส · negative check ของ 107–110 ทำแล้ว 2026-11-20: 107 (A อันดับ 3 → ล้ม Received 2) · 108 (C 0.46% → ล้ม Received 0.45%) · 109 (ตัวหาร 10,300 → ล้ม Received 10,200) · 110 (E 0.00% → ล้ม Received —) · **QA review ของ 107–110 (ข้อความ Test Data/Scenario ที่แก้) completed โดย QA_Noppasorn 2026-11-20** — บันทึกตามที่เจ้าของงานสั่งในเซสชัน QA (ขอบเขต: เฉพาะการแก้ Test Data/Scenario และ negative check ข้างต้น ไม่รวมการเปลี่ยนสคริปต์เพราะไม่ได้แก้สคริปต์) · รอบ 1 เคยเป็น review ไว้ 2026-11-18

### B9. เคสที่เดิมใช้รหัสซ้ำในสคริปต์ — แยกรหัสใหม่ 2026-11-20

เดิมรหัสเดียวมีสคริปต์สองตัวที่ตรวจต่างกัน (ผลรันบอกไม่ได้ว่าตัวไหนล้ม) · สคริปต์ที่ตรงกับแถวใน CSV/EXISTING คงรหัสเดิม ตัวที่เหลือได้รหัสใหม่ตามด้านล่าง · **เปลี่ยนแค่ชื่อเคสในสคริปต์ ไม่แก้ตรรกะ** · ผลรันของ 4 เคสนี้ยังไม่ได้รันซ้ำหลังเปลี่ยนชื่อ (ตรวจแค่ว่าคอมไพล์และนับเคสได้ 174 เท่าเดิม) · ข้อความ Expected เขียนจากชื่อเคสและ assertion ในสคริปต์ ไม่ใช่คัดจาก EX · **QA review เสร็จ (completed) โดย QA_Noppasorn 2026-11-20** — บันทึกตามที่เจ้าของงานสั่งในเซสชัน QA ขอบเขต: รหัสใหม่ · ลิงก์ BR/EX (ตรวจกับ spec.json: EX-019/054/062/100 validated และ proves ตรงกัน) · Expected เทียบกับ assertion ของสคริปต์ (อ่านแล้ว) · **ไม่รวม negative check** ของสี่เคสนี้ (ไม่ได้ทำ เพราะไม่ได้แก้สคริปต์ แค่เปลี่ยนชื่อ) 

| TC ID ใหม่ | เดิม | Requirement | Type | Expected (ตามสคริปต์) | Data Source | Script |
|---|---|---|---|---|---|---|
| TC-BKG-UI006-108 | ส่วนที่ TC-BKG-UI006-026 ยังไม่คลุม | BR-mrr-007@v2 / EX-mrr-019 (ส่วนที่ 026 ไม่คลุม) | Positive | จองสำเร็จโดยมีผู้เข้าร่วม u2, u3 → Email หัวเรื่อง '[จองห้องประชุม] จองสำเร็จ: <หัวข้อ>' ถึง u1 คนเดียว ผู้เข้าร่วมไม่ได้รับ | real | t1-clock.spec.ts |
| TC-BKG-UI006-109 | TC-BKG-UI006-027 (real) | BR-mrr-019@v1 / EX-mrr-062 | Negative | ส่งอีเมลไม่สำเร็จตอนจอง (หยุด mailpit) → API ตอบ 503 ข้อความ 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง' · ไม่สร้างการจอง · จองช่วงเดียวกันซ้ำหลังเมลกลับสำเร็จ (201) | real | t1-jobs.spec.ts |
| TC-AUD-UI010-113 | TC-AUD-UI010-102 (ตัวที่ใน t1-roles) | BR-mrr-017@v2 / EX-mrr-054 (ส่วนหน้าจอ) | Positive | RA อนุมัติการจอง → หน้า UI-mrr-010 แสดงการกระทำ 'อนุมัติ' และชื่อผู้ทำตรงกับร่องรอยจาก API | real | t1-roles.spec.ts |
| TC-AUTH-UI002-107 | TC-AUTH-UI002-101 (ตัวที่ใน t1-clock) | BR-mrr-027@v1 / EX-mrr-100 (ขอบ 1 วินาทีก่อนหมดอายุ) | Boundary | เลื่อนนาฬิกา api เป็น 1 วินาทีก่อนรหัสหมดอายุ แล้วกรอกรหัส → เข้าสู่ระบบได้ (/auth/me ตอบ 200) | real | t1-clock.spec.ts |

คงรหัสเดิมไว้ที่: TC-BKG-UI006-026 (booking.spec.ts) · TC-BKG-UI006-027 (booking.spec.ts · [stub]) · TC-AUD-UI010-102 (t1-clock.spec.ts · EX-mrr-055 ตรงกับแถวใน CSV) · TC-AUTH-UI002-101 (t1-yes.spec.ts · EX-mrr-100 ตรงกับแถวใน CSV)

### B8. ตรวจ Test Data ของเคสที่ใช้ข้อความเริ่มต้นเดียวกัน (2026-11-20 · R9 ขยายขอบเขต)

ข้อความเริ่มต้นเดิม "วันที่ใช้วันอนาคตแบบสุ่ม ไม่ใช้วันที่ใน EX" ถูกใส่ให้ทุกเคสตอนออกแบบ · ตรวจ **เฉพาะสัญญาณที่อยู่ในตัวเคสโดยตรง** (`nearSlot(` · `setClock(` · `MONTHS.`) ไม่ตามฟังก์ชันช่วยหรือขั้นเตรียมของไฟล์ — จึงยืนยันได้เท่าที่เห็น ส่วนที่ไม่เห็นสัญญาณไม่ได้ถือว่าถูก

| กลุ่มสัญญาณในตัวเคส | จำนวน | ผลต่อข้อความเดิม | สิ่งที่ทำ | เคส |
|---|---|---|---|---|
| nearSlot | 36 | ตรงกับสคริปต์ (เลือกช่องเวลาอนาคตเอง) | คงข้อความเดิม | TC-APR-UI009-101, TC-APR-UI009-102, TC-APR-UI009-103, TC-APR-UI009-104, TC-APR-UI009-105, TC-APR-UI010-102, TC-APR-UI010-109, TC-APR-UI010-110, TC-AUD-UI010-101, TC-AUD-UI010-103, TC-AUD-UI010-104, TC-BKG-UI004-101, TC-BKG-UI004-102, TC-BKG-UI004-103, TC-BKG-UI006-022, TC-BKG-UI006-028, TC-BKG-UI006-101, TC-BKG-UI006-102, TC-BKG-UI006-107, TC-BKG-UI008-101, TC-CAL-UI005-104, TC-MYB-UI007-102, TC-MYB-UI007-103, TC-NTF-UI006-102, TC-NTF-UI008-101, TC-NTF-UI008-103, TC-NTF-UI008-104, TC-NTF-UI008-105, TC-NTF-UI009-101, TC-NTF-UI009-102, TC-RMM-UI012-102, TC-RMM-UI013-105, TC-RMM-UI013-106, TC-RMM-UI013-108, TC-RMM-UI013-109, TC-RMM-UI013-110 |
| setClock,nearSlot | 20 | ไม่ครบ — ไม่บอกว่าเลื่อนนาฬิกา api | เพิ่มประโยคนาฬิกา | TC-APR-JOB-103, TC-APR-UI010-101, TC-APR-UI010-105, TC-APR-UI010-106, TC-APR-UI010-108, TC-AUD-UI010-102, TC-AUD-UI010-109, TC-AUD-UI010-110, TC-AUD-UI010-111, TC-AUD-UI010-112, TC-BKG-UI006-103, TC-MYB-UI007-104, TC-MYB-UI007-105, TC-NTF-JOB-108, TC-NTF-JOB-109, TC-NTF-UI006-101, TC-NTF-UI009-103, TC-NTF-UI010-101, TC-NTF-UI010-102, TC-RMM-UI013-107 |
| setClock | 15 | ไม่ครบ/อาจผิด — เคสเลื่อนนาฬิกา การจองหรือรหัสสร้างจากฟังก์ชันช่วย | เขียนใหม่ + ติดป้าย [ไม่ได้ตรวจเป็นรายเคส] | TC-APR-JOB-101, TC-APR-JOB-102, TC-APR-UI009-106, TC-APR-UI010-107, TC-APR-UI011-101, TC-APR-UI011-102, TC-AUTH-UI001-105, TC-AUTH-UI001-106, TC-AUTH-UI002-102, TC-NTF-JOB-101, TC-NTF-JOB-102, TC-NTF-JOB-103, TC-NTF-JOB-105, TC-NTF-JOB-106, TC-NTF-JOB-107 |
| MONTHS | 4 | **ผิด** — ใช้เดือนอดีตคงที่ของ fixture รายงาน | เขียนใหม่ตามสคริปต์ | TC-RPT-RPT001-101, TC-RPT-RPT001-102, TC-RPT-RPT001-103, TC-RPT-RPT001-104 |
| manual | 35 | **อ่านสคริปต์ทีละเคสแล้ว (2026-11-20)** — ผู้ใช้ ห้อง วันเวลา และสิ่งที่เตรียมต่างกันมากตามเคส เช่น หน้าจอผ่านฟังก์ชันช่วย · จัดห้อง · เข้าสู่ระบบ · ปฏิทิน | เขียน Test Data เฉพาะเคส | TC-APR-UI010-103, TC-APR-UI010-104, TC-AUD-UI010-105, TC-AUD-UI010-106, TC-AUD-UI010-107, TC-AUD-UI010-108, TC-AUTH-UI001-101, TC-AUTH-UI001-102, TC-AUTH-UI001-103, TC-AUTH-UI001-104, TC-AUTH-UI001-107, TC-AUTH-UI001-108, TC-AUTH-UI001-109, TC-AUTH-UI002-101, TC-AUTH-UI002-103, TC-AUTH-UI002-104, TC-AUTH-UI002-105, TC-AUTH-UI002-106, TC-CAL-UI005-101, TC-CAL-UI005-102, TC-CAL-UI005-103, TC-MYB-UI007-101, TC-MYB-UI008-101, TC-NTF-JOB-104, TC-NTF-JOB-110, TC-NTF-UI008-102, TC-RMM-UI012-101, TC-RMM-UI013-101, TC-RMM-UI013-102, TC-RMM-UI013-103, TC-RMM-UI013-104, TC-RMM-UI013-111, TC-RMM-UI014-101, TC-RPT-RPT001-105, TC-RPT-RPT001-106 |
| none | 0 | ยืนยันไม่ได้ — ไม่เห็นสัญญาณในตัวเคส | แทนด้วยข้อความกลาง + ป้าย [ยังไม่ได้ยืนยัน] | — |
| no-body | 0 | ยืนยันไม่ได้ — สคริปต์สร้างชื่อเคสจาก loop | แทนด้วยข้อความกลาง + ป้าย | — |

**ข้อจำกัดที่ต้องรู้:** กลุ่ม `nearSlot` 36 เคสและกลุ่มนาฬิกา 35 เคสจำแนกจากสัญญาณในตัวเคสเท่านั้น (ไม่ตามฟังก์ชันช่วย) · กลุ่มนาฬิกาเขียนประโยคกลางเรื่องนาฬิกา api ไม่ได้ระบุเวลาที่เลื่อนของแต่ละเคส · 35 เคสในกลุ่ม manual อ่านสคริปต์ทีละเคสแล้วแต่ **ไม่ได้รันเทียบ** — ข้อมูลที่เขียนมาจากการอ่านโค้ด

**ข้อค้นพบ (แก้แล้ว 2026-11-20 ดู §B9): รหัสเคสซ้ำในสคริปต์** — TC-BKG-UI006-026 (booking.spec.ts · t1-clock.spec.ts) · TC-BKG-UI006-027 (booking.spec.ts · t1-jobs.spec.ts) · TC-AUD-UI010-102 (t1-clock.spec.ts · t1-roles.spec.ts) · TC-AUTH-UI002-101 (t1-yes.spec.ts · t1-clock.spec.ts) — รหัสเดียวมีสคริปต์สองตัวที่ตรวจต่างกัน แต่ CSV มีแถวเดียว ผลรันจึงบอกไม่ได้ว่าตัวไหนล้ม · แยกรหัสแล้ว: 108 · 109 · AUD-113 · AUTH-UI002-107 (TC-BKG-UI006-026 ไม่ใช่รหัสซ้ำจริง — ชื่อเคสของ t1-clock อ้างถึง 026 ในข้อความ)

## C) Test Data Requirement (สิ่งที่ dev ต้องเตรียม)

| # | ต้องมี | ใช้กับ | หมายเหตุ |
|---|---|---|---|
| 1 | ผู้ใช้ทั่วไปเพิ่มอีก ≥ 3 คน (U2, U3, U4) ที่ล็อกอินได้ และมีกล่องจดหมายใน mailpit | EX-004, 010, 011, 021, 030, 033, 034, 056, 061, 068–071, 083, 080 | [พร้อมแล้ว] ACCOUNTS ใน test/e2e/support/accounts.ts: global-setup seed U2–U4 และล็อกอินให้ (ก่อนหน้านี้ dev มีผู้ใช้ล็อกอินเดียว `tester@mrr.local`) |
| 2 | Room Administrator ≥ 2 คน (RA1, RA2) ที่ล็อกอินได้ | EX-013, 028–029, 035–045, 054–061, 078–080, 015–016, 042 และอื่น ๆ | ต้อง 2 คน เพราะกฎ 'คนอื่นที่ไม่ใช่คนแก้อนุมัติ' (BR-014) และ 'ผู้อนุมัติประจำห้อง' (BR-013) · [พร้อมแล้ว] ra1, ra2 |
| 3 | System Administrator ≥ 1 คน | EX-018, 059, 073, 088, 089 | พิสูจน์ว่าบทบาทนี้ถูกปฏิเสธ (ห้ามแก้ห้อง/ดูรายงาน/เปลี่ยนผล) · [พร้อมแล้ว] sa |
| 4 | บัญชี HR ที่ไม่ active (U5) และอีเมลนอกรายชื่อ (U9) | EX-098, 099 | ข้อมูลสังเคราะห์เท่านั้น ห้ามใช้อีเมลพนักงานจริง · [พร้อมแล้ว] u5 = e2e.u5.inactive@mrr.local |
| 5 | ห้อง E2E เฉพาะ: ห้องไม่ต้องอนุมัติ, ห้องต้องอนุมัติ (ไม่กำหนดผู้อนุมัติ), ห้องต้องอนุมัติ + กำหนด RA1, ห้องปิดปรับปรุงที่มีการจองเดิม | EX-004, 013, 016, 039–042, 081–083 ฯลฯ | อย่าแก้ห้อง A/B ของ dev ตรง ๆ — ใช้ห้อง E2E เฉพาะเพื่อไม่กระทบ suite เดิม · วิธีลบห้อง (DQ-mrr-003 open) · [พร้อมแล้ว] ROOMS ใน accounts.ts + E2E-SRCH-* (support/search-fixture.ts) · ห้องที่ไม่มีการจองลบด้วย SQL ได้ ส่วนห้องที่เคยมีการจองหรือช่วงปิดปรับปรุงลบไม่ได้ (FK) จึงเก็บถาวร |
| 6 | สิ่งอำนวยความสะดวก ≥ 2 รายการใน dev | BR-002 (อุปกรณ์เสริม) | dev มี 0 รายการ จึงทดสอบกับ API จริงไม่ได้ (test/README) · [พร้อมแล้ว 2026-11-18] global-setup สร้าง E2E Projector / E2E Whiteboard ผ่าน API (FACILITIES ใน accounts.ts) · ลบไม่ได้ จึงค้างถาวร · ใช้ใน §B4 (TC-BKG-UI006-104–106) |
| 7 | fixture รายงานตาม GD-mrr-001 (ห้อง A–E เดือน ต.ค. 2569: ชั่วโมงทำการ 13,200 นาที, ห้อง D ปิดซ่อม 3,000 นาที, ห้อง E ชั่วโมงทำการ 0) | EX-084–087, 047–049 | [พร้อมแล้ว] test/e2e/support/report-fixture.ts seed ห้อง E2E Rpt A–E ด้วย SQL (การจองย้อนหลัง) · แต่ละเคสใช้เดือนอดีตของตัวเองที่ปฏิทินเหมือน ต.ค. 2569 (1 = พฤหัส · 31 วัน · จ.–ศ. 22 วัน = 13,200 นาที) เพราะรายงานจัดอันดับทุกห้อง · ตัวเลขตาม GD-mrr-001 |
| 8 | การจองที่ผ่านเวลาจบประชุมแล้ว | EX-043, 045, 046 | สร้างด้วยการย้อนเวลา หรือ seed ตรงใน DB ที่ test ใช้เท่านั้น [TBD] · [พร้อมแล้ว] ย้อนเวลาด้วย /__test/clock (t1-clock.spec.ts) |
| 9 | fixture รายงานอันดับเท่ากัน (รอบ 4): 3 เดือนแยกกัน เริ่มวันพฤหัส 31 วัน (ให้ 5/เดือน เป็นวันจันทร์ และมี 22 วัน จ.–ศ. = 13,200 นาที เหมือน fixture เดิม) ที่ยังไม่ถูกใช้ใน support/report-fixture.ts · ห้อง A/B/D (EX-125), F/G/H (EX-126), A/B/C/E (EX-127) ชื่อขึ้นต้น E2E Rpt | EX-125, 126, 127 | Dev เพิ่มใน support/report-fixture.ts · จองด้วย SQL (ย้อนหลัง) เหมือนเคสเดิม · ห้อง E ปิดปรับปรุงทั้งเดือน · ใช้นาที 60/60/0 · 60/59/58 · 60/60/0 ตาม EX |

กติกาข้อมูล: ใช้ข้อมูลสังเคราะห์ · หัวข้อขึ้นต้น `E2E` · วันที่ในอนาคตแบบสุ่มเพื่อไม่ชนกัน (วันที่ใน EX เช่น 17/10 เป็นตัวอย่างเชิงตรรกะ ไม่ใช่วันที่ต้องใช้จริง)

## D) Open Questions (TBD)

| ID | คำถาม | กระทบ | ผู้ตอบที่เสนอ |
|---|---|---|---|
| OQ-T1-01 | [ปิดแล้ว] ควบคุมเวลาฝั่งเซิร์ฟเวอร์: api มี `POST /__test/clock` (เปิดเฉพาะเมื่อ ENABLE_TEST_CONTROLS=true · dev compose เปิดไว้ ค่าเริ่มต้นปิด) · ใช้ผ่าน test/e2e/support/clock.ts | เคสที่ใช้เวลาเสร็จแล้ว (ดู t1-clock.spec.ts) | Dev lead |
| OQ-T1-02 | [ปิดแล้ว] พบว่า ReminderJob / AutoCancelJob ไม่ได้รันจริงใน api (ไม่มี store ต่อ Postgres ไม่ได้ลงทะเบียนใน AppModule) → ต่อแล้ว: PgReminderStore, PgAutoCancelStore และลงทะเบียนใน AppModule · เทสต์สั่งรันรอบหนึ่งผ่าน /__test/jobs/run (จำกัดตามหัวข้อ) | BR-008, 016, 020, 023 เป็นของจริงแล้ว | Dev lead |
| OQ-T1-03 | [ปิดแล้ว] จำลองอีเมลล่มแบบ real ด้วยการหยุด container mailpit (support/mail.ts) · ส่วน transaction boundary ยังเป็น DQ-mrr-005 / DQ-mrr-014 ที่ PO ยังไม่ตอบ (เคสพิสูจน์พฤติกรรมปัจจุบัน: ล้มทั้งการกระทำ ไม่สร้าง/ไม่เปลี่ยนข้อมูล) | BR-019, 024 | Dev lead + PO |
| OQ-T1-04 | ผู้ใช้ 'ปุ่มถูกซ่อน' (EX-010, 014, 017, 018, 048, 060, 061, 073, 074) — ยอมรับให้ทดสอบด้วยการยิงคำสั่งตรงผ่าน session ของ browser (Playwright `request`) เป็น E2E หรือควรจัดเป็นระดับ API | การจัดระดับเคสต่อ Test Level | QA Lead |
| OQ-T1-05 | EX ที่อ้าง 'ผู้ใช้อีกคน' (EX-003, 004) ยอมรับผู้จองคนเดียวกันได้หรือไม่ เพราะ test/README ใช้ผู้จองคนเดียวมาก่อน | EX-003, 004 และความหมายของ 'พิสูจน์ข้ามผู้ใช้' | PO |
| OQ-T1-06 | [ปิดแล้ว] EX-031/032 (เดิมพิสูจน์ BR-mrr-010@v1 ที่ถูก v2 แทน): BA/PO เลือกเขียนใหม่ให้ตรง v2 (ทางเลือก B) → แก้ใน spec.json แล้ว (proves = BR-mrr-010@v2) · เคส TC-RMM-UI013-108/109 ยืนยันตาม then ใหม่ตรงตัวอักษร · หมายเหตุ: ซ้อนกับ EX-078/079 ที่ given/when เดียวกัน | EX-031, 032 | BA / PO |
| OQ-T1-07 | ตัวเลขรายงานในเคสรายงาน (EX-084–087) ผูกกับ GD-mrr-001 · DQ-mrr-010 (decimal ใน DB) ยัง open — หน้าจอแสดง 2 ตำแหน่งตาม EX แต่ไม่ได้ระบุว่าเก็บกี่ตำแหน่ง | EX-084–087 | PO |
| OQ-T1-08 | ปฏิทิน: DQ-mrr-011 (หัวหน้าเห็นรายละเอียดลูกน้องไหม) ยัง open — EX-068–071 ไม่คลุมกรณีนี้ จึงไม่เขียนเคส | BR-021 | PO |
| OQ-T1-10 | [ปิดแล้ว 2026-11-18 · PO/BA: รับเป็นเคสนอก BR ได้] ออกจากระบบ (UI-mrr-003 · AC-mrr-111–113) ไม่มี BR/EX — req ตอบว่าเป็นฟังก์ชันแพลตฟอร์ม (Q3.1) ทำให้ไม่มีเคสที่ผูก BR ได้ตามกฎข้อ 3 · QA เสนอเคส [Recommended] ใน §B3 แยกจาก CSV · ขอ PO ยืนยันว่ารับเป็นเคสนอก BR (Test Level E2E) | AC-111–113 (3 เคสเสนอ) | PO / BA |
| OQ-T1-11 | [ตอบแล้ว 2026-11-18 · รอ req เขียน EX] (1) ตอบ: เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม — ตัดสินแล้วให้ใช้ข้อความตามโค้ด: 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม' · ยังไม่มี EX จึงยังไม่ออกแบบเคส (รอ req เขียน EX · ตอบแล้ว: เวลาเริ่มเท่ากับเวลาสิ้นสุดถูกปฏิเสธด้วย → ขอบ BVA: สิ้นสุด < เริ่ม / = เริ่ม ปฏิเสธ · เริ่ม+1 นาที ผ่าน) (2) ตอบ: 'ทุกห้อง' = ทุกห้องในระบบ → EX-107 ต้องล็อกทุกห้องใน dev ไม่ใช่เฉพาะห้อง fixture · ค้นหาห้องว่าง — (1) เวลาสิ้นสุดไม่หลังเวลาเริ่ม ข้อความ error คืออะไร (Q1.2 ใน req-questions-search-delete-logout.md · req ยังไม่มี EX) (2) 'ทุกห้อง' ใน EX-107 หมายถึงทุกห้องที่ active ทั้งระบบหรือเฉพาะห้องของ fixture | EX-107 · เคสเวลาไม่ถูกต้อง (ยังไม่ออกแบบ) | BA / PO |
| OQ-T1-12 | [ตอบบางส่วน 2026-11-18 · รอ req เขียน EX] ตัดสินแล้วให้ใช้ข้อความตามโค้ด: 'การลบจะเลิกใช้ห้องถาวรและเปิดกลับไม่ได้ การจองเดิมคงไว้ ยืนยันลบหรือไม่' (ยังไม่มี EX · ผลเมื่อกดยกเลิกยังไม่ระบุ) · TBD - Require Business Confirmation: การจองเดิมของห้องที่ลบเป็นอย่างไร (Q2b) · ลบห้องที่มีการจองในอนาคต — ผู้ใช้เห็นอะไรก่อนยืนยัน และการจองเดิมเป็นอย่างไร (Q2b · req ยังไม่มี EX · STM-mrr-003 บอกแค่ 'การจองเดิมคงไว้') · และข้อความเมื่อลบสำเร็จของ EX-109 ยืนยันแล้ว ('ลบห้องแล้ว') | EX-109 · เคสลบห้องที่มีการจอง (ยังไม่ออกแบบ) | BA / PO |
| OQ-T1-13 | TBD - Require Business Confirmation: อุปกรณ์เสริม — (1) อุปกรณ์ที่เลิกใช้แล้ว (active = false) ในการจอง: ปฏิเสธหรือรับ และข้อความคืออะไร (โค้ดปฏิเสธด้วย 'ไม่พบอุปกรณ์เสริมบางรายการ' แต่ไม่มี BR/EX) (2) จองไปแล้วจึงเลิกใช้อุปกรณ์: การจองเดิมคงไว้หรือไม่ | TC-BKG-UI006-106 · เคสอุปกรณ์เลิกใช้ (ยังไม่ออกแบบ) | BA / PO |
| OQ-T1-14 | [ปิดแล้ว 2026-11-18 · QA ตอบจาก BR-mrr-020@v2 · SRC-028 · .aeon/spec.json] 'บันทึกการส่งเตือน' คือสถานะการเตือนของการจอง (ส่งสำเร็จ / ส่งไม่สำเร็จ) ซึ่งระบบเก็บที่คอลัมน์ bookings.reminder_status (SENT / FAILED) — เคสตรวจค่านี้ผ่าน psql เหมือน TC-NTF-JOB-106 ไม่ต้องมีหน้าจอ | — |
| OQ-T1-15 | [ตอบบางส่วน 2026-11-18 · EX-mrr-112] นิยามตอบแล้ว: ผู้รับบางคนล้ม = บันทึก 'ส่งไม่สำเร็จ' ทั้งการจอง ไม่แยกรายคน การจองยังใช้ได้ งานรอบ 09:50 ไม่ส่งซ้ำ · ยังขาด fixture ที่ทำให้ SMTP ปฏิเสธเฉพาะผู้รับ U3 (mailpit v1.21.8 ในกอง dev ล้มได้ทั้งตัวเท่านั้น) → TC-NTF-JOB-110 เป็น test.fixme | Dev (fixture) |
| OQ-T1-16 | [เจ้าของตอบแล้ว 2026-11-18 · แก้ EX-118/120/122 ใน spec แล้ว · เขียน EX-mrr-124 แล้วและ validate แล้ว] ข้อความที่ถูกคือ 'ปฏิเสธการจองสำเร็จ' และ 'บันทึกการแก้ไขสำเร็จ' — (EX-mrr-118, 120, 122 แก้เติม 'สำเร็จ' แล้ว) · อีกข้อ: เปลี่ยนผลอนุมัติ→ปฏิเสธต้องส่ง Email ถึงผู้จองและผู้เข้าร่วมด้วย (ระบบทำแล้ว) · req เขียน EX-mrr-124 แล้ว (validated) · TC-NTF-UI010-102 ผ่านกับระบบจริง | req |
| OQ-T1-17 | [ตอบแล้ว 2026-11-18 · DEF-04 · BR-mrr-017@v2] ถ้อยคำ error เมื่อ RA ปฏิเสธโดยไม่ระบุเหตุผลคือ 'กรุณาระบุเหตุผล' (เจ้าของยืนยัน) · design รับแล้ว (ADR-010 ช่องเหตุผลบน UI-mrr-009 แบบเปิดใต้แถว · ADR-011 AC-mrr-126) · req เพิ่ม EX-mrr-123 (validated) · ผลต่อเคส: TC-AUD-UI010-112 ผูก EX-mrr-123 · TC-AUD-UI009-101 (หน้าจอจริง) | — |
| OQ-T1-18 | [ปิดแล้ว 2026-11-19 · ตรวจจากโค้ด+รันจริง] ระบบจัดอันดับเสมอกันตาม BR-mrr-006@v2 อยู่แล้ว: `utilization-report.service.ts` ฟังก์ชัน rank ('equal percentages share a rank and the next one skips past them (1, 1, 3)') · ตาราง utilization_report_lines มี unique เฉพาะ (report_id, room_id) ไม่มี unique บน rank · EX-125–127 ผ่านกับระบบจริง · สิ่งที่ไม่รู้: โค้ดนี้มีมาก่อน CHG-mrr-004 หรือเพิ่งแก้ (ไม่ได้ดูประวัติ git) | TC ของ EX-125–127 | Dev / QA (T3) |
| OQ-T1-19 | [ตอบแล้ว 2026-11-19 · ผู้ตอบ: ผู้ใช้ในเซสชัน QA (เจ้าของ) · **บันทึกใน req แล้ว: EX-mrr-128 (validated 2026-11-19)**] อันดับเท่ากันข้ามหน้าของตาราง (มากกว่า 50 ห้อง): เลขอันดับเท่ากันแม้ห้องที่เสมอกันอยู่คนละหน้า (ตามที่ design เขียนไว้ใน screens.json) · EX-mrr-128 เป็น boundary (R50/R51 อันดับ 50 คนละหน้า · R52 อันดับ 52) · เคส TC-RPT-RPT001-114 เขียนสคริปต์และรันผ่านแล้ว 2026-11-19 (fixture 51 ห้อง E2E Rpt P01–P51 เปิดใช้เฉพาะระหว่างเคส) · ขนาดหน้า 50 ห้องยืนยันกับโค้ดแล้ว (`UtilizationReportPage.tsx` PAGE_SIZE = 50 และรายงานนับทุกห้องที่ไม่ใช่ ARCHIVED) | BR-mrr-006@v2 · RPT-mrr-001 | req (บันทึก) / QA (เคส) |
| OQ-T1-09 | NFR-mrr-001–004 (โหลด 200 คน, HTTPS, uptime) ไม่ใช่ระดับ E2E — ไม่อยู่ในขอบเขต T1 รอบนี้ (ดู t2-coverage-report ช่องว่างข้อ 1 และ Q-mrr-004) | NFR | PO |

## Next Actions

1. QA review เคสรอบ 2 (11 เคส) และตรวจว่า Expected ของเคสเดิมที่เปลี่ยนเป็น v2 ยังตรงกับ EX-019–022, 054–057, 066–067
2. Dev: ปรับระบบให้ตรง v2 (CHG-mrr-003) — หัวเรื่อง Email 'อนุมัติแล้ว' / 'ยกเลิกการจอง' · ส่ง Email ตอนปฏิเสธถึงผู้จองและผู้เข้าร่วม · ปฏิเสธต้องมีเหตุผลและบันทึกในร่องรอย · ป้ายร่องรอย 'ปฏิเสธการจอง' / 'ถอยผล' (ดู §B6) · req ยืนยันถ้อยคำ 'ปฏิเสธการจอง' และ 'บันทึกการแก้ไข' ของ EX ว่าตรงกับข้อความระบบหรือไม่
3. Dev: fixture ให้ SMTP ปฏิเสธเฉพาะผู้รับ U3 (OQ-T1-15) แล้วเปลี่ยน test.fixme ของ TC-NTF-JOB-110 เป็นเคสจริง
4. รัน T3 ตรวจผล + triage เมื่อรัน suite เต็ม (ผล §B6 เป็นการรันเฉพาะไฟล์ใหม่ ยังไม่ใช่ T3) · ร่าง defect ด้วย T4 หลัง QA ยืนยัน triage
5. ออกจากระบบ §B3 · เหลือพิสูจน์ AC-112 กับ API จริง · เคสอุปกรณ์เสริม §B4 รอ OQ-T1-13 (เคสอุปกรณ์ที่เลิกใช้)
6. รัน T2 ซ้ำเมื่อมีเคสเพิ่ม (ล่าสุด 2026-11-18 รอบ 2: t2-coverage-report.md)

## B10. สถานะ review เคสถาวรของ DEF-05 และเคส NFR (2026-11-24)

**สถานะ: QA review เสร็จสมบูรณ์ (completed) · ผู้ review: QA_Noppasorn · 2026-11-24 · ขอบเขต: TC-NTF-UI007-101, TC-NTF-UI010-103, TC-NTF-UI009-104, TC-NTF-UI008-106, TC-NTF-UI008-107 (เคสถาวรของ DEF-05) และ TC-NFR-REQ001-103, 104, 105, 106** — ผู้ใช้แจ้งผล review ในเซสชัน QA (บันทึกโดย AI ตามคำแจ้ง) · ผลรันไม่ใช่การ review · ใช้เป็นหลักฐาน G1 ข้อ review ใน [t5-quality-gate-2026-11-24.md](t5-quality-gate-2026-11-24.md)

## B11. สถานะ review เคส BR-mrr-017@v3 (CHG-mrr-006) (2026-11-25)

**สถานะ: QA review เสร็จสมบูรณ์ (completed) · ผู้ review: QA_Noppasorn · 2026-11-25 · ขอบเขต: TC-AUD-UI010-114 (EX-mrr-129), TC-AUD-UI011-101 (EX-mrr-130), TC-AUD-UI011-102 (EX-mrr-131)** — ผู้ใช้แจ้งผล review ในเซสชัน QA (บันทึกโดย AI ตามคำแจ้ง · AI ไม่ได้เป็นผู้ลงนาม) · เคสเขียนใน `test/e2e/t1-round2.spec.ts` (commit `f913505`) ผลรัน chromium 2026-11-24 ผ่าน 3/3 และผ่านใน T7 Full 2026-11-25 (build `d73529c`) · ผลรันไม่ใช่การ review · เพิ่มแถวทั้ง 3 ลง `t1-test-cases.csv` แล้ว (127 → 130 เคส) · ใช้เป็นหลักฐาน G1 ข้อ review ใน [t5-quality-gate-2026-11-25.md](t5-quality-gate-2026-11-25.md)

## B12. เคส T5 F5 — ผู้จองที่ถูกปิดบังถูกตัดออกจากเมล (2026-11-25)

**สถานะ: QA review เสร็จสมบูรณ์ (completed) · ผู้ review: QA_Noppasorn · 2026-11-25 · ขอบเขต: TC-NTF-UI009-105, 106 · TC-NTF-UI010-104, 105, 106 · TC-NTF-JOB-111, 112, 113 (ผ่านทั้ง 8 เคส)** — ผู้ใช้แจ้งผลในเซสชัน QA หลังอ่าน §B12.1–B12.2 (บันทึกโดย AI ตามคำแจ้ง · AI ไม่ได้เป็นผู้ลงนาม · ข้อสังเกตที่ยังเปิดใน §B12.2 ไม่ได้ถูกปิดโดยการลงนาม) · ผลรันไม่ใช่การ review · แถว Tag ใน CSV ยังเป็น AI-generated (ที่มาของเคส) · ใช้เป็นหลักฐาน G1 ข้อ review ใน [t5-quality-gate-2026-11-25.md](t5-quality-gate-2026-11-25.md)

ที่มาและผลรันของเคส: เคสเขียนใน `test/e2e/t1-adr017-f5.spec.ts` (commit `a1f25b4`) · ผลรัน chromium บน `35bc4e0` ผ่าน 8/8 ในชุดเต็ม 205 ผ่าน 8 รอบ (flaky 0 · 2 รอบแรกใช้ชื่อชั่วคราว รอบที่ 3–8 ใช้รหัสทางการ · รอบที่ 4 หลังเพิ่ม assert เวลาสิ้นสุดใน TC-NTF-UI010-105 · รอบที่ 5–8 หลังเสริม assert ปฏิทินและรายการของฉัน) — ผลรันไม่ใช่การ review · รหัสทางการกำหนดวันเดียวกัน แทนชื่อชั่วคราวที่ใช้ใน 2 รอบแรก · `test/results.json` เป็นผลรอบที่ 8 และมีรหัสทางการ · เพิ่มแถวทั้ง 8 ลง `t1-test-cases.csv` แล้ว (130 → 138 เคส) · ที่มา: คำตอบของผู้ใช้ 2026-11-25 (ตัดผู้จองที่ปิดบังออกจากเมล · ไม่เหลือผู้รับ = ข้ามเมลแล้วสำเร็จต่อ) — ยังรอ design/req บันทึกทางการ จึงยังไม่มี EX/BR ให้อ้าง · red-before พิสูจน์ด้วย jest (22 เคสใน commit `35bc4e0`) และ E2E (§B12.2)

| TC ID | ชื่อชั่วคราวในรอบรัน | Requirement ID | Type | Priority | เส้นเมล |
|---|---|---|---|---|---|
| TC-NTF-UI009-105 | TC-APR-UI009-108 | BR-mrr-007@v2 / ADR-017 / T5-F5 | Exception | High | รออนุมัติ → ปฏิเสธ |
| TC-NTF-UI009-106 | TC-APR-UI009-109 | BR-mrr-007@v2 (1) / ADR-017 / T5-F5 | Exception | High | รออนุมัติ → อนุมัติ (ไม่เหลือผู้รับ) |
| TC-NTF-UI010-104 | TC-APR-UI011-104 | BR-mrr-007@v2 / ADR-017 / T5-F5 | Exception | High | เปลี่ยนผลอนุมัติ → ปฏิเสธ |
| TC-NTF-UI010-105 | TC-MYB-UI009-107 | BR-mrr-007@v2 / ADR-017 / T5-F5 | Exception | High | RA แก้เวลาแทน |
| TC-NTF-UI010-106 | TC-MYB-UI009-108 | BR-mrr-007@v2 / ADR-017 / T5-F5 | Exception | High | RA ยกเลิกแทน |
| TC-NTF-JOB-111 | TC-JOB-REM-101 | BR-mrr-007@v2 / BR-mrr-020@v2 / BR-mrr-023@v1 / ADR-017 / T5-F5 | Exception | High | เตือน 15 นาที (u2 ได้) |
| TC-NTF-JOB-112 | TC-JOB-REM-102 | BR-mrr-020@v2 / BR-mrr-023@v1 / ADR-017 / T5-F5 | Boundary | Medium | เตือน 15 นาที (ไม่เหลือผู้รับ · SENT) |
| TC-NTF-JOB-113 | TC-JOB-AUTO-101 | BR-mrr-016@v1 / ADR-017 / T5-F5 | Exception | Medium | ยกเลิกอัตโนมัติ (ไม่เหลือผู้รับ) |

เลขเลือกต่อจากรหัสที่ใช้อยู่แล้วในสคริปต์และเอกสาร (TC-NTF-UI009 ถึง -104 · TC-NTF-UI010 ถึง -103 · TC-NTF-JOB ถึง -110) · เคส "ไม่เหลือผู้รับ" ใช้ผู้เข้าร่วมที่ปิดบังด้วย เพราะระบบไม่ให้จองโดยไม่มีผู้เข้าร่วม

### B12.1 Pre-review (AI) ของเคส F5 ทั้ง 8 — 2026-11-25

**สถานะ ณ ตอนเขียน: AI pre-review เสร็จ · รอผู้ review (ต่อมา QA_Noppasorn review ผ่านทั้ง 8 เคส ดูหัวข้อ B12 ด้านบน)** · อ่าน `test/e2e/t1-adr017-f5.spec.ts` ทีละ assertion เทียบกับ Expected ใน CSV และคำตอบของผู้ใช้ 2026-11-25 · ไม่ใช่การลงนาม · ผลรัน (205 ผ่าน 3 รอบ) ไม่ใช่การ review

**ที่ตรวจแล้วดี:** (1) ผู้รับตรวจด้วย `toEqual([u2])` ไม่ใช่ "มี u2" จึงจับได้ทั้งเมลที่เกินและเมลที่ขาด (2) เคสที่ Expected ระบุสถานะ ตรวจสถานะการจองจริงผ่าน API (REJECTED / APPROVED / CANCELLED) และ reminder_status = SENT จาก DB (3) ผู้ใช้เป็นผู้ใช้สังเคราะห์ใหม่ทุกเคส ไม่แตะบัญชี seed ที่ใช้ร่วม (u2 และ ra1 ถูกใช้เป็นผู้เข้าร่วม/ผู้กระทำ ไม่ถูกปิดบัง) (4) เคส "ไม่มีเมล" มีเคสคู่ที่พิสูจน์ว่าเมลส่งได้ในสภาพเดียวกัน (ปฏิเสธและเตือนที่ถึง u2) (5) เคสไม่เหลือผู้รับใช้ผู้เข้าร่วมที่ปิดบังด้วย เพราะการจองต้องมีผู้เข้าร่วมอย่างน้อย 1 คน (ยืนยันจากการรันจริง)

| # | เคส | ข้อสังเกต | ระดับ | ข้อเสนอ |
|---|---|---|---|---|
| 1 | TC-NTF-UI010-105 | Expected เขียน "บันทึกสำเร็จ" แต่เคสตรวจแค่ HTTP 200 และผู้รับเมล **ไม่ได้ตรวจว่าเวลาสิ้นสุดถูกบันทึกจริง** | ต่ำ-กลาง | เพิ่ม assert เวลาสิ้นสุดใหม่ (อ่านจาก API หรือ DB) · หรือแก้ Expected ให้ตรงกับที่ตรวจ |
| 2 | TC-NTF-UI010-105/106 · TC-NTF-JOB-111/112 | เคสที่จองห้อง E2E Open Room ส่งเมล "จองสำเร็จ" ตอนสร้างการจองถึงผู้จองก่อนปิดบัง เคสล้างกล่อง mailpit ทันทีหลังจอง ถ้าเมลถึง mailpit ช้ากว่าการล้าง จะปนในผลและเคสล้ม (ไม่ใช่ผ่านเท็จ) | ต่ำ · ผ่านมา 3 รอบ ไม่เคยล้ม | รอให้เมล "จองสำเร็จ" ถึงก่อนล้าง (เหมือนที่ `t1-adr017` ทำกับเมลล็อกอิน) |
| 3 | TC-NTF-UI009-106 · TC-NTF-JOB-112 · TC-NTF-JOB-113 | เคสที่ยืนยัน "ไม่มีเมล" พึ่งการรอ 2.5 วินาที ถ้าเมลมาช้ากว่านั้นเคสจะผ่านเท็จ | ต่ำ · ยอมรับได้ | แบบเดียวกับเคส "ไม่มีเมล" เดิมของ `t1-adr017` · ไม่ต้องแก้ ถ้ายอมรับ |
| 4 | ทั้ง 8 เคส | **E2E ไม่เคยรันกับโค้ดก่อนแก้ (`f83de74`)** จึงยังไม่พิสูจน์ว่าเคสล้มเมื่อมี regression · red-before พิสูจน์ด้วย jest เท่านั้น | กลาง | รัน spec นี้กับ api ที่ build จาก `f83de74` แล้วดูว่าล้ม (ต้อง rebuild image สองครั้ง · ใช้เวลาประมาณ 10 นาที) |
| 5 | (ช่องว่างของ E2E) | E2E ไม่ครอบ (ก) การจองรออนุมัติที่กลายเป็นใช้ได้เมื่อห้องเลิกต้องอนุมัติ (เมล "จองสำเร็จ" และเตือนทันที ผู้จองถูกปิดบัง) (ข) ปฏิเสธ ยกเลิก และแก้เวลา ในกรณีไม่เหลือผู้รับเลย — สองกลุ่มนี้ครอบด้วย jest เท่านั้น | ต่ำ | ยอมรับว่า jest พอ หรือเพิ่มเคสใหม่ |
| 6 | ทั้ง 8 เคส | ยังไม่มี EX/BR ของ F5 ให้อ้าง (Q-ADR017-3 และ "ไม่เหลือผู้รับ = ข้ามเมล" ยังไม่ถูกบันทึกทางการ) Expected จึงอิงคำตอบของผู้ใช้ ซึ่งติดแท็ก [Explicit] ในแง่ผู้ตอบ แต่ยังไม่ใช่เอกสาร BR | ช่องว่างตามรอยทาง ไม่ใช่ defect | รอ design/req · เมื่อมี EX แล้วเพิ่มคอลัมน์ Requirement ID |
| 7 | ทั้ง 8 เคส | ค่า Priority (High/Medium) และ Type (Exception/Boundary) เป็นการเลือกของ AI [Recommended] | ข้อมูล | QA ปรับได้ |
| 8 | ทั้ง 8 เคส | ผู้ใช้และการจองสังเคราะห์ค้างใน dev DB (หัวข้อ `E2E ADR017 F5`) | ข้อมูล | อยู่ในเงื่อนไขล้างการจอง `E2E%` ของ T5 ข้อ 6 อยู่แล้ว |

ไม่พบข้อที่ทำให้เคสผ่านเท็จในเส้นทางที่ตรวจสถานะ/ผู้รับ · ข้อ 1 และข้อ 4 เป็นข้อที่ควรตัดสินก่อนลงนาม
### B12.2 ผลหลัง pre-review — ข้อ 1 และข้อ 4 (2026-11-25)

**สถานะ: pre-review เสร็จ · ข้อ 1 และข้อ 4 ดำเนินการแล้ว · ต่อมา QA_Noppasorn review ผ่านทั้ง 8 เคส (2026-11-25 ตามที่ผู้ใช้แจ้ง)** (ผู้ใช้เลือกให้ทำข้อ 1 และข้อ 4 ก่อนลงนาม)

| ข้อ | สิ่งที่ทำ | ผล |
|---|---|---|
| 1 | เพิ่ม assert ใน TC-NTF-UI010-105: เวลาสิ้นสุดในฐานข้อมูลเท่ากับค่าใหม่ที่ส่ง (อ่านด้วย psql) แล้วรันชุด chromium เต็มใหม่ | ผ่าน · **205 ผ่าน · 0 ล้ม · 1 ข้าม · flaky 0** (รอบที่ 4 บน `35bc4e0`) · `test/results.json` เป็นรอบนี้ |
| 4 | red-before ของ E2E: สร้าง worktree ที่ `f83de74` (ก่อนแก้ F5) build api image จากรุ่นนั้น (ยืนยันว่าโค้ดที่รันไม่มี `deliver()`) แล้วรัน `t1-adr017-f5.spec.ts` | **ล้มทั้ง 8 เคส** ด้วยเหตุผลที่ถูก: 5 เคสที่ควรเหลือแค่ u2 มี `masked-…@mrr.invalid` เป็นผู้รับเกินมา · 3 เคสที่ควรไม่มีเมล (TC-NTF-UI009-106, TC-NTF-JOB-112, TC-NTF-JOB-113) มีเมลหลุดออก 1 ฉบับ · จากนั้นคืน api เป็นรุ่นปัจจุบัน (มี `deliver()` 8 จุด) ลบ worktree แล้วรันชุดเต็มข้างบน |

ข้อ 2, 3, 5, 6, 7, 8 ไม่เปลี่ยน (ยอมรับได้หรือรอ design/req ตามที่ระบุใน §B12.1) · ข้อ 2 ยังเป็นความเสี่ยงต่ำที่ไม่ได้แก้ · red-before ของ E2E รันด้วย reporter แบบ list จึงไม่มีไฟล์ผลเก็บไว้ (หลักฐานคือบันทึกนี้)

## B13. เคสหน้าจอปฏิทิน (BR-mrr-021) — TC-CAL-UI005-109 และ 110 (2026-11-25)

**สถานะ: QA review เสร็จสมบูรณ์ (completed) · ผู้ review: QA_Noppasorn · 2026-11-25 · ขอบเขต: TC-CAL-UI005-109 และ 110 (เคสใหม่) กับการแก้ assert ของ TC-CAL-UI005-101, 102, 103, 104 (ผ่านทั้ง 6)** — ผู้ใช้แจ้งผลในเซสชัน QA หลังอ่านหลักฐานในไฟล์ผลสุ่มอ่านและหัวข้อนี้ (บันทึกโดย AI ตามคำแจ้ง · AI ไม่ได้เป็นผู้ลงนาม) · ผลรันไม่ใช่การ review · แถว Tag ใน CSV ยังเป็น AI-generated (ที่มาของเคส) · เพิ่มจากข้อสังเกต 3 ของ [t5-critical-assertion-sample-2026-11-25.md](t5-critical-assertion-sample-2026-11-25.md): เคส API ของ BR-021 (101–104) พิสูจน์ข้อมูล แต่ไม่ได้ตรวจคำว่า "ไม่ว่าง" บนหน้าจอ · เคสอยู่ใน `test/e2e/t1-roles.spec.ts` · ผ่านในชุดเต็ม chromium 207 ผ่านรอบที่ 7 บน `35bc4e0` (ผลรันไม่ใช่การ review) · เพิ่มแถวทั้ง 2 ลง `t1-test-cases.csv` แล้ว (138 → 140 เคส) · **พิสูจน์ด้วย mutation:** เปลี่ยนข้อความ "ไม่ว่าง" ใน `CalendarPage.tsx` ชั่วคราวเป็นข้อความอื่น (build web · คืนโค้ดแล้ว ไม่ได้ commit) → -109 ล้ม และ -110 ล้ม (รันคู่กับ -104 เพราะ -110 ใช้การจองของ -104) ขณะที่ -101 ถึง -104 ผ่านเหมือนเดิม

| TC ID | Requirement ID | Type | Priority | ตรวจอะไรบนหน้าจอ |
|---|---|---|---|---|
| TC-CAL-UI005-109 | BR-mrr-021@v1 / EX-mrr-070 | Negative | Critical | u4 เห็นช่องของ u1 (ห้องไม่ต้องอนุมัติ) เป็นช่องของผู้อื่น หัวข้อ "ไม่ว่าง" ไม่มีช่องผู้จอง/ผู้เข้าร่วม ข้อความในช่องไม่มีหัวข้อหรือชื่อ |
| TC-CAL-UI005-110 | BR-mrr-021@v1 / EX-mrr-071 | Negative | Critical | เหมือนกัน แต่การจองรออนุมัติ (ห้องที่ต้องอนุมัติ) ข้อความไม่มี "รออนุมัติ" หรือ PENDING |

ข้อจำกัด: ตรวจเฉพาะการ์ดของช่องนั้น (ตามช่วงเวลา) ในมุมมองวัน · มุมมองสัปดาห์/เดือนไม่ได้ตรวจ · Priority Critical เป็นการเลือกของ AI [Recommended] ตามระดับของ -101..104

## B14. BR-mrr-007@v3 (CHG-mrr-007) — ผูก EX-mrr-132..135 กับเคส และเคสเสริม 3 เคส (2026-11-25)

**การผูกเคสเดิม: QA review เสร็จสมบูรณ์ (completed) · ผู้ review: QA_Noppasorn · 2026-11-25 · ขอบเขต: EX-mrr-132 → TC-MYB-UI007-106 · EX-mrr-133 → TC-NTF-JOB-111 · EX-mrr-135 → TC-NTF-JOB-112** — ผู้ใช้แจ้งในเซสชัน (บันทึกโดย AI ตามคำแจ้ง · AI ไม่ได้เป็นผู้ลงนาม) · ผลรันไม่ใช่การ review · การผูกอยู่ใน `docs/qa/e2e-ex-map.json`

**เคสเสริม 3 เคส: QA review เสร็จสมบูรณ์ (completed) · ผู้ review: QA_Noppasorn · 2026-11-25 · ขอบเขต: TC-MYB-UI007-107 · TC-NTF-JOB-114 · TC-NTF-UI010-107** — ผู้ใช้แจ้งผลในเซสชัน QA (บันทึกโดย AI ตามคำแจ้ง · AI ไม่ได้เป็นผู้ลงนาม · ผลรันไม่ใช่การ review) · เพิ่มตามที่ผู้ใช้ตัดสิน 2026-11-25 (Open Questions ข้อ 1–2 ของการผูก): EX-132 และ EX-133 ตรงบางส่วน (ไม่ตรวจข้อความที่ผู้ใช้เห็นและหัวเรื่อง · ใช้บัญชีที่ถูกปิดบังทุกคน จึงแยกไม่ออกว่าระบบตัดเพราะ `active` หรือเพราะ email เปลี่ยน · EX-133 มีผู้เข้าร่วมสองคน) และ EX-134 ไม่มีเคส · เคสอยู่ใน `test/e2e/t1-inactive-recipients.spec.ts` · ผู้ใช้สังเคราะห์ถูกตั้ง `active=false` ด้วย psql **โดย email คงเดิม** · เพิ่มแถวลง `t1-test-cases.csv` แล้ว (140 → 143 เคส)

| TC ID | Requirement ID | Type | Priority | ตรวจอะไร |
|---|---|---|---|---|
| TC-MYB-UI007-107 | BR-mrr-007@v3 / EX-mrr-132 | Exception | High | ผู้จองยกเลิก · ผู้เข้าร่วมคนหนึ่งไม่ active · ข้อความ 'ยกเลิกการจองสำเร็จ' · CANCELLED · เมล 1 ฉบับ หัวเรื่องขึ้นต้น '[จองห้องประชุม] ยกเลิกการจอง: <หัวข้อ> · ' · ผู้รับ = u1, u2 เท่านั้น |
| TC-NTF-JOB-114 | BR-mrr-007@v3 / EX-mrr-133 | Exception | High | งานเตือน 15 นาที · ผู้จองไม่ active · ผู้เข้าร่วม u2, u3 · หัวเรื่องขึ้นต้น '[จองห้องประชุม] ใกล้ถึงเวลาประชุม: <หัวข้อ> · ' · ผู้รับ = u2, u3 เท่านั้น · SENT |
| TC-NTF-UI010-107 | BR-mrr-007@v3 / EX-mrr-134 | Boundary | Medium | RA ยกเลิกแทนหลังเริ่ม 30 นาที · ผู้จองและผู้เข้าร่วมไม่ active ทั้งคู่ · 'ยกเลิกการจองสำเร็จ' · CANCELLED · ไม่มีเมลยกเลิกถึงใคร |

ผลรัน: chromium ผ่าน 3/3 (2026-11-25 · api image จาก `35bc4e0` · Docker stack mrr) — รันเฉพาะไฟล์นี้ ไม่ได้รันชุดเต็ม · รอบแรกล้มทั้ง 3 เพราะเคสเขียนผิด (นับเมล 'จองสำเร็จ' ของเคสเดียวกัน · RA ยกเลิกแทนก่อนเริ่มได้ 409) แก้แล้ว ไม่ใช่ข้อบกพร่องของระบบ · **negative check:** กลับ expectation ในสำเนาชั่วคราว (ใส่ email ของบัญชีที่ไม่ active เป็นผู้รับที่คาด · คาดเมลยกเลิก 1 ฉบับ) → ล้มทั้ง 3 · สำเนาลบแล้ว · ไม่ได้ทำ mutation ที่โค้ดระบบ

**EX-mrr-134 ถูกแก้ระหว่างทำ (ADR-018):** given ฉบับแรกที่ AI ร่างขัดระบบสองจุด — 'ไม่มีผู้เข้าร่วม' ขัด BR-mrr-002@v1 / EX-mrr-007 และ 'ขณะนี้ 16/10 15:00' (ก่อนเริ่ม) ขัด BR-mrr-009@v1 / EX-mrr-028 (RA ยกเลิกแทนได้เมื่อเริ่มแล้ว · api ตอบ 409) · เจ้าของอนุมัติให้แก้เป็น 'ผู้เข้าร่วม U2 · บัญชีของ U1 และ U2 ไม่ active ทั้งคู่ · ขณะนี้ 17/10 10:30' (when และ then คงเดิม) · design แก้ given ของ AC-mrr-137 ตาม แล้วเซ็น `functions.json` ใหม่

ข้อจำกัด: ตรวจที่ระดับ API (ข้อความในคำตอบของ api) ไม่ได้เปิดหน้าจอ · หัวเรื่องตรวจส่วนต้นถึงหัวข้อ (แบบเดียวกับ t1-round2) ไม่ได้ตรวจห้อง วัน และเวลาท้ายหัวเรื่อง · Priority เป็นการเลือกของ AI [Recommended]

## B15. T1 รอบ BR-mrr-007@v3 — ช่องว่างเชิงลึกของ "ตัดผู้รับที่ไม่ active" (2026-11-25)

**สถานะ: QA review เสร็จสมบูรณ์ (completed) · ผู้review: QA_Noppasorn · 2026-11-25 · ขอบเขต: 7 เคสของ §B15 (UI009-107/108 · UI008-106 · JOB-115/116/117 · UI007-108)** — ผู้ใช้แจ้งในเซสชัน QA (บันทึกโดย AI ตามคำแจ้ง · AI ไม่ได้เป็นผู้ลงนาม) · เขียนสคริปต์แล้วใน `test/e2e/t1-inactive-recipients.spec.ts` · **ผลรัน 2026-11-25: ผ่านทั้ง 10 เคสของไฟล์ (เดิม 3 + ใหม่ 7) และผ่านในชุดเต็ม chromium (218 เคส · 217 ผ่าน · 1 ข้าม · flaky 0)** · negative check กับสำเนา (กลับ expectation 5 จุด) ล้ม 5 เคส: UI009-108 · UI008-106 · JOB-115 · JOB-117 · UI007-108 — **UI009-107 และ JOB-116 ยังไม่ได้ทำ negative check** (เป็นเคส 'ไม่มีเมล' ชนิดเดียวกับ F5)

**ขอบเขต (ผู้ใช้เลือก):** BR-mrr-007@v3 · EX-mrr-132..135 ผูกกับเคสครบแล้ว (§B14) เคสในรอบนี้เพิ่มเฉพาะที่ EX ยังไม่คลุม · ทุกเคส Tag = AI-generated · Data Source = real · **ยังไม่เขียนสคริปต์ ยังไม่รัน ยังไม่ผ่าน QA review** · เพิ่มแถวลง `t1-test-cases.csv` แล้ว (143 → 150 เคส: 5 เคสแรก + 2 เคสจากคำตอบ OQ ข้อ 2–3 ด้านล่าง)

**A) Test Condition** (BR-mrr-007@v3 ข้อความ: ผู้รับที่ไม่ active ถูกตัดทุกกรณี · ไม่เหลือผู้รับ = ไม่ส่งเมลและสำเร็จตามปกติ)

| Condition | เหตุการณ์ → ผู้รับตามกฎ | ที่ครอบแล้ว (inactive ไม่ปิดบัง) | ช่องว่าง |
|---|---|---|---|
| C1 | (1) อนุมัติ → ผู้จอง | — | ผู้จองไม่ active |
| C2 | (2) เตือน 15 นาที → ผู้จอง+ผู้เข้าร่วม | JOB-114 (ผู้จองไม่ active) | ผู้เข้าร่วมทั้งหมดไม่ active · ไม่เหลือผู้รับ |
| C3 | (3) เปลี่ยนเวลา → ผู้จอง+ผู้เข้าร่วม | — (UI010-105 ครอบเฉพาะผู้จองที่ปิดบัง) | ผู้เข้าร่วมคนหนึ่งไม่ active |
| C4 | (3) ยกเลิก → ผู้จอง+ผู้เข้าร่วม | UI007-107 · UI010-107 | — |
| C5 | (3) ปฏิเสธ → ผู้จอง+ผู้เข้าร่วม | — (UI010-104 ครอบเฉพาะผู้จองที่ปิดบัง) | ผู้จองไม่ active |

**B) Test Case ใหม่ 5 เคส** (รายละเอียดครบ 17 คอลัมน์ใน CSV)

| TC ID | Requirement ID | Type | Priority | ตรวจอะไร |
|---|---|---|---|---|
| TC-NTF-UI009-107 | BR-mrr-007@v3 / EX-mrr-115 | Boundary | High | RA อนุมัติ · ผู้จองไม่ active · ไม่มีเมลถึงใคร · CONFIRMED |
| TC-NTF-UI009-108 | BR-mrr-007@v3 ข้อ (3) | Exception | High | RA ปฏิเสธ · ผู้จองไม่ active · ผู้เข้าร่วม active · เมลถึงผู้เข้าร่วมคนเดียว · REJECTED |
| TC-NTF-UI008-106 | BR-mrr-007@v3 / EX-mrr-021 | Exception | High | ผู้จองเปลี่ยนเวลา · ผู้เข้าร่วมคนหนึ่งไม่ active · เมลถึง u1 และ u2 เท่านั้น |
| TC-NTF-JOB-115 | BR-mrr-007@v3 / EX-mrr-133 | Boundary | Medium | เตือน · ผู้จอง active · ผู้เข้าร่วมทั้งหมดไม่ active · เมลถึงผู้จองคนเดียว · SENT |
| TC-NTF-JOB-116 | BR-mrr-007@v3 / EX-mrr-135 | Boundary | Medium | เตือน · ทั้งสองฝ่ายไม่ active (ไม่ปิดบัง) · ไม่มีเมล · SENT · รันซ้ำไม่เตือนซ้ำ |
| TC-NTF-JOB-117 | BR-mrr-016@v1 / BR-mrr-007@v3 | Boundary | High | ยกเลิกอัตโนมัติ · ผู้จองไม่ active · ไม่มีเมล · CANCELLED · ไม่ลองซ้ำ (ใหม่จากคำตอบ OQ ข้อ 2) |
| TC-MYB-UI007-108 | BR-mrr-007@v3 / EX-mrr-132 | Positive | Medium | ผู้เข้าร่วมที่เปิด active กลับ ได้รับเมลยกเลิกตามปกติ (ใหม่จากคำตอบ OQ ข้อ 3) |

**C) Test Data Requirement:** ผู้ใช้สังเคราะห์ใหม่ต่อรอบ (`e2e.inact.*.<RUN>@mrr.local`) ตั้ง `active=false` ด้วย psql โดยคง email แบบเดียวกับ `t1-inactive-recipients.spec.ts` · ห้องที่ต้องอนุมัติ 1 ห้อง (UI009-107/108) · นาฬิกา api เลื่อนได้ (JOB-115/116) · ผลข้างเคียง: การจอง E2E inactive สะสมใน dev DB เพิ่มทุกรอบ

**D) Open Questions — ผู้ใช้ตอบแล้ว 2026-11-25** (บันทึกตามคำตอบ · ผู้ใช้ไม่ได้ระบุว่าตอบในบทบาท PO/BA)

| # | คำถาม | คำตอบ | ผลต่อเคส |
|---|---|---|---|
| 1 | ข้อ (1) อนุมัติ ผู้จองไม่ active ไม่เหลือผู้รับ — ข้อความ/สถานะเหมือน EX-mrr-134 หรือไม่ | **เหมือน** | Expected ของ UI009-107 ล็อกแล้ว (สำเร็จ ข้ามเมล) |
| 2 | งานยกเลิกอัตโนมัติ (BR-mrr-016) และเมลอื่นนอก (3) ต้องตัดผู้จองที่ไม่ active ด้วยหรือไม่ | **ตัดที่ไม่ active** | เพิ่ม TC-NTF-JOB-117 · เมล "จองสำเร็จ" ตอนสร้างไม่ออกแบบเคส (ผู้จองต้องล็อกอินอยู่ จึง active เสมอ [Inferred]) |
| 3 | บัญชีที่เปิด active กลับ ต้องได้รับเมลถัดไปตามปกติหรือไม่ | **ปกติ** | เพิ่ม TC-MYB-UI007-108 |

**ที่ยังต้องทำฝั่ง req:** BR-mrr-016@v1 ไม่มีข้อความเรื่องตัดผู้รับที่ไม่ active และไม่มี EX รองรับ (BR-mrr-007@v3 เขียนเฉพาะเหตุการณ์ข้อ 1–3) และกฎ "เปิด active กลับ" ยังไม่มีใน BR · เคส JOB-117 / UI007-108 จึงอ้างคำตอบของผู้ใช้เป็นแหล่ง [Explicit จากคำตอบ ไม่ใช่จาก BR/EX] จนกว่า req จะบันทึก (ถ้าต้องบังคับตามกระบวนการ ต้องผ่าน /req:change)

**Next Actions**
1. ~~QA review 7 เคส~~ เสร็จแล้ว (QA_Noppasorn ตามที่ผู้ใช้แจ้ง) · ~~เขียนสคริปต์~~ เสร็จแล้วใน `test/e2e/t1-inactive-recipients.spec.ts`
2. ส่งคำขอไป req ให้บันทึกคำตอบข้อ 2–3 (BR-mrr-016 / BR-mrr-007) และผูก EX ให้เคสเหล่านี้
3. รัน T2 ซ้ำหลังเขียนสคริปต์

### B15.1 ข้อสังเกตจากการเขียนสคริปต์ (2026-11-25)

| # | ข้อสังเกต | สถานะ |
|---|---|---|
| 1 | **สถานะหลังอนุมัติคือ `APPROVED` ไม่ใช่ `CONFIRMED`** — ช่อง Expected ของ TC-NTF-UI009-107 ใน CSV เขียน CONFIRMED (ที่ QA review แล้ว) สคริปต์ตรวจ `APPROVED` ตามที่ F5 (TC-NTF-UI009-106) ใช้ · ผมไม่ได้แก้ข้อความที่ review แล้ว | **ผู้ใช้ตอบ APPROVED (2026-11-25) — แก้ CSV แล้ว** |
| 2 | **แก้เวลาของการจองที่มีผู้เข้าร่วมไม่ active: ถ้าส่ง `attendeeIds` เดิมกลับมา api ตอบ 400 "ไม่พบผู้เข้าร่วมบางคนในรายชื่อผู้ใช้"** — เกิดตอนฟอร์มแก้ไขส่งรายชื่อเดิมซ้ำ (ผู้เข้าร่วมถูกตั้ง active=false หลังจอง) · สคริปต์ UI008-106 จึงไม่ส่ง `attendeeIds` (api ถือว่าคงเดิม) และทดสอบที่ระดับ API ไม่ใช่หน้าจอ · ไม่รู้ว่าเป็นพฤติกรรมที่ตั้งใจหรือไม่ — TBD - Require Business Confirmation: ผู้จองต้องแก้เวลาได้ไหมเมื่อมีผู้เข้าร่วมที่ไม่ active ในรายชื่อ (ยังไม่ได้เปิด Q-mrr/DQ-mrr) | **ผู้ใช้ตอบ: แก้ได้ (2026-11-25)** — ระบบปัจจุบันตอบ 400 จึงขัดกับคำตอบ · เป็นข้อบกพร่องที่ยังไม่มีเคสพิสูจน์ (UI008-106 ใช้วิธีไม่ส่ง `attendeeIds` เลี่ยงอยู่) · ยังไม่ได้ร่าง defect/เคสใหม่ รอผู้ใช้สั่ง |
| 3 | TC-NTF-UI009-108 ตรวจร่องรอย (action REJECT + เหตุผล) ผ่านฐานข้อมูล ไม่ได้ตรวจป้ายบน UI-mrr-010 | ข้อจำกัด |

### B15.2 เคสพิสูจน์ DEF-07 (2026-11-25)

**สถานะ: QA review เสร็จสมบูรณ์ (completed) · ผู้ review: QA_Noppasorn · 2026-11-25 · ขอบเขต: TC-MYB-UI008-102 · TC-NTF-UI008-108** — ผู้ใช้แจ้งในเซสชัน QA (บันทึกโดย AI ตามคำแจ้ง · AI ไม่ได้เป็นผู้ลงนาม) · ผ่านในชุดเต็ม chromium รอบที่ 10 บน `25ebf26` (220 เคส · 219 ผ่าน · 1 ข้าม · flaky 0) โดย 2 เคสนี้ผ่านเพราะ `test.fail()`

| TC ID | Requirement ID | Type | Priority | ตรวจอะไร |
|---|---|---|---|---|
| TC-MYB-UI008-102 | DEF-07 / BR-mrr-003@v1 | Positive | High | ผู้จองแก้หัวข้อ ส่งรายชื่อเดิมที่มีผู้ไม่ active → 200 · หัวข้อเปลี่ยนใน DB |
| TC-NTF-UI008-108 | DEF-07 / BR-mrr-007@v3 | Positive | High | ผู้จองเปลี่ยนเวลา ส่งรายชื่อเดิม → 2xx · เมลถึง u1 และ u2 เท่านั้น |

- **เปลี่ยนเลขหลัง review:** เคสเปลี่ยนเวลาเดิมใช้ `TC-NTF-UI008-107` ซึ่งซ้ำกับเคสถาวรของ DEF-05 (§B10) ที่ AI ตั้งซ้ำ → เปลี่ยนเป็น `TC-NTF-UI008-108` ตามที่ผู้ใช้เลือกในเซสชัน (เนื้อหาเคสไม่เปลี่ยน · `test/results.json` รอบที่ 10 ใช้เลขเดิม · รอบที่ 11 ใช้ `-108` แล้ว)
- Expected มาจากคำตอบผู้ใช้ "แก้ได้" (2026-11-25) ไม่ใช่ BR/EX · ตรวจระดับ API ไม่ได้เปิดฟอร์มแก้ไขบนหน้าจอ
- **red ยืนยันแล้ว:** ไม่มี `test.fail()` เคสล้มทั้งคู่ด้วย 400 "ไม่พบผู้เข้าร่วมบางคนในรายชื่อผู้ใช้" (Expected 200 / < 300) ตรงกับ DEF-07
- ในสเปกใส่ `test.fail()` ไว้ → ชุดเต็มยังเขียวขณะ defect เปิด · **เมื่อ dev แก้แล้ว Playwright จะรายงานเคสนี้ล้ม ("คาดว่าล้มแต่ผ่าน") → ให้ลบ `test.fail()` ออกแล้วปิด DEF-07**
- **2026-11-26: แก้แล้ว `80a4e96`** — หลัง rebuild ทั้งสองเคสรายงาน "Expected to fail, but passed" · เอา `test.fail()` ออกแล้ว · ผ่านในชุดเต็ม chromium รอบที่ 11 (220 เคส · 219 ผ่าน · 1 ข้าม · flaky 0) · ตัวเคสไม่เปลี่ยน (ลบเฉพาะบรรทัด `test.fail`) · [T7](t7-regression-def07-2026-11-26.md)
- ข้อควรระวัง: ตัวเลข Playwright นับ 2 เคสนี้เป็น "ผ่าน" (expected) ทั้งที่พิสูจน์ defect ที่ยังเปิด — T5 ไม่ควรนับเป็นหลักฐานว่าระบบถูก
