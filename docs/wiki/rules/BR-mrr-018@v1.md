---
type: Business Rule
title: ร่องรอยการกระทำดูได้เฉพาะ Room Administrator และ System Administrator — ผู้จองดู
description: ร่องรอยการกระทำดูได้เฉพาะ Room Administrator และ System Administrator — ผู้จองดูไม่ได้
resource: ../requirements/REQ-mrr-002.md
tags: [mrr, policy]
id: BR-mrr-018@v1
status: draft
belongs_to: REQ-mrr-002
kind: policy
is_current: true
test_design: [decision_table]
proven_by: [EX-mrr-058, EX-mrr-059, EX-mrr-060, EX-mrr-061]
golden: []
provenance: [SRC-009, SRC-009]
timestamp: 2026-10-22T10:30:00+07:00
spec_hash: sha256:aa359ba8d03ef68767b775d24b67d38dc1bff14738fb467b5ff886fb6922a706
---

# BR-mrr-018@v1

## ข้อความของกฎ
ร่องรอยการกระทำดูได้เฉพาะ Room Administrator และ System Administrator — ผู้จองดูไม่ได้

## ที่มา

> "ร่องรอยดูได้โดย Room Administrator และ System Administrator — ผู้จองดูไม่ได้"
> — [SRC-009](../sources/SRC-009.md) หน้า — §—

> "กฎร่องรอยวางไว้ใต้ REQ-mrr-002"
> — [SRC-009](../sources/SRC-009.md) หน้า — §—

## พิสูจน์โดย

- [EX-mrr-058](../examples/EX-mrr-058.md) — happy: RA2 เห็นร่องรอย 1 รายการ: ผู้ทำ RA1 · เวลา 18/10 10:30 · การกระทำ 'ยกเลิกแทนผู้จอง' · เหตุผล 'ห้องต้องใช้จัดงานด่วน'
- [EX-mrr-059](../examples/EX-mrr-059.md) — happy: System Administrator เห็นร่องรอย 1 รายการ: ผู้ทำ RA1 · เวลา 18/10 10:30 · การกระทำ 'ยกเลิกแทนผู้จอง' · เหตุผล 'ห้องต้องใช้จัดงานด่วน'
- [EX-mrr-060](../examples/EX-mrr-060.md) — exception: U1 ไม่เห็นร่องรอย และแสดงข้อความ 'เฉพาะผู้ดูแลห้องและผู้ดูแลระบบเท่านั้นที่ดูร่องรอยได้'
- [EX-mrr-061](../examples/EX-mrr-061.md) — exception: U2 ไม่เห็นร่องรอย และแสดงข้อความ 'เฉพาะผู้ดูแลห้องและผู้ดูแลระบบเท่านั้นที่ดูร่องรอยได้'

## ประวัติ

| เวอร์ชัน | มีผลตั้งแต่ | เหตุผล | change set |
|---|---|---|---|
| **BR-mrr-018@v1** (หน้านี้) ✅ | — | ตั้งต้น | — |
