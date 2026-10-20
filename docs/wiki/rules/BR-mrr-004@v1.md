---
type: Business Rule
title: การจองห้องที่ถูกตั้งไว้ว่า "ต้องอนุมัติ" จะใช้งานจริงได้ต่อเมื่อ Room Administra
description: การจองห้องที่ถูกตั้งไว้ว่า "ต้องอนุมัติ" จะใช้งานจริงได้ต่อเมื่อ Room Administrator อนุมัติแล้ว ห้องที่ไม่ได้ตั้งไว้ไม่ต้องรออนุมัติ
resource: ../requirements/REQ-mrr-002.md
tags: [mrr, policy]
id: BR-mrr-004@v1
status: draft
belongs_to: REQ-mrr-002
kind: policy
is_current: true
test_design: [state_transition, decision_table]
proven_by: [EX-mrr-012, EX-mrr-013, EX-mrr-014, EX-mrr-001]
golden: []
provenance: [SRC-001, SRC-004]
timestamp: 2026-10-19T12:10:00+07:00
spec_hash: sha256:5e57e93d88ac54d7fec11c7ca9c9c816806b8f78d97df8ea1dd69d043320e83c
---

# BR-mrr-004@v1

## ข้อความของกฎ
การจองห้องที่ถูกตั้งไว้ว่า "ต้องอนุมัติ" จะใช้งานจริงได้ต่อเมื่อ Room Administrator อนุมัติแล้ว ห้องที่ไม่ได้ตั้งไว้ไม่ต้องรออนุมัติ

## ที่มา

> "กำหนดได้ว่าห้องใดต้องได้รับการอนุมัติจากแอดมินก่อนใช้งานจริง"
> — [SRC-001](../sources/SRC-001.md) หน้า — §3.2

> ""แอดมิน" ที่อนุมัติการจองใน §3.2 คือ Room Administrator"
> — [SRC-004](../sources/SRC-004.md) หน้า — §—

## พิสูจน์โดย

- [EX-mrr-001](../examples/EX-mrr-001.md) — happy: ระบบรับการจอง และแสดงข้อความ 'จองห้องสำเร็จ' — จบ 10:00 กับเริ่ม 10:00 ไม่นับว่าทับ
- [EX-mrr-012](../examples/EX-mrr-012.md) — happy: การจองมีสถานะ 'รออนุมัติ' ยังใช้ห้องไม่ได้ และแสดงข้อความ 'ส่งคำขอจองแล้ว รอการอนุมัติ'
- [EX-mrr-013](../examples/EX-mrr-013.md) — happy: การจองเปลี่ยนเป็นสถานะ 'อนุมัติแล้ว' ใช้ห้องได้ และ Room Administrator เห็นข้อความ 'อนุมัติการจองสำเร็จ'
- [EX-mrr-014](../examples/EX-mrr-014.md) — exception: สถานะยังเป็น 'รออนุมัติ' และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่อนุมัติได้'

## ประวัติ

| เวอร์ชัน | มีผลตั้งแต่ | เหตุผล | change set |
|---|---|---|---|
| **BR-mrr-004@v1** (หน้านี้) ✅ | — | ตั้งต้น | — |
