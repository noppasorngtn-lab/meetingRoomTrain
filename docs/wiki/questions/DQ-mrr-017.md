---
type: Deferred Question
title: ข้อมูลส่วนบุคคลของผู้ใช้ (User.email · User.fullName) เก็บได้นานเท่าไหร่ และนับจ
description: ข้อมูลส่วนบุคคลของผู้ใช้ (User.email · User.fullName) เก็บได้นานเท่าไหร่ และนับจากเหตุการณ์ไหน (เช่น ตั้งแต่บัญชีไม่ active เพราะไม่อยู่ในรายชื่อ HR รอบล่าสุด) — และเมื่อครบกำหนด ร่องรอยการกระทำ การจอง และรายงานที่ลบไม่ได้ซึ่งอ้างถึงผู้ใช้คนนั้นจะทำอย่างไร (เก็บต่อ · ปิดบังชื่อ) · เจ้าของ (Noppasorn) ตัดสินแล้วเมื่อ 2026-11-24 ว่าฟิลด์ข้อมูลส่วนบุคคลมีเฉพาะ User.email และ User.fullName ระดับ confidential ส่วนระยะเวลาเก็บต้องถามลูกค้า (PDPA · design V15 ต้องมี retention ก่อนประกาศ personalData)
resource: ../rules/BR-mrr-026@v1.md
tags: [mrr, question, temporal]
id: DQ-mrr-017
state: open
raised_by: BR-mrr-026@v1
answer_phase: domain
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:9b87371f10400a4f859d4cdc8183a03f3ba03c373385e39aea42f3d3b11c5970
---

# DQ-mrr-017

## คำถามที่เลื่อนไป
ข้อมูลส่วนบุคคลของผู้ใช้ (User.email · User.fullName) เก็บได้นานเท่าไหร่ และนับจากเหตุการณ์ไหน (เช่น ตั้งแต่บัญชีไม่ active เพราะไม่อยู่ในรายชื่อ HR รอบล่าสุด) — และเมื่อครบกำหนด ร่องรอยการกระทำ การจอง และรายงานที่ลบไม่ได้ซึ่งอ้างถึงผู้ใช้คนนั้นจะทำอย่างไร (เก็บต่อ · ปิดบังชื่อ) · เจ้าของ (Noppasorn) ตัดสินแล้วเมื่อ 2026-11-24 ว่าฟิลด์ข้อมูลส่วนบุคคลมีเฉพาะ User.email และ User.fullName ระดับ confidential ส่วนระยะเวลาเก็บต้องถามลูกค้า (PDPA · design V15 ต้องมี retention ก่อนประกาศ personalData)

| เรื่อง | ค่า |
|---|---|
| สถานะ | 🛑 **open** — ยังไม่มีคำตอบ |
| ตั้งขึ้นจาก | [BR-mrr-026@v1](../rules/BR-mrr-026@v1.md) |
| หมวด | temporal |
| ตอบตอนไหน | domain — `/design:datamodel` (`design`) |
| ติดอยู่ที่ | `entity:User.email · entity:User.fullName` |

