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

## Open Questions (TBD)

- จะส่งรายงานนี้ให้เจ้าของปลั๊กอินทางไหน (issue tracker / แชท / ไฟล์) — ยังไม่ทราบช่องทาง
- การแก้ S2 ในเครื่องนี้ (ข้อ 2 ของ `design-plugin-manual-steps.md`) ยังไม่ได้ส่งเป็น patch

## Next Actions

1. ส่งรายงานนี้ให้เจ้าของปลั๊กอิน
2. จนกว่าจะแก้: ทำตามวิธีเลี่ยงในตารางสรุป
