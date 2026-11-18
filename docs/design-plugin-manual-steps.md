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
