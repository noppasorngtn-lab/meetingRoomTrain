---
type: Deferred Question
title: natural key ของการจองคือฟิลด์อะไร (ห้อง + ช่วงเวลา?) ที่ DB ใช้กันการจองซ้ำ
description: ห้อง + ช่วงเวลา [เริ่ม, จบ) — exclusion constraint บน (room, ช่วงเวลา) เฉพาะสถานะ PENDING_APPROVAL · CONFIRMED · APPROVED
resource: ../rules/BR-mrr-001@v1.md
tags: [mrr, question, idempotency]
id: DQ-mrr-006
state: answered
raised_by: BR-mrr-001@v1
answer_phase: domain
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:a0b64eb53708e26f4c20e8c420f24af06bb568c758fe4bb13d8b120bf119c83b
---

# DQ-mrr-006

## คำถามที่เลื่อนไป
natural key ของการจองคือฟิลด์อะไร (ห้อง + ช่วงเวลา?) ที่ DB ใช้กันการจองซ้ำ

| เรื่อง | ค่า |
|---|---|
| สถานะ | ✅ answered |
| ตั้งขึ้นจาก | [BR-mrr-001@v1](../rules/BR-mrr-001@v1.md) |
| หมวด | idempotency |
| ตอบตอนไหน | domain — `/design:datamodel` (`design`) |
| ติดอยู่ที่ | `entity:Booking` |

## คำตอบ
ห้อง + ช่วงเวลา [เริ่ม, จบ) — exclusion constraint บน (room, ช่วงเวลา) เฉพาะสถานะ PENDING_APPROVAL · CONFIRMED · APPROVED

ตอบเมื่อ 2026-10-19T13:30:00+07:00

