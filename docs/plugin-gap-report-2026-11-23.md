# รายงานช่องโหว่ของปลั๊กอิน aeon (2026-11-23)

**ถึง:** เจ้าของ `aeon-marketplace-day15/plugins/{req,design,mock,dev}` · **จาก:** โปรเจกต์ `mrr` (QA / Dev, AI-assisted) · **ไม่ได้แก้โค้ดของปลั๊กอินในรอบนี้**
**เวอร์ชันที่ใช้:** req 0.19.6 · design 0.54.1 · mock 0.52.1 · dev 0.29.2 (โฟลเดอร์ปลั๊กอินไม่อยู่ใน git — อ้างอิงด้วยเวอร์ชัน)
**รายงานก่อนหน้า:** [design-plugin-manual-steps.md](design-plugin-manual-steps.md) (2026-11-18 · 2026-11-19) — ข้อ G1 กับ G7 ข้างล่างเป็นเรื่องเดิมที่ยังเกิดซ้ำ

## สรุป

| # | ปลั๊กอิน | ช่องโหว่ | ความรุนแรง | วิธีเลี่ยงที่ใช้ |
|---|---|---|---|---|
| G1 | design · mock | `state.mjs --start/--done` ไม่ล้าง `staleBecause` | กลาง — ด่านแดงจนกว่าคนจะแก้ไฟล์สถานะเอง | ลบ `staleBecause` ด้วยสคริปต์ตัวเล็ก |
| G2 | req → design | แก้ NFR ด้วย `/req:capture` ไม่ออก change set · `/req:change` รับเฉพาะ BR/CALC | **สูง** — design ไม่เห็นการเปลี่ยน ด่านทุกตัวเขียว | design เปิด ADR เอง |
| G3 | design | V9 ตรวจว่ามีตัวเลข ไม่ตรวจว่าตรงกับ req | **สูง** — เกณฑ์ที่ลงนามขัดกับ req แต่ PASS | เทียบด้วยคน |
| G4 | mock | MV25 ตรวจ `data-testid` ไม่ตรวจข้อความของ control | กลาง — mockup ที่ลูกค้าเห็นใช้ชื่อปุ่มเก่า | เทียบป้ายกับ wireframe ด้วยสคริปต์ชั่วคราว |
| G5 | mock | `/mock:sync` ทำเครื่องหมาย wireframe + html ทุกครั้งที่มี change ค้าง ไม่ดูผลกระทบจากกราฟ | ต่ำ — งานวาดใหม่ที่ไม่จำเป็น | ไม่บันทึก (`--write`) เมื่อกราฟยืนยันว่าไม่มีหน้าจอโดน |
| G6 | mock | `/mock:sync` มองไม่เห็น change ที่ absorb ไปแล้ว | กลาง — เงียบ | รัน sync ก่อน absorb |
| G7 | mock | `/mock:wireframe` ลบ `deliveredPages` ของหน้า L2 | ต่ำ — คืนได้ด้วย `/mock:html --write` | รัน `/mock:html --write` ต่อทันที |
| G8 | dev | DV4 ไม่รายงาน STALE เมื่อข้อความ validation ของหน้าจอเปลี่ยน | กลาง — ต้องหาหน่วยที่ต้องแก้เอง | ไล่จากโค้ด |
| G9 | dev | `/dev:revise` มี recipe แค่สองแบบ (จัดหน้าจอ) ไม่มีทางบันทึกงานบำรุงรักษาที่ไม่ใช่ UI | ต่ำ | บันทึกผ่าน `build.mjs` ของหน่วยเจ้าของไฟล์ |
| G10 | req | ช่อง "เทสต์" ใน REQ wiki เขียนตายตัวเป็น `(ยังไม่มี) 🔴` ไม่มีข้อมูลให้เติม | กลาง — เกณฑ์ G1 ของ QA แดงถาวร 28 จุด ทั้งที่ทุก BR มีเคส | ใช้ `docs/qa/req-handoff-test-links.md` แทน · ขอ PO ยกเว้นเกณฑ์ข้อนี้ |
| G11 | design | ไม่มีคำสั่งลบ edge ใน `trace.design.json` และไม่มี gate ตรวจ edge `proves` ที่ชี้ฟังก์ชันซึ่งไม่ใช่แพลตฟอร์มแล้ว (เพิ่ม 2026-11-27) | กลาง — กราฟมี edge ล้าสมัยที่ทุกด่านมองไม่เห็น การเดินกราฟหาผลกระทบอาจพาไปผิดทาง | ปล่อยไว้และบันทึกที่นี่ (ผู้ใช้เลือก 2026-11-27) |
| G12 | req | ไม่มีคำสั่งเปลี่ยน `status` ของ CALC (และของ BR / EX) จาก `draft` (เพิ่ม 2026-11-27) | กลาง — CALC-mrr-001@v2 ค้างเป็น `draft` ทั้งที่เป็นรุ่นปัจจุบันและเลขเฉลยยืนยันแล้ว · BR / EX ต้องแก้ `spec.json` ด้วยมือ | CALC: ยังไม่แก้ (รอคำตอบจาก plugin) · BR / EX: แก้ `spec.json` ด้วยมือตามที่เจ้าของยืนยัน แล้วรัน rollup / wiki / export-contract / verify |

## รายละเอียด

### G1 · `staleBecause` ไม่ถูกล้าง (design · mock)

- **อาการ:** หลัง `--stale <step> --because <id>` แล้วรันขั้นนั้นใหม่ `staleBecause` ยังค้าง
  - design: ขั้นกลับเป็น `done` แต่ **S1** ล้ม ("carries staleBecause … while its status is done") — เรื่องเดิมตั้งแต่ 2026-11-18
  - **mock (ใหม่):** หนักกว่า — ทันทีที่ `--start` ขั้นเป็น `in_progress` ไฟล์ทั้งไฟล์ถูกปฏิเสธเป็น `STATE-INVALID` ("carries staleBecause … while its status is in_progress") แม้แต่ `wireframes.mjs --propose` ก็รันไม่ได้
- **เกิดใน mrr:** ADR-014 · 015 · 016 (design: `nfr` · `export` · `sitemap`) · ADR-016 (mock: `wireframe` · `html`)
- **เสนอแก้:** ให้ `state.mjs --start` (หรือ `--done`) ลบ `staleBecause` ในการเขียนครั้งเดียวกัน — ข้อความของด่านเองบอกว่า "rerunning the step clears the mark"

### G2 · การเปลี่ยน NFR ไม่มีทางไปถึง design (req → design)

- **อาการ:** req บันทึกค่าวัดของ NFR-mrr-002/004 ด้วย `/req:capture` (แก้ statement ตรงที่ — NFR ไม่มีเวอร์ชัน) · ไม่มี change set · `/req:change` รับเฉพาะ `BR-id | CALC-id` · design จึงไม่รู้ว่า NFR เปลี่ยน — `/design:check` PASS · S13 เงียบ · `/mock:sync` ตอบ "nothing moved"
- **ผล:** `nfr.json` ที่ลงนาม (p95 · ต่อเนื่อง 30 นาที · monitoring ภายนอก · ≥ 3 วันทำการ) ขัดกับ req (ทุกคำขอ · ยิงครั้งเดียว · log ของระบบ · 7 วันทำการ) อยู่หลายวันจนเทส load ถูกเขียนตาม req
- **เกิดใน mrr:** SRC-034/036/037 · พบโดย QA (ดู `docs/qa/req-design-request-nfr002-nfr004-conflict-2026-11-23.md`) · ปิดด้วย ADR-014 ที่ design เปิดเอง
- **เสนอแก้:** ให้ `/req:capture` ที่แตะ NFR ที่มีอยู่แล้ว ออก change set (หรือให้ `/req:change` รับ `NFR-id`) เพื่อให้ S13 ของ design จับได้

### G3 · V9 ไม่เทียบ NFR ของ design กับ req (design)

- **อาการ:** V9 ตรวจว่า entry มีตัวเลขเป็น JSON number มี condition มี measuredBy — ไม่เทียบกับ statement ของ req · LIMIT ของ V9 บอกไว้เองว่า "เห็นว่ามีตัวเลข ไม่เห็นว่าถูก"
- **ผล:** ร่วมกับ G2 — เกณฑ์ที่ขัดกับ req ผ่านด่านและถูกลงนาม
- **เสนอแก้:** อย่างน้อยให้ V9 เตือนเมื่อ `spec_hash`/hash ของ statement ใน `requirements.json` ใหม่กว่าเวลาที่ `nfr.json` ลงนาม (สัญญาณวัดได้ ไม่ต้องอ่านความหมาย)

### G4 · MV25 ไม่ตรวจข้อความบน control (mock)

- **อาการ:** design เปลี่ยนชื่อ action `book-slot` เป็น "ไปหน้าจองห้อง" (ADR-007) · wireframe ถูกวาดใหม่ถูกต้อง แต่หน้า L2 ทั้ง 6 หน้าของ UI-mrr-005 ยังเขียน "จองช่วงที่ว่าง" · testid ไม่เปลี่ยน → MV25 ผ่าน · `/mock:check` 32/32 ตลอด
- **พบเมื่อ:** เทียบภาพแอปจริงกับ mockup (`docs/qa/ui-mrr-005-visual-compare-2026-11-23.md`) · แก้ใน commit `35f0be0`
- **เสนอแก้:** กฎใหม่ (หรือขยาย MV25) เทียบข้อความของ control ที่เป็น **action** (ไม่ใช่ field ที่แสดงข้อมูลตัวอย่าง) กับ `name` ใน wireframe — ตั้งแต่ประตู 72 หน้า L2 เป็นโมเดลเขียน ความถูกต้องของป้ายจึงไม่เป็นจริงโดยโครงสร้างอีกแล้ว

### G5 · `/mock:sync` ทำเครื่องหมายเกินจำเป็น (mock)

- **อาการ:** ADR-015 แก้เฉพาะ `measuredBy` ของ NFR-mrr-002 · `trace.mjs --impact` ยืนยัน 0 รายการ · แต่ sync เสนอให้ wireframe + html ทั้งหมดเป็น stale เพราะสัญญาณคือ "มี change ค้าง" อย่างเดียว
- **เสนอแก้:** ให้ sync เดินกราฟจาก `moved` ของ change แล้วทำเครื่องหมายเฉพาะเมื่อถึง `MCK-` ใด ๆ

### G6 · `/mock:sync` ไม่เห็น change ที่ absorb แล้ว (mock)

- **อาการ:** ลำดับปกติของ `/design:change` คือ rerun → absorb · ถ้ารัน sync หลัง absorb จะได้ "nothing moved upstream" แม้เนื้อหาหน้าจอเปลี่ยน — เรื่องเดียวกับข้อ 3 ใน `design-plugin-manual-steps.md` (2026-11-19)
- **วิธีเลี่ยง:** รัน `/mock:sync --write` ก่อน `changes.mjs --absorb` (ทำใน ADR-016)
- **เสนอแก้:** ให้ sync จำ change ล่าสุดที่รับรู้แล้ว และเทียบกับ `changes.json` ทั้งรายการ ไม่ใช่เฉพาะที่ยังไม่ absorb

### G7 · `/mock:wireframe` ลบ `deliveredPages` (mock)

- **อาการ:** วาด wireframe ของ UI-mrr-004/005/006 ใหม่ (ADR-016) → `deliveredPages` ของ MCK-mrr-003/004/005 ใน `mockup-map.json` หาย ขณะที่ `coverage.json` ยังเป็น L2 และ `/mock:check` ผ่าน — เรื่องเดิม (2026-11-19) เกิดซ้ำ
- **เสนอแก้:** เก็บ `deliveredPages` ไว้ หรือให้ด่านรายงานหน้า L2 ที่ไม่มีบันทึกส่งมอบ

### G8 · DV4 ไม่เห็นการเปลี่ยนข้อความ validation ของหน้าจอ (dev)

- **อาการ:** หลัง ADR-016 (`screens.json` UI-mrr-004/005/006/008 เปลี่ยน validation และลงนามใหม่) `verify-features.mjs` ไม่รายงานหน่วยใด STALE จาก UI-mrr-00x — ต้องหาหน่วยที่ต้องแก้ (FE-mrr-002/003/004/042) จากโค้ดเอง
- **ยังไม่ได้ตรวจว่า:** hash ใน `traces_up` ไม่ครอบคลุม `fields[].validation` หรือหน่วยเหล่านั้นไม่ได้ trace ถึง UI โดยตรง
- **เสนอแก้:** ให้ hash ของ node UI ครอบคลุม `fields[].validation` หรือให้ DV4 รายงานหน่วยที่ manifest มี testid ของหน้าจอที่เปลี่ยน

### G9 · `/dev:revise` ไม่มีทางสำหรับงานที่ไม่ใช่การจัดหน้าจอ (dev)

- **อาการ:** ย้ายฟอนต์จาก Google Fonts มาเสิร์ฟเอง (`b1f2390`) ไม่เพิ่มอะไรที่ผู้ใช้เห็น แตะเฉพาะไฟล์ของ FE-mrr-022 · คลัง recipe มีแค่ `master-detail-grid` กับ `row-control-opens-related` และ `--write` ปฏิเสธงานที่ไม่ใช้ recipe
- **วิธีเลี่ยง:** บันทึกผ่าน `build.mjs --write` ของหน่วยเจ้าของไฟล์ พร้อม proof
- **เสนอแก้:** เอกสารของ `/dev:revise` บอกทางสำหรับงานบำรุงรักษาที่ไม่ใช่ Class A/B (เช่น "ใช้ `/dev:build origin=change` ของหน่วยเจ้าของไฟล์")

### G10 · ช่อง "เทสต์" ของ REQ wiki เติมไม่ได้ (req)

- **อาการ:** `scripts/wiki.mjs:146` (req 0.19.6) พิมพ์ `- **เทสต์:** *(ยังไม่มี)* 🔴` ให้ทุก BR เสมอ ไม่อ่านจากข้อมูลใด และ `spec.json` ไม่มีช่องเก็บเคส · แก้ wiki ด้วยมือก็ถูกเขียนทับเมื่อสร้าง wiki ใหม่
- **เกิดใน mrr:** 28 จุดใน `docs/wiki/requirements/REQ-mrr-001–005.md` (11+6+3+3+5) · BR ทั้ง 28 ข้อมีเคสแล้ว (T2 2026-11-23) · เกณฑ์ G1 ของ playbook ห้ามเป็น 🔴
- **ข้อมูลพร้อมเติม:** [qa/req-handoff-test-links.md](qa/req-handoff-test-links.md) (สร้างจาก `qa/req-handoff-links.py`)
- **เสนอแก้:** เพิ่มช่องเช่น `rules[].tested_by` ใน spec.json (หรืออ่านไฟล์ที่ QA ส่งมอบ) แล้วให้ wiki.mjs แสดงค่านั้น · มีคำสั่ง req ให้บันทึกค่านี้

### G11 · ลบ edge ไม่ได้ และ edge `proves` ที่ล้าสมัยไม่มีใครเห็น (design)

- **อาการ:** `trace.mjs --from` เพิ่มและรวม edge ได้อย่างเดียว · ไม่มีคำสั่งลบ (`trace.mjs` ระบุเองว่า "this plugin has no pen that deletes an edge") · `functions.mjs` ยอมให้ตั้ง `origin` เป็น null และเปลี่ยน anchor ของเกณฑ์รับจาก `function` เป็น `example` ได้ แต่ edge `AC proves FUN` ที่เขียนไว้ตอนเป็นฟังก์ชันแพลตฟอร์มยังอยู่ · ไม่มี rule ใน `check.mjs` ตรวจว่า `proves` ต้องชี้ฟังก์ชันที่ `origin.kind: "platform"` และเกณฑ์รับนั้นต้องยึดกับ `function` จริง
- **เกิดใน mrr:** ADR-023 (2026-11-27) เปลี่ยน FUN-mrr-015 (ออกจากระบบ) จากงานแพลตฟอร์มเป็นฟังก์ชันที่ REQ-mrr-001 / BR-mrr-029@v1 ขอ และผูก AC-mrr-111..113 กับ EX-mrr-148..150 · edge ใหม่ 8 เส้นเขียนครบ แต่ `AC-mrr-111 proves FUN-mrr-015` · `AC-mrr-112 …` · `AC-mrr-113 …` ยังค้าง · `check.mjs` PASS · `approve --ready` 9/9
- **ผล:** กราฟบอกสองเรื่องพร้อมกันว่า AC เหล่านี้ยึดกับตัวอย่าง (`copiedFrom`) และพิสูจน์ฟังก์ชันแพลตฟอร์ม (`proves`) · `--impact` จาก FUN-mrr-015 ยังเดินถึง AC ผ่าน edge เก่า (ผลไม่ผิด แต่เหตุผลที่พิมพ์ออกมาผิด)
- **วิธีเลี่ยง:** ไม่แก้ `trace.design.json` ด้วยมือ (ผู้ใช้เลือก 2026-11-27) · บันทึกไว้ในรายงานนี้และใน commit `f1f548a`
- **เสนอแก้:** (1) ให้ `trace.mjs` มีทางถอน edge ที่ต้องอ้าง change record (`--retract <edge> --because <ADR|CHG>`) แบบเดียวกับ `approve.mjs --revoke` · หรือ (2) ให้ `functions.mjs` ถอน `proves` ของเกณฑ์รับเองเมื่อ anchor เปลี่ยน · และเพิ่ม rule ที่รายงาน `proves` ซึ่งชี้ฟังก์ชันที่ไม่ใช่แพลตฟอร์ม หรือมาจากเกณฑ์รับที่ไม่ได้ยึดกับ `function`

### G12 · สถานะ `draft` ของ CALC (และ BR / EX) ไม่มีคำสั่งเปลี่ยน (req)

- **อาการ:** req 0.19.6 เขียน `status: "validated"` ได้สองที่เท่านั้น คือ golden dataset (`/req:golden` · `commands/golden.md`) และ `meta` (`/req:approve`) · `commands/calc.md` ไม่พูดถึง status เลย · `verify-rules.mjs` LIMIT #16 ยอมรับเองว่า "judged … status field(s) for values with no writer" · `commands/approve.md` บอกว่า "nothing in this marketplace reads `validated` on a rule today" · ด่าน CP1 / CP2 จึงผ่านแม้ CALC ปัจจุบันยังเป็น `draft`
- **เกิดใน mrr:**
  - CALC-mrr-001@v2 (`is_current: true`) ยังเป็น `draft` ตั้งแต่ขึ้นรุ่นเมื่อ 2026-11-19 (CHG-mrr-004) ทั้งที่ GD-mrr-001 เป็น `validated` (Noppasorn 2026-11-24) · เจ้าของตอบ T2-Q3 เมื่อ 2026-11-27 ว่า **ไม่ได้ตั้งใจให้เป็น draft** (SRC-047) · ยังไม่ได้แก้ เพราะไม่มีทางของ plugin และการแก้ `spec.json` ด้วยมือเปลี่ยนไฟล์สัญญาที่ design อ่าน
  - BR-mrr-029@v1 และ EX-mrr-148..150 (2026-11-27) · EX-mrr-146 / 147 (2026-11-26 / 27): เปลี่ยนเป็น `validated` ด้วยมือใน `spec.json` ตามที่เจ้าของยืนยันในเซสชัน แล้วรัน `rollup` · `wiki` · `export-contract` · `verify-rules --cp1/--cp2` · ไม่มีช่องบันทึกว่าใครยืนยันเมื่อไร (ต่างจาก golden ที่มี `verified_by` / `verified_at`)
- **ผล:** สถานะใน wiki และในไฟล์สัญญาไม่บอกว่ามีคนยืนยันแล้วหรือยัง · ด่านไม่จับ · ร่องรอยการยืนยันอยู่แค่ใน commit message และเอกสาร QA
- **เสนอแก้:** คำสั่ง (หรือ flag ของ `/req:calc` · `/req:example`) ที่เปลี่ยน `draft` → `validated` พร้อม `verified_by` / `verified_at` แบบเดียวกับ `/req:golden` · และให้ verify-rules รายงาน CALC ปัจจุบันที่ยังเป็น `draft` ทั้งที่ golden ของมัน `validated` แล้ว
- ~~**คำถามที่ค้าง:** ระหว่างรอ plugin จะให้แก้ CALC-mrr-001@v2 ด้วยมือแบบเดียวกับ BR / EX หรือไม่~~ **ตอบแล้ว 2026-11-27 (ผู้ใช้ตัดสินในเซสชัน): ยังไม่แก้ รอ plugin** — CALC-mrr-001@v2 คงเป็น `draft`

## Open Questions (TBD)

- ~~G10: ระหว่างรอ plugin แก้ PO ยกเว้นเกณฑ์ G1 ข้อ "ช่องเทสต์ไม่เป็น 🔴" ได้หรือไม่~~ **ตอบแล้ว 2026-11-23: PO ยกเว้น** (ผู้ใช้แจ้งคำตัดสิน) · ใช้ req-handoff-test-links.md เป็นหลักฐานแทน จนกว่า plugin จะแก้
- จะส่งรายงานนี้ให้เจ้าของปลั๊กอินทางไหน (issue tracker / แชท / ไฟล์) — ยังไม่ทราบช่องทาง
- การแก้ S2 ในเครื่องนี้ (ข้อ 2 ของ `design-plugin-manual-steps.md`) ยังไม่ได้ส่งเป็น patch

## Next Actions

1. ส่งรายงานนี้ให้เจ้าของปลั๊กอิน
2. จนกว่าจะแก้: ทำตามวิธีเลี่ยงในตารางสรุป
