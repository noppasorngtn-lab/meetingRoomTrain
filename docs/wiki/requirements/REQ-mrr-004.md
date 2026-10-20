---
type: Requirement
title: รายงานและสถิติการใช้ห้อง
description: ดูรายงานการใช้ห้องประชุมรายเดือน/รายปี และสถิติห้องที่มีอัตราการใช้งานสูงสุด เพื่อวางแผนทรัพยากร
resource: ../../requirements/REQ-mrr-004.md
tags: [mrr, requirement]
id: REQ-mrr-004
status: draft
actor: Room Administrator
rules: [BR-mrr-006, BR-mrr-015, BR-mrr-022]
domain_concepts: [UL-mrr-001, UL-mrr-008, UL-mrr-012]
timestamp: 2026-10-19T12:10:00+07:00
spec_hash: sha256:06e32d3b40e4bd6fa94c4fd7b8a3fa3bc7736ac16f794dc9e57f79716ad3db00
---

# REQ-mrr-004

## เป้าหมาย
ดูรายงานการใช้ห้องประชุมรายเดือน/รายปี และสถิติห้องที่มีอัตราการใช้งานสูงสุด เพื่อวางแผนทรัพยากร

**actor:** Room Administrator · **ความสำคัญ:** low · **มีหน้าจอ:** ใช่

## กฎที่ยังใช้อยู่

| กฎ | ชนิด | ข้อความ | ตัวอย่าง |
|---|---|---|---|
| [BR-mrr-006@v1](../rules/BR-mrr-006@v1.md) | calculation | อัตราการใช้งานรายห้อง = ชั่วโมงที่ถูกจองและใช้ได้จริง (ไม่ต้องอนุมัติ หรืออนุมัติแล้ว — ไม่นับยกเลิก / ปฏิเสธ / รออนุมัติ) ÷ ชั่วโมงทำการของห้องในช่วงรายงาน · ปัดทุกจุดแบบ round half up · ใช้จัดอันดับห้องที่ใช้งานสูงสุด | 4 |
| [BR-mrr-015@v1](../rules/BR-mrr-015@v1.md) | invariant | รายงานการใช้ห้องที่ออกไปแล้ว ถ้าข้อมูลการจองเปลี่ยนทีหลัง ต้องออกฉบับใหม่ทับ และเก็บฉบับเดิมไว้ — ห้ามแก้ฉบับที่ออกไปแล้ว | 3 |
| [BR-mrr-022@v1](../rules/BR-mrr-022@v1.md) | policy | รายงานและสถิติการใช้ห้องดูได้เฉพาะ Room Administrator | 3 |

## คำศัพท์ที่ผูกกับ requirement นี้

- [UL-mrr-001 · ห้องประชุม](../glossary/UL-mrr-001.md)
- [UL-mrr-008 · อัตราการใช้งาน](../glossary/UL-mrr-008.md)
- [UL-mrr-012 · ชั่วโมงทำการของห้อง](../glossary/UL-mrr-012.md)

## ฉบับที่คนอ่าน
[docs/requirements/REQ-mrr-004.md](../../requirements/REQ-mrr-004.md) — เนื้อความเต็มภาษาไทย
