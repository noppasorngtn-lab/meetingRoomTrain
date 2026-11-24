---
type: Deferred Question
title: ข้อมูลที่เขียนไปแล้วก่อนส่ง Email (เช่น บันทึกการจอง) — rollback หรือค้างครึ่งทา
description: rollback ทั้งรายการ — ส่ง Email ไม่สำเร็จแล้วไม่มีข้อมูลค้างครึ่งทาง ผู้ใช้กดใหม่ได้ ตาม BR-mrr-019@v1 (SRC-039)
resource: ../rules/BR-mrr-019@v1.md
tags: [mrr, question, integration]
id: DQ-mrr-005
state: answered
raised_by: BR-mrr-019@v1
answer_phase: plan
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:4abcabae6a573f707d236a57792e216a78883a19170802350fad0aa4495b74de
---

# DQ-mrr-005

## คำถามที่เลื่อนไป
ข้อมูลที่เขียนไปแล้วก่อนส่ง Email (เช่น บันทึกการจอง) — rollback หรือค้างครึ่งทาง เมื่อส่ง Email ไม่สำเร็จ (transaction boundary)

| เรื่อง | ค่า |
|---|---|
| สถานะ | ✅ answered |
| ตั้งขึ้นจาก | [BR-mrr-019@v1](../rules/BR-mrr-019@v1.md) |
| หมวด | integration |
| ตอบตอนไหน | plan — ยังไม่มีคำสั่งประกาศไว้ · เป็นของ `dev` |
| ติดอยู่ที่ | `entity:Booking` |

## คำตอบ
rollback ทั้งรายการ — ส่ง Email ไม่สำเร็จแล้วไม่มีข้อมูลค้างครึ่งทาง ผู้ใช้กดใหม่ได้ ตาม BR-mrr-019@v1 (SRC-039)

ตอบเมื่อ 2026-11-24T19:00+07:00

## ผลที่ตามมา

- `BR-mrr-019@v1`
