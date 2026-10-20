# สัญญาของ bundle นี้ — อ่านก่อนใช้

bundle นี้เป็น **render ตัวที่สาม** ของ `spec.json` ไม่ใช่ที่เก็บความจริงตัวที่สอง

| ชั้น | ที่อยู่ | แก้ได้ไหม |
|---|---|---|
| ความจริง | `<state-dir>/spec.json` | ✅ ผ่านคำสั่ง `/req:*` เท่านั้น |
| ต้นฉบับดิบ | `docs/sources/` | ❌ ห้ามแก้ (check #8 จับ hash) |
| render ให้คนอ่าน | `docs/requirements/REQ-*.md` | ❌ generate |
| render ให้ agent อ่าน | `docs/wiki/**` (ที่นี่) | ❌ generate |

## กติกา

1. **ห้ามแก้ไฟล์ในนี้ด้วยมือ** — และจงใจไม่มี marker block "แก้ตรงนี้ได้" เพราะเคยพิสูจน์แล้วว่าสุดท้ายจะมีคนแก้นอก marker แล้ว regenerate กินทิ้งเงียบ ๆ
2. ทุกหน้ามี `spec_hash` — check #12 เทียบกับ `nodeDocHash` ที่คำนวณสด หน้าไหนค้างจะแดง ไม่ใช่เงียบ
3. **หนึ่งโหนด = หนึ่งไฟล์ = หนึ่ง concept** · id คือชื่อไฟล์ · กฎหนึ่งเวอร์ชันหนึ่งไฟล์ ของเก่าไม่เคยถูกทับ
4. อ้างอิงกฎต้องมี `@v` เสมอ — id เปล่าจะเปลี่ยนความหมายเงียบ ๆ เมื่อ current ขยับ · ตัวที่บอกว่าอันไหน current คือ [rules/index.md](rules/index.md) เท่านั้น
5. ลิงก์ markdown ธรรมดาคือกราฟ traceability ทั้งหมด — ไม่มีรูปแบบพิเศษ เครื่องมืออะไรที่อ่าน markdown เป็นก็เดินได้

## เดินกราฟยังไง

```
REQ ──belongs_to── BR@v ──constrained_by── CALC@v ──proves── GD
                    │                                   
                    ├──proven_by── EX                   
                    └──affects──── CHG ──triggered_by── SRC
```

เริ่มที่ [index.md](index.md) · คำถาม *"กฎข้อไหนยังไม่มีใครพิสูจน์"* ตอบได้จาก [rules/index.md](rules/index.md) คอลัมน์สุดท้าย
