---
type: Requirement
title: การอนุมัติการจอง
description: กำหนดได้ว่าห้องใดต้องได้รับอนุมัติก่อนใช้งานจริง และอนุมัติการจองของห้องเหล่านั้น
resource: ../../requirements/REQ-mrr-002.md
tags: [mrr, requirement]
id: REQ-mrr-002
status: draft
actor: Room Administrator
rules: [BR-mrr-004, BR-mrr-011, BR-mrr-013, BR-mrr-016, BR-mrr-017, BR-mrr-018]
domain_concepts: [UL-mrr-001, UL-mrr-002, UL-mrr-006, UL-mrr-010, UL-mrr-009]
timestamp: 2026-10-22T10:00:00+07:00
spec_hash: sha256:3303f28d182c19bcf822e6cc49b221d3a584ac1eb519fe038dc32a789bf46a4f
---

# REQ-mrr-002

## เป้าหมาย
กำหนดได้ว่าห้องใดต้องได้รับอนุมัติก่อนใช้งานจริง และอนุมัติการจองของห้องเหล่านั้น

**actor:** Room Administrator · **ความสำคัญ:** medium · **มีหน้าจอ:** ใช่

## กฎที่ยังใช้อยู่

| กฎ | ชนิด | ข้อความ | ตัวอย่าง |
|---|---|---|---|
| [BR-mrr-004@v1](../rules/BR-mrr-004@v1.md) | policy | การจองห้องที่ถูกตั้งไว้ว่า "ต้องอนุมัติ" จะใช้งานจริงได้ต่อเมื่อ Room Administrator อนุมัติแล้ว ห้องที่ไม่ได้ตั้งไว้ไม่ต้องรออนุมัติ | 4 |
| [BR-mrr-011@v1](../rules/BR-mrr-011@v1.md) | policy | Room Administrator เปลี่ยนผลการอนุมัติหรือปฏิเสธการจองได้ โดยต้องระบุเหตุผลทุกครั้ง และทำได้เฉพาะก่อนถึงเวลาเริ่มประชุม | 5 |
| [BR-mrr-013@v1](../rules/BR-mrr-013@v1.md) | policy | แต่ละห้องที่ต้องอนุมัติกำหนดผู้อนุมัติประจำห้อง (Room Administrator) ได้ — ถ้ายังไม่กำหนด Room Administrator ทุกคนอนุมัติได้ และกำหนดทีหลังได้ | 4 |
| [BR-mrr-016@v1](../rules/BR-mrr-016@v1.md) | policy | การจองที่ยังรออนุมัติเมื่อถึงเวลาเริ่มประชุม ถูกยกเลิกอัตโนมัติ ปล่อยช่วงเวลาคืน และแจ้งผู้จอง — ถ้าส่ง Email แจ้งผู้จองไม่สำเร็จ ยังไม่ยกเลิก รองานรอบถัดไปทำใหม่ · ระหว่างที่ค้างอยู่ Room Administrator ยังอนุมัติได้ | 4 |
| [BR-mrr-017@v1](../rules/BR-mrr-017@v1.md) | invariant | ทุกการกระทำของ Room Administrator ต่อการจอง (อนุมัติ · ปฏิเสธ · ถอยผล · แก้หรือยกเลิกแทนผู้จอง) ต้องบันทึกร่องรอย: ใคร · เมื่อไหร่ · ทำอะไร · เหตุผล | 4 |
| [BR-mrr-018@v1](../rules/BR-mrr-018@v1.md) | policy | ร่องรอยการกระทำดูได้เฉพาะ Room Administrator และ System Administrator — ผู้จองดูไม่ได้ | 4 |

## คำศัพท์ที่ผูกกับ requirement นี้

- [UL-mrr-001 · ห้องประชุม](../glossary/UL-mrr-001.md)
- [UL-mrr-002 · การจอง](../glossary/UL-mrr-002.md)
- [UL-mrr-006 · การอนุมัติการจอง](../glossary/UL-mrr-006.md)
- [UL-mrr-009 · งานแจ้งเตือนตามเวลา](../glossary/UL-mrr-009.md)
- [UL-mrr-010 · ผู้อนุมัติประจำห้อง](../glossary/UL-mrr-010.md)

## ฉบับที่คนอ่าน
[docs/requirements/REQ-mrr-002.md](../../requirements/REQ-mrr-002.md) — เนื้อความเต็มภาษาไทย
