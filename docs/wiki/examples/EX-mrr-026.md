---
type: Example
title: boundary — ระบบยกเลิกการจอง และแสดงข้อความ 'ยกเลิกการจองสำเร็จ'
description: ระบบยกเลิกการจอง และแสดงข้อความ 'ยกเลิกการจองสำเร็จ'
resource: ../rules/BR-mrr-009@v1.md
tags: [mrr, example, boundary]
id: EX-mrr-026
status: draft
kind: boundary
proves: [BR-mrr-009@v1]
has_ui: true
timestamp: 2026-10-19T12:10:00+07:00
spec_hash: sha256:988020d957acde6804efef3ea0098c871a8c2c7abf850b5aff46c496f7f894aa
---

# EX-mrr-026

## กำหนดให้ (given)
U1 เป็นผู้จองห้อง A วันนี้ 10:00–11:00 และขณะนี้เวลา 09:59

## เมื่อ (when)
U1 กดยกเลิกการจองนี้

## แล้ว (then)
ระบบยกเลิกการจอง และแสดงข้อความ 'ยกเลิกการจองสำเร็จ'

## พิสูจน์กฎ

- [BR-mrr-009@v1](../rules/BR-mrr-009@v1.md) ✅ ปัจจุบัน — เมื่อถึงเวลาเริ่มประชุมแล้ว ผู้จองแก้ไขหรือยกเลิกการจองเองไม่ได้ — ต้องให้ Room Administrator เป็นผู้แก้ไขหรือยกเลิก โดยต้องระบุเหตุผลทุกครั้ง
