# T1 ข้อเสนอเคส NFR-mrr-001–004 และ AC-mrr-115 (2026-11-18)

**สถานะ:** ข้อเสนอ — ยังไม่ผ่าน QA review · ยังไม่ได้เขียนสคริปต์ · ไม่ได้รวมใน `t1-test-cases.csv` · Tag = AI-generated ·
ที่มา: T2 พบ AC-mrr-115 ไม่มีเทสอ้างถึง และ NFR-mrr-001–004 ไม่มีเทสอ้างถึง

## 1) AC-mrr-115 · BR-mrr-020@v2

ไม่เสนอ TC ใหม่ — มี **TC-NTF-JOB-110** (EX-mrr-112) อยู่แล้ว (`test.fixme` รอ fixture ผู้รับ U3 ล้ม · OQ-T1-15)
T2 นับชั้น e2e จาก `docs/qa/e2e-ex-map.json` (ผูกด้วย EX) ไม่ใช่การอ้าง AC ในชื่อเคส → AC-mrr-115 จะหายจาก "ไม่มีเทส" เมื่อ Dev ทำ fixture, เปลี่ยน `test.fixme` เป็นเคสจริงที่ผ่าน แล้วเพิ่ม EX-mrr-112 ลงแผนที่นั้น (ยังไม่เพิ่มตอนนี้ เพราะเคสถูกข้ามอยู่ จะกลายเป็นอ้างว่ามีเทสทั้งที่ไม่ได้รัน)

## 2) เคสที่เสนอ (คอลัมน์ 3.1)

| TC ID (เสนอ) | Requirement | Scenario | Type | Pre-condition / Test Data | Steps | Expected Result | Priority | Level | Data Source | Automation | Tag | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-NFR-REQ001-101 | NFR-mrr-001 | ไม่มีทางเข้าสู่ระบบแบบ SSO/AD | Negative | หน้า UI-mrr-001 · ผู้ใช้ `tester@mrr.local` | 1. เปิดหน้าเข้าสู่ระบบ 2. ดูทางเข้าทั้งหมด | มีเฉพาะทางเข้าด้วย Email (รหัส/magic link) ไม่มีปุ่ม SSO/AD | Medium | E2E | real | Yes | AI-generated | [Explicit NFR-mrr-001] · ข้อความบนหน้าจอ [TBD] |
| TC-NFR-REQ001-102 | NFR-mrr-003 | เรียก API โดยไม่มี session | Negative | ไม่ล็อกอิน | 1. เรียก endpoint ที่ต้องมีสิทธิ์ (เช่น แก้ห้อง) | ถูกปฏิเสธ ข้อมูลไม่เปลี่ยน | High | API | real | Yes | AI-generated | [Inferred] · RBAC คลุมบางส่วนแล้วด้วย EX-017/018/090 — ผูก NFR-003 เพิ่มแทนเขียนใหม่ |
| TC-NFR-REQ001-103 | NFR-mrr-003 | เข้าถึงผ่าน HTTP ธรรมดา | Negative | ระบบบน HTTPS | 1. เรียกด้วย `http://` | ไม่ให้เนื้อหาโดยไม่เข้ารหัส | High | API | real | Partial | AI-generated | [Inferred] · stack dev (localhost:4173) เป็น HTTP · สภาพแวดล้อมที่ตรวจ [TBD] |
| TC-NFR-REQ001-104 | NFR-mrr-002 | 200 ผู้ใช้พร้อมกัน เปิดตารางห้อง | Boundary | ผู้ใช้สังเคราะห์ 200 บัญชี `loadNNN@mrr.local` | 1. ยิง 200 session พร้อมกัน 2. เปิดตารางห้อง | โหลดเสร็จภายใน 2 วินาที | High | Load | real | Yes | AI-generated | [Explicit NFR-mrr-002] · จุดวัด/เปอร์เซ็นไทล์ [TBD] |
| TC-NFR-REQ001-105 | NFR-mrr-002 | 201 ผู้ใช้พร้อมกัน (เกินขอบ) | Boundary | เหมือนข้างบน +1 | ยิง 201 session | [TBD] ยังไม่มีเกณฑ์ | Low | Load | real | Partial | AI-generated | [TBD] |
| TC-NFR-REQ001-106 | NFR-mrr-004 | Uptime 99.9% | — | — | ตรวจจาก monitoring ตามรอบเวลา | ≥ 99.9% | Medium | — | — | No | AI-generated | ทดสอบเชิงฟังก์ชันไม่ได้ · รอบเวลาวัด [TBD] |

## Open Questions (TBD - Require Business Confirmation)

| # | คำถาม | ผู้ตอบที่เสนอ |
|---|---|---|
| 1 | NFR-002: "โหลดเสร็จ" วัดที่ใด · ใช้ p95 หรือค่าเฉลี่ย · มีเกณฑ์เมื่อเกิน 200 คนหรือไม่ (Q-mrr-004 ยังไม่ครอบคลุม) | PO / BA |
| 2 | NFR-004: ช่วงเวลาวัด Uptime และนับ maintenance window หรือไม่ | PO / Ops |
| 3 | NFR-003: ตรวจ HTTPS ในสภาพแวดล้อมไหน (stack dev เป็น HTTP) | Dev / Ops |
| 4 | NFR-001/003/004 รอบนี้ต้องมีเคสทดสอบ หรือจัดเป็น "พิสูจน์ด้วยวิธีอื่น" (ฟิลด์ "พิสูจน์ด้วย" ใน wiki ว่าง) | PO |

## Next Actions
1. รอคำตอบ OQ 1–4 ก่อนเขียนสคริปต์ (เคส 104–106 ตัวเลขยังไม่ครบ)
2. Dev ทำ fixture ผู้รับ U3 ล้ม (OQ-T1-15) แล้วเปลี่ยน TC-NTF-JOB-110 จาก `test.fixme` เป็นเคสจริง · จากนั้นเพิ่ม EX-mrr-112 ใน `e2e-ex-map.json` แล้วรัน T2 ซ้ำ
