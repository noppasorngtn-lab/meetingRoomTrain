---
type: Example
title: boundary — ระบบยกเลิกการจอง และแสดงข้อความ 'ยกเลิกการจองสำเร็จ'
description: ระบบยกเลิกการจอง และแสดงข้อความ 'ยกเลิกการจองสำเร็จ'
resource: ../rules/BR-mrr-009@v1.md
tags: [mrr, example, boundary]
id: EX-mrr-026
status: validated
kind: boundary
proves: [BR-mrr-009@v1]
has_ui: true
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:769ff4c6bb0c168d22adbcb97e09aefd910a881e6381438936a867a448aeb831
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
