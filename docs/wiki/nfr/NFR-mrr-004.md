---
type: NFR
title: เปิดให้บริการตลอด 24 ชั่วโมง (Uptime 99.9%) วัดรายเดือนจาก log ของระบบ ไม่นับช่ว
description: เปิดให้บริการตลอด 24 ชั่วโมง (Uptime 99.9%) วัดรายเดือนจาก log ของระบบ ไม่นับช่วงบำรุงรักษาตามแผนเป็น downtime · ปิดบำรุงรักษาตามแผนต้องแจ้งล่วงหน้า 7 วันทำการ (แจ้งน้อยกว่านั้นก็ยังไม่นับเป็น downtime) (ค่าวัด: SRC-034, SRC-037)
resource: ../requirements/REQ-mrr-001.md
tags: [mrr, nfr, availability]
id: NFR-mrr-004
kind: availability
belongs_to: REQ-mrr-001
verified_by: log_analysis
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:dcc277187bacb6fbb584d9ec9f217c048be65b9be4037aef6a70136d57e70c28
---

# NFR-mrr-004

## ข้อกำหนด
เปิดให้บริการตลอด 24 ชั่วโมง (Uptime 99.9%) วัดรายเดือนจาก log ของระบบ ไม่นับช่วงบำรุงรักษาตามแผนเป็น downtime · ปิดบำรุงรักษาตามแผนต้องแจ้งล่วงหน้า 7 วันทำการ (แจ้งน้อยกว่านั้นก็ยังไม่นับเป็น downtime) (ค่าวัด: SRC-034, SRC-037)

| เรื่อง | ค่า |
|---|---|
| ชนิด | availability |
| พิสูจน์ด้วย | log_analysis |
| อยู่ใต้ | [REQ-mrr-001](../requirements/REQ-mrr-001.md) |
