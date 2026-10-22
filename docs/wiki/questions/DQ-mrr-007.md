---
type: Deferred Question
title: ข้อความ error ภาษาไทยตรงตัวที่ผู้ใช้เห็นเมื่อจองซ้ำหรือช่วงเวลาไม่ว่าง
description: "ห้องนี้ไม่ว่างในช่วงเวลาที่เลือก กรุณาเลือกเวลาอื่น" — ใช้ทั้งกรณีจองซ้ำ (กดซ้ำ) และช่วงเวลาไม่ว่าง (SRC-015)
resource: ../rules/BR-mrr-001@v1.md
tags: [mrr, question, idempotency]
id: DQ-mrr-007
state: answered
raised_by: BR-mrr-001@v1
answer_phase: screen
timestamp: 2026-10-22T10:30:00+07:00
spec_hash: sha256:d879c0b330e4e49231079051c1faf733e2e62bfa88ea7fc89048afc8178d5fe6
---

# DQ-mrr-007

## คำถามที่เลื่อนไป
ข้อความ error ภาษาไทยตรงตัวที่ผู้ใช้เห็นเมื่อจองซ้ำหรือช่วงเวลาไม่ว่าง

| เรื่อง | ค่า |
|---|---|
| สถานะ | ✅ answered |
| ตั้งขึ้นจาก | [BR-mrr-001@v1](../rules/BR-mrr-001@v1.md) |
| หมวด | idempotency |
| ตอบตอนไหน | screen — `/mock:coverage` (`mock`) |
| ติดอยู่ที่ | `screen:booking-form` |

## คำตอบ
"ห้องนี้ไม่ว่างในช่วงเวลาที่เลือก กรุณาเลือกเวลาอื่น" — ใช้ทั้งกรณีจองซ้ำ (กดซ้ำ) และช่วงเวลาไม่ว่าง (SRC-015)

ตอบเมื่อ 2026-10-16T14:45+07:00

## ผลที่ตามมา

- `EX-mrr-002`
- `EX-mrr-003`
