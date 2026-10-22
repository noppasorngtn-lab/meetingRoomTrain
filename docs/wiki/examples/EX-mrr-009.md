---
type: Example
title: happy — ระบบยกเลิกการจอง และแสดงข้อความ 'ยกเลิกการจองสำเร็จ'
description: ระบบยกเลิกการจอง และแสดงข้อความ 'ยกเลิกการจองสำเร็จ'
resource: ../rules/BR-mrr-003@v1.md
tags: [mrr, example, happy]
id: EX-mrr-009
status: draft
kind: happy
proves: [BR-mrr-003@v1]
has_ui: true
timestamp: 2026-10-22T10:00:00+07:00
spec_hash: sha256:a3192a57eeca8cc22287c7a105bfc775cb94db54f16e2671d92d236db9c7e26a
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
