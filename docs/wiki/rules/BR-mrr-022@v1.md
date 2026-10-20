---
type: Business Rule
title: รายงานและสถิติการใช้ห้องดูได้เฉพาะ Room Administrator
description: รายงานและสถิติการใช้ห้องดูได้เฉพาะ Room Administrator
resource: ../requirements/REQ-mrr-004.md
tags: [mrr, policy]
id: BR-mrr-022@v1
status: draft
belongs_to: REQ-mrr-004
kind: policy
is_current: true
test_design: [decision_table]
proven_by: [EX-mrr-072, EX-mrr-073, EX-mrr-074]
golden: []
provenance: [SRC-013]
timestamp: 2026-10-19T12:10:00+07:00
spec_hash: sha256:d745e1f6356ab92d751fa63505ba6b599b67dfa939b47edd34f6c93c031b195b
---

# BR-mrr-022@v1

## ข้อความของกฎ
รายงานและสถิติการใช้ห้องดูได้เฉพาะ Room Administrator

## ที่มา

> "รายงานและสถิติการใช้ห้องดูได้เฉพาะ Room Administrator"
> — [SRC-013](../sources/SRC-013.md) หน้า — §—

## พิสูจน์โดย

- [EX-mrr-072](../examples/EX-mrr-072.md) — happy: เห็นรายงานเดือน ต.ค. 2569 พร้อมอันดับห้องที่มีอัตราการใช้งานสูงสุด
- [EX-mrr-073](../examples/EX-mrr-073.md) — exception: System Administrator ไม่เห็นรายงานและสถิติ และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้'
- [EX-mrr-074](../examples/EX-mrr-074.md) — exception: U1 ไม่เห็นรายงานและสถิติ และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้'

## ประวัติ

| เวอร์ชัน | มีผลตั้งแต่ | เหตุผล | change set |
|---|---|---|---|
| **BR-mrr-022@v1** (หน้านี้) ✅ | — | ตั้งต้น | — |
