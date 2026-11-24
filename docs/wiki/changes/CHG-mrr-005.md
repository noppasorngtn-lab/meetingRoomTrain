---
type: Change Set
title: สัญญาการคำนวณยังพินกฎ BR-mrr-006@v1 ที่ถูกแทนที่โดย CHG-mrr-004 สัญญาจึงไม่ถูกส่
description: กระทบ 1 โหนด · มีผล 2026-11-19
resource: ../rules/CALC-mrr-001@v2.md
tags: [mrr, change]
id: CHG-mrr-005
requested_by: Noppasorn
approved_by: Noppasorn
effective_from: 2026-11-19
affects: [CALC-mrr-001@v2]
invalidates: []
triggered_by: []
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:d30dde2fb6203b74833d417cd931f3b0d72fcb09c930348660e7dbf7b680c685
---

# CHG-mrr-005

## ทำไมถึงเปลี่ยน
สัญญาการคำนวณยังพินกฎ BR-mrr-006@v1 ที่ถูกแทนที่โดย CHG-mrr-004 สัญญาจึงไม่ถูกส่งออกไปยัง design/dev (calculations[] ว่างตั้งแต่ 35fbc2c) · ขึ้นเวอร์ชันเพื่อพินกฎปัจจุบัน BR-mrr-006@v2 · สูตร ชนิดตัวเลข การปัด และขอบทุกข้อเหมือน @v1 ไม่เปลี่ยน

| เรื่อง | ค่า |
|---|---|
| ใครขอ | Noppasorn |
| ใครอนุมัติ | Noppasorn |
| มีผลตั้งแต่ | 2026-11-19 |
| เอกสารที่ทำให้เปลี่ยน | — |

## เปลี่ยนอะไร

| โหนด | จาก | เป็น |
|---|---|---|
| [CALC-mrr-001@v2](../calculations/CALC-mrr-001@v2.md) | [CALC-mrr-001@v1](../calculations/CALC-mrr-001@v1.md) utilization_pct = booked_minutes ÷ operating_minutes × 100 | utilization_pct = booked_minutes ÷ operating_minutes × 100 |

## หมายเหตุ
ต่อจาก CHG-mrr-004 ซึ่งตัดสินว่าสูตรไม่เปลี่ยน — ใบนี้ไม่เปลี่ยนเนื้อหาของสัญญา ย้ายเฉพาะกฎที่พิน · GD-mrr-001 ไม่ถูกทำให้เป็นโมฆะ (สูตรเดิม ค่าทุกแถวยังถูก) แต่ proves ยังชี้ CALC-mrr-001@v1 — ต่อไป /req:golden ให้ครอบ @v2 · พบจาก /dev:build FE-mrr-036 ที่ build.mjs ปฏิเสธ calc_ref เพราะสัญญาไม่มี CALC (GAP-mrr-026 รอบผูก AC-mrr-128..131) · ไม่มี SRC ใหม่ — เจ้าของอนุมัติในการสนทนา 2026-11-24
