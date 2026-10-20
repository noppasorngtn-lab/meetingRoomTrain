---
type: Business Rule
title: Room Administrator เปลี่ยนผลการอนุมัติหรือปฏิเสธการจองได้ โดยต้องระบุเหตุผลทุกคร
description: Room Administrator เปลี่ยนผลการอนุมัติหรือปฏิเสธการจองได้ โดยต้องระบุเหตุผลทุกครั้ง และทำได้เฉพาะก่อนถึงเวลาเริ่มประชุม
resource: ../requirements/REQ-mrr-002.md
tags: [mrr, policy]
id: BR-mrr-011@v1
status: draft
belongs_to: REQ-mrr-002
kind: policy
is_current: true
test_design: [state_transition, BVA]
proven_by: [EX-mrr-035, EX-mrr-036, EX-mrr-037, EX-mrr-038]
golden: []
provenance: [SRC-006, SRC-006]
timestamp: 2026-10-19T12:10:00+07:00
spec_hash: sha256:28ae14b899367d8fd88c858bc721ae8b37f86796038054945544898d699a7e1b
---

# BR-mrr-011@v1

## ข้อความของกฎ
Room Administrator เปลี่ยนผลการอนุมัติหรือปฏิเสธการจองได้ โดยต้องระบุเหตุผลทุกครั้ง และทำได้เฉพาะก่อนถึงเวลาเริ่มประชุม

## ที่มา

> "QB-rev-01: Room Administrator อนุมัติหรือปฏิเสธการจองผิดไปแล้ว ถอยผลได้ แต่ต้องระบุเหตุผล"
> — [SRC-006](../sources/SRC-006.md) หน้า — §—

> "QB-rev-02: ถอยผลการอนุมัติได้เฉพาะก่อนถึงเวลาเริ่มประชุม"
> — [SRC-006](../sources/SRC-006.md) หน้า — §—

## พิสูจน์โดย

- [EX-mrr-035](../examples/EX-mrr-035.md) — happy: การจองเปลี่ยนเป็นสถานะ 'ปฏิเสธแล้ว' และ Room Administrator เห็นข้อความ 'เปลี่ยนผลการอนุมัติสำเร็จ'
- [EX-mrr-036](../examples/EX-mrr-036.md) — exception: สถานะยังเป็น 'อนุมัติแล้ว' และแสดงข้อความ 'กรุณาระบุเหตุผล'
- [EX-mrr-037](../examples/EX-mrr-037.md) — boundary: การจองเปลี่ยนเป็นสถานะ 'อนุมัติแล้ว' และ Room Administrator เห็นข้อความ 'เปลี่ยนผลการอนุมัติสำเร็จ' — 1 นาทีก่อนเริ่มยังเปลี่ยนได้
- [EX-mrr-038](../examples/EX-mrr-038.md) — boundary: สถานะยังเป็น 'อนุมัติแล้ว' และแสดงข้อความ 'การประชุมเริ่มแล้ว ไม่สามารถเปลี่ยนผลการอนุมัติได้'

## ประวัติ

| เวอร์ชัน | มีผลตั้งแต่ | เหตุผล | change set |
|---|---|---|---|
| **BR-mrr-011@v1** (หน้านี้) ✅ | — | ตั้งต้น | — |
