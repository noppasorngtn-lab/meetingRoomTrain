# Theme brief for "mrr" — assembled from the project's design artifacts by /mock:theme (specification 6.2)

## 1. Business and users
- in scope: ค้นหาและกรองห้องว่าง ดูปฏิทินการใช้ห้องรายวัน/รายสัปดาห์/รายเดือน จองห้องพร้อมตรวจสอบการจองทับอัตโนมัติ และจัดการการจองของตนเอง (ดูประวัติ แก้ไข ยกเลิก) (REQ-mrr-001)
- in scope: กำหนดห้องที่ต้องอนุมัติ กำหนดผู้อนุมัติประจำห้อง อนุมัติ/ปฏิเสธ/ถอยผลการจอง และบันทึกร่องรอยการกระทำของ Room Administrator (REQ-mrr-002)
- in scope: เพิ่ม แก้ไข ปิดปรับปรุง หรือลบข้อมูลห้องประชุม พร้อมความจุ รูปภาพ และสิ่งอำนวยความสะดวก (REQ-mrr-003)
- in scope: รายงานการใช้ห้องรายเดือน/รายปี และสถิติอัตราการใช้งานรายห้องสำหรับวางแผนทรัพยากร (REQ-mrr-004)
- in scope: แจ้งเตือนทาง Email เมื่อจองสำเร็จ/ได้รับอนุมัติ ใกล้ถึงเวลาประชุม และเมื่อเปลี่ยนเวลาหรือยกเลิกการจอง รวมงานตามเวลาที่ส่งเตือนก่อนเริ่มประชุม (REQ-mrr-005)
- in scope: เข้าสู่ระบบด้วย Email ขององค์กร และจำกัดสิทธิ์ตามบทบาท (General User · Room Administrator · System Administrator) (REQ-mrr-001)
- user: พนักงานทั่วไป — ค้นหาห้อง ดูตารางว่าง จองและจัดการการจองของตนเอง
- user: เจ้าหน้าที่ดูแลอาคาร/สถานที่ — อนุมัติการจอง จัดการข้อมูลห้อง ดูรายงาน
- user: ผู้ดูแลระบบไอที — จัดการสิทธิ์ผู้ใช้ ตั้งค่าระบบหลังบ้าน ดูแลความปลอดภัย
- user: งานตามเวลาของระบบ — ส่ง Email เตือนก่อนเริ่มประชุม และยกเลิกการจองที่ค้างรออนุมัติเมื่อถึงเวลาเริ่ม

## 2. How it is used
- assumption: ทุกห้องและผู้ใช้อยู่ในเขตเวลาเดียว คือ Asia/Bangkok
- assumption: ห้องทั้งหมดอยู่ในองค์กรเดียว ไม่ต้องแยกหรือจัดกลุ่มตามอาคาร/สาขา
- assumption: บัญชีผู้ใช้ (Email องค์กร) นำเข้าจากรายชื่อพนักงานของ HR เป็นระยะ ผู้ใช้ไม่สมัครเอง
- constraint: เข้าสู่ระบบด้วย Email ขององค์กรอย่างเดียว ไม่เชื่อม Active Directory
- constraint: รองรับผู้ใช้งานพร้อมกัน 200 คน และหน้าจอตารางห้องประชุมโหลดเสร็จภายใน 2 วินาที
- constraint: เข้ารหัสการใช้งานผ่าน HTTPS และจำกัดสิทธิ์ตามระดับผู้ใช้งาน (Role-Based Access Control)
- constraint: เปิดให้บริการตลอด 24 ชั่วโมง (Uptime 99.9%)
- constraint: รองรับ Chrome, Safari, Edge, Firefox และแสดงผลได้ดีบนอุปกรณ์เคลื่อนที่ (Responsive Design)
- constraint: ช่องทางแจ้งเตือนมี Email ช่องทางเดียว
- constraint: ชั่วโมงทำการของห้องเป็นค่าเดียวทั้งองค์กร (ตามคำนิยามใน glossary) ใช้เป็นตัวหารของอัตราการใช้งาน
- measured targets the UI must not work against:
  - NFR-mrr-001: อายุของรหัส OTP / magic link ที่ส่งไปยัง Email องค์กร นับจากเวลาที่ส่งจนถึงเวลาที่ระบบไม่รับรหัสนั้นแล้ว — <= 10 นาที (รหัสใช้เข้าสู่ระบบได้ครั้งเดียว · ขอรหัสได้เฉพาะ Email ที่อยู่ในรายชื่อพนักงานที่นำเข้าและ User.active = true — Email นอกรายชื่อหรือนอกโดเมนองค์กรต้องเข้าสู่ระบบไม่ได้ทุกกรณี · ไม่มีการเข้าสู่ระบบผ่าน Active Directory)
  - NFR-mrr-002: เวลาจากที่ผู้ใช้เปิดปฏิทินห้องรายสัปดาห์ จนข้อมูลการจองของสัปดาห์นั้นแสดงครบบนหน้าจอ — <= 2 วินาที (ค่า p95 ขณะมีผู้ใช้ทำงานพร้อมกัน 200 คน ต่อเนื่อง 30 นาที · ข้อมูลห้อง 50 ห้อง และการจองสะสม 2 ปี (ประมาณ 50,000 รายการ) · วัดบนสภาพแวดล้อม on-premise ที่ใช้งานจริงหรือเทียบเท่า)
  - NFR-mrr-003: จำนวนคำขอที่ผ่านทั้งที่ไม่ควรผ่าน: คำขอผ่าน HTTP ที่ไม่ถูกบังคับเป็น HTTPS และคำขอข้ามบทบาทหรือข้ามเจ้าของที่ระบบตอบสำเร็จ — = 0 ครั้ง (ทดสอบทุก endpoint ของระบบ ด้วยบัญชีของทั้ง 3 บทบาท และกับการจองที่ผู้ทดสอบไม่ได้เป็นเจ้าของ ตามตารางสิทธิ์ใน rbac.json)
  - NFR-mrr-004: สัดส่วนเวลาที่ระบบตอบหน้าเข้าสู่ระบบและ API ตรวจสุขภาพได้สำเร็จ ต่อเวลาทั้งหมดในเดือนนั้น — >= 99.9 เปอร์เซ็นต์ (วัดต่อเดือนปฏิทิน ตลอด 24 ชั่วโมง (หยุดได้ไม่เกินประมาณ 43 นาทีต่อเดือน) · ไม่นับช่วงปิดปรับปรุงที่แจ้งผู้ใช้ล่วงหน้าอย่างน้อย 3 วันทำการ)
  - NFR-mrr-005: จำนวน scenario รับมอบที่ล้มเหลวเมื่อรันบนเบราว์เซอร์และขนาดหน้าจอที่กำหนด — = 0 รายการ (Chrome, Safari, Edge และ Firefox 2 รุ่นหลักล่าสุด ณ วันทดสอบรับมอบ · หน้าจอกว้างตั้งแต่ 360px ขึ้นไป โดยไม่มีการเลื่อนหน้าจอแนวนอน)

## 3. Components this system actually needs (15 screen(s) in 1 module(s))
- button: 37 — any action design declared (screens.json actions[]): UI-mrr-001/request-code, UI-mrr-002/verify, UI-mrr-002/resend, UI-mrr-003/sign-in-again, UI-mrr-004/search, UI-mrr-004/view-calendar, …
- input: 30 — any declared field design marks io: capture — one the user types (gate 35); where design declares no io, the older rule stands: a field bound to no entity attribute. The same resolver wireframes.mjs uses for input: true: UI-mrr-001/Email องค์กร, UI-mrr-002/รหัส OTP, UI-mrr-004/วันที่, UI-mrr-004/เวลาเริ่ม, UI-mrr-004/เวลาสิ้นสุด, UI-mrr-004/จำนวนผู้เข้าร่วม, …
- table: 8 — any wireframe whose layout is rows or report (mockup-map.json); before a wireframe exists, any screen with dataBearing: true: UI-mrr-004 (rows), UI-mrr-007 (rows), UI-mrr-009 (rows), UI-mrr-010 (rows), UI-mrr-011 (rows), UI-mrr-012 (rows), …
- alert: 15 — any screen whose error state occurs (screens.json states.error not starting with ไม่เกิด): UI-mrr-001 (error state occurs), UI-mrr-002 (error state occurs), UI-mrr-003 (error state occurs), UI-mrr-004 (error state occurs), UI-mrr-005 (error state occurs), UI-mrr-006 (error state occurs), …
- actions, by declared name: ขอรหัสเข้าสู่ระบบ · เข้าสู่ระบบ · ขอรหัสใหม่ · เข้าสู่ระบบอีกครั้ง · ค้นหา · ดูปฏิทินห้อง · จองห้องนี้ · เปลี่ยนมุมมอง · จองช่วงที่ว่าง · ยืนยันการจอง · ยกเลิก · แก้ไข · ยกเลิกการจอง · บันทึก · กลับ · อนุมัติ · ปฏิเสธ · จัดการการจอง · เปลี่ยนผลการอนุมัติ · แก้แทนผู้จอง · ยกเลิกแทนผู้จอง · อนุมัติคำขอ · ปฏิเสธคำขอ · เพิ่มห้อง · แก้ไขห้อง · ปิดปรับปรุง / เปิดใช้งาน · ลบห้อง · สิ่งอำนวยความสะดวก · เพิ่ม · ออกรายงานฉบับใหม่ · เปิดฉบับที่ออกแล้ว · ส่งออก
- screen states that occur (count of screens): empty 13 · loading 15 · error 15 · overflow 13 · unauthorized 12
- every interaction state needs a token: normal · hover · active · focus · disabled · error (gate 24 — a missing one is reported to dev, not invented)

## 4. Known constraints
- Thai text throughout (field and action names are Thai) — a font with Thai glyphs and line-height for Thai vowels/tone marks
- UI-mrr-001 overflow: Email ยาวเกิน 254 ตัวอักษร — ไม่รับและแจ้งที่ช่อง
- UI-mrr-004 overflow: ผลมากกว่า 20 ห้อง — แบ่งหน้า 20 ห้องต่อหน้า · ชื่อห้องยาวเกิน 1 บรรทัดตัดด้วย … และแสดงเต็มเมื่อชี้
- UI-mrr-005 overflow: หลายการจองในช่องเดียวของมุมมองรายเดือน — แสดง 3 รายการแรกและ '+N' ที่กดดูทั้งหมดได้
- UI-mrr-006 overflow: หัวข้อเกิน 200 ตัวอักษรไม่รับ · ผู้เข้าร่วมเกินความจุห้อง — แสดงคำเตือนแต่ยังบันทึกได้ (req ไม่มีกฎห้าม)
- UI-mrr-007 overflow: มากกว่า 20 รายการ — แบ่งหน้า เรียงจากเวลาเริ่มล่าสุด · หัวข้อยาวตัดด้วย …
- UI-mrr-008 overflow: หัวข้อเกิน 200 ตัวอักษรไม่รับ
- UI-mrr-009 overflow: มากกว่า 20 รายการ — แบ่งหน้า เรียงตามเวลาเริ่มที่ใกล้ที่สุดก่อน
- UI-mrr-010 overflow: ร่องรอยมากกว่า 50 รายการ — แบ่งหน้า เรียงล่าสุดก่อน · เหตุผลยาวพับและกดขยายได้
- UI-mrr-011 overflow: มากกว่า 20 รายการ — แบ่งหน้า · ค่าที่ขอเปลี่ยนจำนวนมากพับและกดขยายได้
- UI-mrr-012 overflow: มากกว่า 20 ห้อง — แบ่งหน้าและค้นหาตามชื่อหรือรหัส · ห้อง ARCHIVED ซ่อนไว้โดยเปิดดูได้ด้วยตัวกรอง
- UI-mrr-013 overflow: ชื่อเกิน 100 ตัวอักษรไม่รับ · รูปภาพเกินขนาดที่กำหนดไม่รับและแจ้งที่ช่อง
- UI-mrr-014 overflow: มากกว่า 50 รายการ — แบ่งหน้า
- RPT-mrr-001 overflow: มากกว่า 50 ห้อง — แบ่งหน้าบนจอ ไฟล์ส่งออกมีครบทุกห้อง

## 5. Do not
- out of scope: การเชื่อม Active Directory / SSO — ไม่ทำในรอบนี้
- out of scope: การแจ้งเตือนผ่านแอปแชทขององค์กร (Line, Microsoft Teams, Slack) — รอบนี้แจ้งเตือนทาง Email อย่างเดียว
- out of scope: แอปมือถือแบบ native (iOS/Android) — รองรับมือถือผ่านเว็บแบบ Responsive เท่านั้น
- out of scope: การซิงก์การจองกับปฏิทินภายนอก (Outlook / Google Calendar)
- out of scope: การจองแบบประจำ (ซ้ำทุกสัปดาห์/ทุกเดือน) — หนึ่งการจองคือหนึ่งช่วงเวลา
- do not add screens, fields or actions — the list above is the whole inventory design declared (MP9)
- deliver as CSS custom properties in :root{} (light) and [data-theme="dark"] (dark, if any) plus a component list — /mock:theme --from <dir> reads exactly that (gate 24)
