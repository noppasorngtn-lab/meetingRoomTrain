---
type: Deferred Question
title: ระบบรู้ได้อย่างไรว่าเป็นการขอรหัสซ้ำของคนเดิม — natural key คือบัญชีผู้ใช้หรือ E
description: นับต่อบัญชีผู้ใช้ (User, ENT-001) — LoginCode.user อ้าง User และผู้ใช้หนึ่งคนมีรหัสสถานะ ISSUED ที่ยังไม่หมดอายุได้ไม่เกินหนึ่งตัว บังคับที่ db
resource: ../rules/BR-mrr-025@v1.md
tags: [mrr, question, idempotency]
id: DQ-mrr-015
state: answered
raised_by: BR-mrr-025@v1
answer_phase: domain
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:cbac5d97e770fb33b4c09e3d0f2e2e028b1d0aaba485a052b8449b298a1256a4
---

# DQ-mrr-015

## คำถามที่เลื่อนไป
ระบบรู้ได้อย่างไรว่าเป็นการขอรหัสซ้ำของคนเดิม — natural key คือบัญชีผู้ใช้หรือ Email

| เรื่อง | ค่า |
|---|---|
| สถานะ | ✅ answered |
| ตั้งขึ้นจาก | [BR-mrr-025@v1](../rules/BR-mrr-025@v1.md) |
| หมวด | idempotency |
| ตอบตอนไหน | domain — `/design:datamodel` (`design`) |

## คำตอบ
นับต่อบัญชีผู้ใช้ (User, ENT-001) — LoginCode.user อ้าง User และผู้ใช้หนึ่งคนมีรหัสสถานะ ISSUED ที่ยังไม่หมดอายุได้ไม่เกินหนึ่งตัว บังคับที่ db

ตอบเมื่อ 2026-10-22T09:57:40+07:00

