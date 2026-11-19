# ขั้นตอน manual ของ design plugin ที่ยังไม่มี automation (2026-11-18)

พบระหว่างทำ DEF-04 / CHG-mrr-003 · ยังไม่ได้แจ้งเจ้าของ plugin (`aeon-marketplace-day15/plugins/design`) · ใช้วิธีนี้ไปก่อนจนกว่า plugin จะแก้

## 1. `staleBecause` ไม่ถูกล้างหลังรันขั้นซ้ำ — ล้างเอง

**อาการ:** หลัง `/design:change` ทำเครื่องหมายขั้นด้วย `state.mjs --stale <step> --because <change id>` แล้วรันขั้นนั้นซ้ำจน `--done` สำเร็จ ขั้นกลับเป็น `done` แต่ `design.state.json` ยังมี `staleBecause` ค้างอยู่ และ gate **S1** ล้ม ("carries staleBecause … while its status is done") ทั้งที่ข้อความของ gate บอกว่ารันซ้ำแล้วต้องล้าง · `state.mjs` ทั้ง `--start` และ `--done` ไม่แตะ field นี้

**วิธี manual (ทำเฉพาะหลังทุกขั้นที่ stale รันซ้ำและ `--done` แล้ว):**
1. ตรวจว่า `node <design>/scripts/status.mjs --root .` ไม่เหลือขั้นสถานะ `STALE`
2. ลบ field `staleBecause` ออกจากขั้นที่ `status` เป็น `done` ใน `.aeon/design/design.state.json` เท่านั้น (ห้ามแตะขั้นที่ยัง `stale`) — แก้ด้วยสคริปต์ตัวเล็กที่ `delete step.staleBecause` เมื่อ `step.status !== "stale"` เพื่อไม่ให้ format ไฟล์เปลี่ยน
3. รัน `check.mjs` — S1 ต้องหาย · diff ใน git ควรเป็นการลบบรรทัด `staleBecause` เท่านั้น
4. `changes.mjs --absorb <id>` เป็นคนละเรื่อง: ไม่ล้าง stale และ stale ก็ไม่ปิด change

เคยทำแล้วครั้งหนึ่ง (commit `3f388f9`) ตามที่ผู้ใช้อนุญาตเป็นรายครั้ง

## 2. S2 ชนกับ `--because CHG-…` — แก้ใน plugin แล้ว (เฉพาะเครื่องนี้)

**อาการ:** `state.mjs --stale <step> --because CHG-mrr-003` เขียน id ของ req ลง `staleBecause` แต่ gate **S2** ปฏิเสธว่า "CHG- belongs to req — reference it, never mint it" เพราะตำแหน่งนี้ไม่อยู่ใน `REFERENCE_POSITIONS`

**ที่แก้:** เพิ่ม 1 แถวใน `REFERENCE_POSITIONS` ของ `plugins/design/scripts/check.mjs` (`design.state.json` · `steps[n].staleBecause` · อนุญาต `CHG`, `ADR`) — แคบโดยเจตนา ตามแบบของ `changes.json` · ตรวจบนสำเนา: ใส่ stale ด้วย `CHG-mrr-003` แล้ว S2 ไม่ล้าง
**ข้อควรระวัง:** plugin ไม่อยู่ใน git ไม่มีประวัติ — สำรองไฟล์เดิมไว้ที่ scratchpad ของเซสชัน (จะหายได้) · ถ้า plugin ถูกอัปเดตทับ การแก้นี้หายและ S2 กลับมา · ควรส่งเป็น patch ให้เจ้าของ plugin

## 3. `/mock:wireframe` ลบบันทึกส่งมอบ L2 (`deliveredPages`) ทิ้งเมื่อ wireframe เปลี่ยน — คืนด้วย `/mock:html --write` (2026-11-19)

พบระหว่างทำ CHG-mrr-004 (BR-mrr-006@v2) · เป็นของ plugin `mock` (`aeon-marketplace-day15/plugins/mock`) ไม่ใช่ของ `design` · ยังไม่ได้แจ้งเจ้าของ plugin

**อาการ:** `/mock:sync` ตอบ `nothing moved upstream` และ `/mock:check` ผ่าน หลังจาก design ทำใหม่ครบและ absorb change แล้ว ทั้งที่เนื้อหาของหน้า `RPT-mrr-001` ใน `screens.json` เปลี่ยน (ข้อความ validation ของช่อง `rank` และการอ้าง `BR-mrr-006@v1` → `@v2`) · สัญญาณของ sync คือขั้น design ที่ stale กับ change ที่ยังไม่ absorb เท่านั้น จึงไม่เห็นการเปลี่ยนเนื้อหาที่เกิดและปิดไปก่อนแล้ว · **ต้องไล่ดูเองว่าหน้าไหนของ mock ได้รับผลกระทบ** (จากรายงานผลกระทบของ `/design:change`)

**ผลข้างเคียงที่ตามมา:** สั่ง `/mock:wireframe <หน้า>` ใหม่ → ตัวเขียนอัปเดต `wireframes/<หน้า>.json` ถูกต้อง แต่ **ลบ `deliveredPages`** (hash ของหน้า L2 ที่ส่งมอบไว้ทุกสถานะ) ของ `MCK-` นั้นใน `mockup-map.json` ออก ในขณะที่ `coverage.json` ยังเป็น `L2` และตัวตรวจ `/mock:check` ยังผ่าน — บันทึกส่งมอบหายเงียบ ๆ

**วิธี manual:**
1. หลัง `/mock:wireframe <หน้า>` ให้รัน `/mock:html --write --screen <หน้า>` (ถ้าหน้า L2 ไม่ต้องวาดใหม่ ไฟล์ใน `mockups/<หน้า>/` ไม่ถูกแตะ สคริปต์แค่ตรวจแล้วบันทึกกลับ) — ครั้งนี้ hash ที่ได้เหมือนเดิมทุกไบต์ (เพราะ wireframe ใหม่ต่างกันแค่ข้อความ validation กับเลขเวอร์ชันกฎ ซึ่งไม่ปรากฏในหน้า L2)
2. ตรวจ diff ของ `mockup-map.json` ว่ามีแต่การคืน `deliveredPages` กลับมา
3. ถ้า wireframe เปลี่ยนจนหน้าต้องวาดใหม่จริง ให้วาดตามกติกาของ `/mock:html` ก่อนขั้น 1

**ข้อควรระวังอีกข้อ:** `html.mjs --validate --screen <หน้า>` (แบบแคบ) รายงาน `MV4 … is missing` ของหน้าอื่นที่ไฟล์มีอยู่จริงบนดิสก์ รวม 23 รายการ ทั้งที่ `html.mjs --validate` แบบเต็มให้ `PASS` — ใช้แบบเต็มตัดสิน อย่าเชื่อแบบแคบ (ยังไม่ทราบสาเหตุ ไม่ได้ตรวจต้นทาง)

เสนอเป็น patch ให้เจ้าของ plugin: (ก) `/mock:wireframe` ไม่ควรลบ `deliveredPages` เงียบ ๆ ควรทำเครื่องหมายว่าหน้า L2 ตกรุ่น (ข) `/mock:sync` ควรเห็นหน้า design ที่เนื้อหา `screens.json` เปลี่ยนหลัง wireframe ถูกวาด
