---
type: Golden Dataset
title: เลขเฉลยของ BR-mrr-006@v1 · CALC-mrr-001@v1
description: 14 แถว · ยืนยันแล้ว
resource: ../rules/BR-mrr-006@v1.md
tags: [mrr, golden]
id: GD-mrr-001
status: validated
proves: [BR-mrr-006@v1, CALC-mrr-001@v1]
verified_by: Adisorn
verified_at: 2026-10-19T12:10+07:00
timestamp: 2026-10-22T10:00:00+07:00
spec_hash: sha256:5410c8670bc6732813dcc5b90aec5149a00bf9b9a9238e4375d5442da24270a7
---

# GD-mrr-001

## สถานะการยืนยัน

✅ **Adisorn** ยืนยันเมื่อ 2026-10-19T12:10+07:00 — ตัวเลขชุดนี้ใช้ยันกับลูกค้าได้

คำนวณโดย `golden/CALC-mrr-001@v1.mjs` เมื่อ 2026-10-19T12:00+07:00

## พิสูจน์

- [BR-mrr-006@v1](../rules/BR-mrr-006@v1.md) — อัตราการใช้งานรายห้อง = ชั่วโมงที่ถูกจองและใช้ได้จริง (ไม่ต้องอนุมัติ หรืออนุมัติแล้ว — ไม่นับยกเลิก / ปฏิเสธ / รออนุมัติ) ÷ ชั่วโมงทำการของห้องในช่วงรายงาน · ปัดทุกจุดแบบ round half up · ใช้จัดอันดับห้องที่ใช้งานสูงสุด
- [CALC-mrr-001@v1](../calculations/CALC-mrr-001@v1.md) — utilization_pct = booked_minutes ÷ operating_minutes × 100

## ตาราง (14 แถว)

| year | month | bookings | maintenance | booked_minutes | operating_minutes | utilization_pct | display | ranked | มาจากแถวไหน |
|---|---|---|---|---|---|---|---|---|---|
| 2026 | 10 | [object Object] | — | 600 | 13200 | 4.55 | 4.55% | true | — |
| 2026 | 10 | [object Object] | — | 600 | 13200 | 4.55 | 4.55% | true | — |
| 2026 | 10 | [object Object] | — | 0 | 13200 | 0.00 | 0.00% | true | — |
| 2026 | 10 | [object Object] | — | 0 | 13200 | 0.00 | 0.00% | true | — |
| 2026 | 10 | [object Object] | — | 0 | 13200 | 0.00 | 0.00% | true | — |
| 2026 | 10 | [object Object] | — | 60 | 13200 | 0.45 | 0.45% | true | — |
| 2026 | 10 | [object Object] | — | 60 | 13200 | 0.45 | 0.45% | true | — |
| 2026 | 10 | [object Object] | — | 0 | 13200 | 0.00 | 0.00% | true | — |
| 2026 | 10 | [object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object] | — | 13200 | 13200 | 100.00 | 100.00% | true | — |
| 2026 | 10 | [object Object] | — | 60 | 13200 | 0.45 | 0.45% | true | — |
| 2026 | 10 | [object Object],[object Object] | [object Object],[object Object],[object Object],[object Object],[object Object] | 60 | 10200 | 0.59 | 0.59% | true | — |
| 2026 | 10 | [object Object] | [object Object] | 60 | 13080 | 0.46 | 0.46% | true | — |
| 2026 | 10 | [object Object] | [object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object] | 0 | 0 | — | — | false | — |
| 2026 | 10 | [object Object] | [object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object] | 401 | 800 | 50.13 | 50.13% | true | — |

## หมายเหตุ
ไม่มี sample_data ในโปรเจกต์ จึงไม่มีเลขของลูกค้าให้ทาบ — ทุกแถวเป็นขอบตาม boundary_behavior ทั้ง 5 ข้อ สถานะการจองทุกแบบ และแถว HALF_UP ที่ลงตัว .xx5 พอดี · สถานการณ์ของ EX-mrr-084…087 รันผ่านสคริปต์นี้แล้วตรงกันทุกค่า · ยังไม่ครอบคลุมการจัดอันดับเมื่ออัตราเท่ากัน (ยังไม่มีกฎ)
