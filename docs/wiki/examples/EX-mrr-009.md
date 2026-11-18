---
type: Example
title: happy — ระบบยกเลิกการจอง และแสดงข้อความ 'ยกเลิกการจองสำเร็จ'
description: ระบบยกเลิกการจอง และแสดงข้อความ 'ยกเลิกการจองสำเร็จ'
resource: ../rules/BR-mrr-003@v1.md
tags: [mrr, example, happy]
id: EX-mrr-009
status: validated
kind: happy
proves: [BR-mrr-003@v1]
has_ui: true
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:27b008eeca743b2bdbdb31b15eb4d21b306af55331455d0a5874293aed7d21b7
---

# EX-mrr-009

## กำหนดให้ (given)
U1 เป็นผู้จองห้อง A พรุ่งนี้ 10:00–11:00 (ยังไม่ถึงเวลาเริ่ม)

## เมื่อ (when)
U1 กดยกเลิกการจองนี้

## แล้ว (then)
ระบบยกเลิกการจอง และแสดงข้อความ 'ยกเลิกการจองสำเร็จ'

## พิสูจน์กฎ

- [BR-mrr-003@v1](../rules/BR-mrr-003@v1.md) ✅ ปัจจุบัน — ผู้ใช้ดูประวัติ แก้ไข หรือยกเลิกได้เฉพาะการจองของตนเอง
