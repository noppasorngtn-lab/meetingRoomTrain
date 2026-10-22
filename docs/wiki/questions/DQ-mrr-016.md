---
type: Deferred Question
title: ข้อความ error ภาษาไทยตรงตัวที่ผู้ใช้เห็นเมื่อขอรหัสซ้ำระหว่างที่รหัสเดิมยังใช้ได
description: เจ้าของตอบใน /req:example BR-mrr-025: ข้อความคือ 'ส่งรหัสไปแล้ว กรุณาใช้รหัสเดิมใน Email หรือรอให้รหัสหมดอายุก่อนขอใหม่'
resource: ../rules/BR-mrr-025@v1.md
tags: [mrr, question, idempotency]
id: DQ-mrr-016
state: answered
raised_by: BR-mrr-025@v1
answer_phase: screen
timestamp: 2026-10-22T10:30:00+07:00
spec_hash: sha256:dd635274b018ea3e7cd41da938af43c86818b1321bbba9da9a73c5086ad85df8
---

# DQ-mrr-016

## คำถามที่เลื่อนไป
ข้อความ error ภาษาไทยตรงตัวที่ผู้ใช้เห็นเมื่อขอรหัสซ้ำระหว่างที่รหัสเดิมยังใช้ได้

| เรื่อง | ค่า |
|---|---|
| สถานะ | ✅ answered |
| ตั้งขึ้นจาก | [BR-mrr-025@v1](../rules/BR-mrr-025@v1.md) |
| หมวด | idempotency |
| ตอบตอนไหน | screen — `/mock:coverage` (`mock`) |

## คำตอบ
เจ้าของตอบใน /req:example BR-mrr-025: ข้อความคือ 'ส่งรหัสไปแล้ว กรุณาใช้รหัสเดิมใน Email หรือรอให้รหัสหมดอายุก่อนขอใหม่'

ตอบเมื่อ 2026-10-22T06:18+07:00

## ผลที่ตามมา

- `EX-mrr-095`
- `EX-mrr-096`
- `EX-mrr-097`
