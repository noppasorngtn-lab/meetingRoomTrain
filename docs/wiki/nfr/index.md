# NFR — ข้อกำหนดที่ไม่ใช่ฟังก์ชัน

> สารบัญนี้ถูก generate จาก `spec.json` — **ห้ามแก้ด้วยมือ** · 5 หน้า

| NFR | ชนิด | ข้อกำหนด | พิสูจน์ด้วย |
|---|---|---|---|
| [NFR-mrr-001](NFR-mrr-001.md) | security | เข้าสู่ระบบด้วย Email ขององค์กรอย่างเดียว — ไม่เชื่อม Active Directory (SSO) ในรอบนี้ (SRC-010) | — |
| [NFR-mrr-002](NFR-mrr-002.md) | performance | รองรับผู้ใช้งานพร้อมกัน 200 คน และหน้าจอตารางห้องประชุมโหลดเสร็จภายใน 2 วินาที (เอกสารเขียน "อย่างน้อย 100-200 คน" — เจ้าของเลือก 200 ดู Q-mrr-004) | load_test |
| [NFR-mrr-003](NFR-mrr-003.md) | security | เข้ารหัสข้อมูลการใช้งานผ่าน HTTPS และจำกัดสิทธิ์การเข้าถึงตามระดับผู้ใช้งาน (Role-Based Access Control) | — |
| [NFR-mrr-004](NFR-mrr-004.md) | availability | เปิดให้บริการตลอด 24 ชั่วโมง (Uptime 99.9%) | — |
| [NFR-mrr-005](NFR-mrr-005.md) | usability | รองรับ Chrome, Safari, Edge, Firefox และแสดงผลได้ดีบนอุปกรณ์เคลื่อนที่ (Responsive Design) | — |
