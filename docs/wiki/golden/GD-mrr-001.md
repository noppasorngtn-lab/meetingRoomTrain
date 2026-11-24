---
type: Golden Dataset
title: เลขเฉลยของ BR-mrr-006@v1 · BR-mrr-006@v2 · CALC-mrr-001@v1
description: 16 แถว · ยืนยันแล้ว
resource: ../rules/BR-mrr-006@v1.md
tags: [mrr, golden]
id: GD-mrr-001
status: validated
proves: [BR-mrr-006@v1, BR-mrr-006@v2, CALC-mrr-001@v1]
verified_by: Noppasorn
verified_at: 2026-11-19T14:00+07:00
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:e0711edec705f77846e56bde4f5b9bde82bbb5c559b3ed4f266b83500db384d3
---

# GD-mrr-001

## สถานะการยืนยัน

✅ **Noppasorn** ยืนยันเมื่อ 2026-11-19T14:00+07:00 — ตัวเลขชุดนี้ใช้ยันกับลูกค้าได้

คำนวณโดย `golden/CALC-mrr-001@v1.mjs` เมื่อ 2026-11-19T14:00+07:00

## พิสูจน์

- [BR-mrr-006@v1](../rules/BR-mrr-006@v1.md) — อัตราการใช้งานรายห้อง = ชั่วโมงที่ถูกจองและใช้ได้จริง (ไม่ต้องอนุมัติ หรืออนุมัติแล้ว — ไม่นับยกเลิก / ปฏิเสธ / รออนุมัติ) ÷ ชั่วโมงทำการของห้องในช่วงรายงาน · ปัดทุกจุดแบบ round half up · ใช้จัดอันดับห้องที่ใช้งานสูงสุด
- [BR-mrr-006@v2](../rules/BR-mrr-006@v2.md) — อัตราการใช้งานรายห้อง = ชั่วโมงที่ถูกจองและใช้ได้จริง (ไม่ต้องอนุมัติ หรืออนุมัติแล้ว — ไม่นับยกเลิก / ปฏิเสธ / รออนุมัติ) ÷ ชั่วโมงทำการของห้องในช่วงรายงาน · ปัดทุกจุดแบบ round half up · ใช้จัดอันดับห้องที่ใช้งานสูงสุด · ห้องที่อัตราการใช้งานเท่ากัน (เทียบหลังปัดตามสัญญาการคำนวณเหลือทศนิยม 2 ตำแหน่ง) ได้อันดับเดียวกัน และห้องถัดไปข้ามเลขอันดับ เช่น 1, 1, 3
- [CALC-mrr-001@v1](../calculations/CALC-mrr-001@v1.md) — utilization_pct = booked_minutes ÷ operating_minutes × 100

## ตาราง (16 แถว)

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
| 2026 | 10 | [object Object] | — | 59 | 13200 | 0.45 | 0.45% | true | — |
| 2026 | 10 | [object Object] | — | 58 | 13200 | 0.44 | 0.44% | true | — |

## หมายเหตุ
ไม่มี sample_data ในโปรเจกต์ จึงไม่มีเลขของลูกค้าให้ทาบ — ทุกแถวเป็นขอบตาม boundary_behavior ทั้ง 5 ข้อ สถานะการจองทุกแบบ และแถว HALF_UP ที่ลงตัว .xx5 พอดี · สถานการณ์ของ EX-mrr-084…087 รันผ่านสคริปต์นี้แล้วตรงกันทุกค่า · ยังไม่ครอบคลุมเลขอันดับ (แถวของ GD เก็บเฉพาะค่าต่อห้อง ไม่มีช่องอันดับ) · 2026-11-19 (CHG-mrr-004): เพิ่มแถว 15–16 ขอบของการเสมอ (59 นาที → 0.45 เท่ากับ 60 นาที · 58 นาที → 0.44) · 14 แถวแรกตรงกับชุดที่ Adisorn เซ็นเมื่อ 2026-10-19 ทุกไบต์ · ชุด 16 แถวนี้ Noppasorn ยืนยันและลงนามใหม่ 2026-11-19
