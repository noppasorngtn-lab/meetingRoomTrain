# คำตัดสินของ PO — เคส HTTPS กับ Secure cookie / HSTS (PO-5 · T5 F9) · 2026-11-26

ผู้ตัดสิน: **PO ตามที่ผู้ใช้แจ้งในเซสชัน 2026-11-26** · บันทึกโดย AI ที่ HEAD `a581cdc` · AI ไม่ได้ตัดสินเอง
อ้างอิง: [t5-quality-gate-2026-11-25.md](t5-quality-gate-2026-11-25.md) F9 · §E (ด้านสิทธิ์) · `test/e2e/t1-nfr-https.spec.ts` · NFR-mrr-003

## สภาพก่อนตัดสิน (ตรวจในรีโปที่ `a581cdc`)

- NFR-mrr-003 เขียนไว้ว่า "เข้ารหัสข้อมูลการใช้งานผ่าน HTTPS และจำกัดสิทธิ์ตามระดับผู้ใช้งาน (RBAC)" — ไม่ได้พูดถึง Secure cookie หรือ HSTS
- TC-NFR-REQ001-103 ตรวจว่าใช้ TLS 1.2 ขึ้นไป และ HTTP ธรรมดาที่พอร์ตเดียวกันไม่ได้เนื้อหาของระบบ (ผ่าน Caddy `https://localhost:4443` ใน `docker/Caddyfile`) — ไม่ได้ตรวจ cookie หรือ header
- Secure cookie: `apps/api/src/modules/auth/session.middleware.ts:16,20` ใส่ `Secure` เมื่อ env `COOKIE_SECURE=true` เท่านั้น · `docker/docker-compose.yml` ไม่ได้ตั้งค่านี้ จึงยังไม่ได้เปิดบน dev
- HSTS: ทั้ง api และ Caddyfile ไม่ส่ง `Strict-Transport-Security` เลย

## คำตัดสิน

**ไม่รวมในเคสรอบนี้ · ให้ตรวจตอน deploy**

- TC-NFR-REQ001-103 คงเดิม ไม่ต้องเพิ่ม assert และไม่มีงาน dev หรือ test ตอนนี้
- ไม่ต้องแก้ NFR-mrr-003 และไม่ต้องส่ง req/design เพราะคำตัดสินนี้ไม่ได้เพิ่มเกณฑ์ใหม่
- **งานก่อนปล่อยจริง** (ต่อท้ายเงื่อนไข 6 ของ [Conditional Go](po-decision-conditional-go-2026-11-26.md)): บน build ปลายทางที่เป็น HTTPS ให้
  1. ตั้ง `COOKIE_SECURE=true` แล้วตรวจว่า cookie `mrr_session` มี flag `Secure` (ตอน login และตอน logout)
  2. ตรวจว่า response มี header `Strict-Transport-Security` ถ้าฝั่งปลายทางตั้งไว้ (ใครเป็นคนตั้ง และใช้ค่าอะไร ยังไม่ได้กำหนด — เป็นเรื่องของทีม deploy / IT องค์กร)

## ความเสี่ยงที่ยอมรับ

- ถ้าลืมตั้ง `COOKIE_SECURE` บนปลายทาง cookie session อาจถูกส่งผ่าน HTTP ธรรมดาได้ ถ้ามีทางเข้าแบบ HTTP เปิดอยู่
- ถ้าไม่มี HSTS เบราว์เซอร์อาจเข้า HTTP ได้ในการเข้าครั้งแรก
- พอร์ต dev `:4173` และ `:3000` ยังเป็น HTTP (เหมือนเดิม · ไม่ใช่ทางเข้าของ production)
