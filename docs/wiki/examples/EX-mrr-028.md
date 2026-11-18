---
type: Example
title: happy — ระบบยกเลิกการจอง และ Room Administrator เห็นข้อความ 'ยกเลิกก
description: ระบบยกเลิกการจอง และ Room Administrator เห็นข้อความ 'ยกเลิกการจองสำเร็จ'
resource: ../rules/BR-mrr-009@v1.md
tags: [mrr, example, happy]
id: EX-mrr-028
status: validated
kind: happy
proves: [BR-mrr-009@v1]
has_ui: true
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:ddbacab2d9ed41fe7b5e583d1631dc15aa8f06d422669d707d1065595f7e324c
---

# EX-mrr-028

## กำหนดให้ (given)
U1 เป็นผู้จองห้อง A วันนี้ 10:00–11:00 ขณะนี้เวลา 10:30 และผู้ใช้ล็อกอินเป็น Room Administrator

## เมื่อ (when)
Room Administrator ยกเลิกการจองนี้แทน U1 พร้อมเหตุผล 'ห้องต้องใช้จัดงานด่วน'

## แล้ว (then)
ระบบยกเลิกการจอง และ Room Administrator เห็นข้อความ 'ยกเลิกการจองสำเร็จ'

## พิสูจน์กฎ

- [BR-mrr-009@v1](../rules/BR-mrr-009@v1.md) ✅ ปัจจุบัน — เมื่อถึงเวลาเริ่มประชุมแล้ว ผู้จองแก้ไขหรือยกเลิกการจองเองไม่ได้ — ต้องให้ Room Administrator เป็นผู้แก้ไขหรือยกเลิก โดยต้องระบุเหตุผลทุกครั้ง
