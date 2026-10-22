---
type: Business Rule
title: แต่ละห้องที่ต้องอนุมัติกำหนดผู้อนุมัติประจำห้อง (Room Administrator) ได้ — ถ้ายั
description: แต่ละห้องที่ต้องอนุมัติกำหนดผู้อนุมัติประจำห้อง (Room Administrator) ได้ — ถ้ายังไม่กำหนด Room Administrator ทุกคนอนุมัติได้ และกำหนดทีหลังได้
resource: ../requirements/REQ-mrr-002.md
tags: [mrr, policy]
id: BR-mrr-013@v1
status: draft
belongs_to: REQ-mrr-002
kind: policy
is_current: true
test_design: [decision_table]
proven_by: [EX-mrr-039, EX-mrr-040, EX-mrr-041, EX-mrr-042]
golden: []
provenance: [SRC-007, SRC-007]
timestamp: 2026-10-22T10:00:00+07:00
spec_hash: sha256:c7cfac7fe9f43048465560a7d7ad1fcc3f642e98f16f8b346920d92e85278f42
---

# BR-mrr-013@v1

## ข้อความของกฎ
แต่ละห้องที่ต้องอนุมัติกำหนดผู้อนุมัติประจำห้อง (Room Administrator) ได้ — ถ้ายังไม่กำหนด Room Administrator ทุกคนอนุมัติได้ และกำหนดทีหลังได้

## ที่มา

> "QB-apr-01: แต่ละห้องกำหนด Room Administrator ที่เป็นผู้อนุมัติได้ — เป็นกฎคนละข้อกับ BR-mrr-004"
> — [SRC-007](../sources/SRC-007.md) หน้า — §—

> "QB-apr-02: ห้องที่ต้องอนุมัติแต่ยังไม่กำหนดผู้อนุมัติ ใช้ค่าเริ่มต้นคือ Room Administrator ทุกคนอนุมัติได้ และกำหนดทีหลังได้"
> — [SRC-007](../sources/SRC-007.md) หน้า — §—

## พิสูจน์โดย

- [EX-mrr-039](../examples/EX-mrr-039.md) — happy: การจองเปลี่ยนเป็นสถานะ 'อนุมัติแล้ว' และ RA1 เห็นข้อความ 'อนุมัติการจองสำเร็จ'
- [EX-mrr-040](../examples/EX-mrr-040.md) — exception: สถานะยังเป็น 'รออนุมัติ' และแสดงข้อความ 'เฉพาะผู้อนุมัติประจำห้องนี้เท่านั้นที่อนุมัติได้'
- [EX-mrr-041](../examples/EX-mrr-041.md) — alternate: การจองเปลี่ยนเป็นสถานะ 'อนุมัติแล้ว' และ RA2 เห็นข้อความ 'อนุมัติการจองสำเร็จ' — ห้องที่ยังไม่กำหนด Room Administrator ทุกคนอนุมัติได้
- [EX-mrr-042](../examples/EX-mrr-042.md) — happy: ผู้อนุมัติประจำห้อง B เป็น RA1 และแสดงข้อความ 'บันทึกข้อมูลห้องสำเร็จ' — กำหนดทีหลังได้

## ประวัติ

| เวอร์ชัน | มีผลตั้งแต่ | เหตุผล | change set |
|---|---|---|---|
| **BR-mrr-013@v1** (หน้านี้) ✅ | — | ตั้งต้น | — |
