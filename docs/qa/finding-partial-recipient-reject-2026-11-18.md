# ผลตรวจ: ผู้รับเตือนบางคนถูกปฏิเสธ แต่ระบบบันทึก "ส่งสำเร็จ" (OQ-T1-15 · BR-mrr-020@v2 · EX-mrr-112) — 2026-11-18

**สถานะ:** พบจากการพิสูจน์ที่ชั้น transport + อ่านโค้ด · **ยังไม่ได้ยืนยันแบบ E2E** (ยังไม่ได้ยก API ทั้งตัวชี้ไป SMTP fixture) · ยังไม่ได้เปิดเป็น defect (รอ QA/PO ตัดสิน)

## กฎที่เกี่ยวข้อง
BR-mrr-020@v2 / EX-mrr-112 / AC-mrr-115: ผู้รับบางคนส่งไม่สำเร็จ → บันทึก 'ส่งไม่สำเร็จ' **ทั้งการจอง** · ไม่ส่งซ้ำ

## หลักฐาน
| ชั้น | วิธี | ผล |
|---|---|---|
| โค้ด | `booking-notifier.ts:92-95` `reminderDue` ส่งเมลฉบับเดียวถึง booker + attendee ทุกคน · `reminder-job.ts:25-28` บันทึก `FAILED` เฉพาะเมื่อ `send()` โยน `EmailDeliveryFailed` ไม่เช่นนั้นบันทึก `SENT` · `smtp-mail-transport.ts` ไม่ตรวจ `rejected` ของ nodemailer | — |
| transport (รันจริง) | `node test/fixtures/probe-partial-reject.mjs` · SMTP fixture ปฏิเสธ RCPT ของ `u3@mrr.local` · ใช้ `SmtpMailTransport` ที่ build แล้วใน `apps/api/dist` (nodemailer 6.10.1) | ส่งถึง u1,u2,u3 → **`send()` สำเร็จ ไม่โยน error** · เมลถึงจริงแค่ u1,u2 · ส่งถึง u3 คนเดียว → โยน error "all recipients were rejected" |

สรุป: ถ้า SMTP ปฏิเสธเฉพาะ U3 งานเตือนจะบันทึก `SENT` ทั้งที่ U3 ไม่ได้รับเมล → ขัดกับ EX-mrr-112 ที่ต้องได้ `FAILED`

## ข้อจำกัด
- probe ใช้ `apps/api/dist` (gitignored) — ตรวจแล้วบรรทัด `sendMail` ตรงกับ `src` แต่ไม่ได้เทียบทั้งไฟล์
- ยังไม่ได้รันกับ stack จริง: ต้องให้ API container ชี้ `SMTP_HOST` ไป fixture (แก้ compose/รีสตาร์ต) — เป็นงานของ Dev
- ตัว fixture ใช้ซ้ำได้: `node test/fixtures/partial-reject-smtp.mjs [port] [addr]` ปฏิเสธ RCPT ของ addr (ค่าเริ่มต้น `u3@mrr.local`)

## ขั้นถัดไป
1. QA/PO ตัดสินว่าเปิดเป็น defect หรือไม่ (ถ้าเปิด: ร่างด้วย T4)
2. Dev: ยืนยันแบบ E2E แล้วเปลี่ยน TC-NTF-JOB-110 จาก `test.fixme` เป็นเคสจริง · ถ้าตัดสินว่า defect ให้แก้ให้ `send()` นับ `rejected` ไม่ว่างเป็นล้ม
