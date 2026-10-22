---
type: Business Rule
title: ผู้ใช้ดูประวัติ แก้ไข หรือยกเลิกได้เฉพาะการจองของตนเอง
description: ผู้ใช้ดูประวัติ แก้ไข หรือยกเลิกได้เฉพาะการจองของตนเอง
resource: ../requirements/REQ-mrr-001.md
tags: [mrr, policy]
id: BR-mrr-003@v1
status: draft
belongs_to: REQ-mrr-001
kind: policy
is_current: true
test_design: [decision_table]
proven_by: [EX-mrr-008, EX-mrr-009, EX-mrr-010, EX-mrr-011]
golden: []
provenance: [SRC-001, SRC-004]
timestamp: 2026-10-22T10:00:00+07:00
spec_hash: sha256:6288be1ed643fd2a128f311ce35d01c3db84c8f874eff68e1b813a1d97975504
---

# BR-mrr-003@v1

## ข้อความของกฎ
ผู้ใช้ดูประวัติ แก้ไข หรือยกเลิกได้เฉพาะการจองของตนเอง

## ที่มา

> "จัดการการจองของฉัน (My Bookings): ผู้ใช้สามารถดูประวัติ, แก้ไขรายละเอียด, หรือยกเลิกการจองของตนเองได้"
> — [SRC-001](../sources/SRC-001.md) หน้า — §3.1

> "QB-perm-02: คนที่แก้ไขหรือยกเลิกการจองต้องเป็นผู้จองเท่านั้น"
> — [SRC-004](../sources/SRC-004.md) หน้า — §—

## พิสูจน์โดย

- [EX-mrr-008](../examples/EX-mrr-008.md) — happy: ระบบบันทึกการแก้ไข และแสดงข้อความ 'บันทึกการแก้ไขสำเร็จ'
- [EX-mrr-009](../examples/EX-mrr-009.md) — happy: ระบบยกเลิกการจอง และแสดงข้อความ 'ยกเลิกการจองสำเร็จ'
- [EX-mrr-010](../examples/EX-mrr-010.md) — exception: ระบบไม่ยกเลิก การจองคงเดิม และแสดงข้อความ 'เฉพาะผู้จองเท่านั้นที่แก้ไขหรือยกเลิกได้'
- [EX-mrr-011](../examples/EX-mrr-011.md) — alternate: รายการแสดงเฉพาะการจองห้อง A 10:00–11:00 ที่ U1 สร้างเอง ไม่แสดงการจองห้อง B ของ U2

## ประวัติ

| เวอร์ชัน | มีผลตั้งแต่ | เหตุผล | change set |
|---|---|---|---|
| **BR-mrr-003@v1** (หน้านี้) ✅ | — | ตั้งต้น | — |
