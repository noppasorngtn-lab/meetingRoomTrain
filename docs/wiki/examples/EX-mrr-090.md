---
type: Example
title: exception — แสดงข้อความ 'คุณไม่มีสิทธิ์เข้าหน้านี้' และไม่เห็นรายการสิ่ง
description: แสดงข้อความ 'คุณไม่มีสิทธิ์เข้าหน้านี้' และไม่เห็นรายการสิ่งอำนวยความสะดวก
resource: ../rules/BR-mrr-005@v1.md
tags: [mrr, example, exception]
id: EX-mrr-090
status: draft
kind: exception
proves: [BR-mrr-005@v1]
has_ui: true
timestamp: 2026-10-22T10:30:00+07:00
spec_hash: sha256:6e8026c333ca9b63a0839e97b9e3a0f52a13aef7b2381a6c270d737bc0f97a2e
---

# EX-mrr-090

## กำหนดให้ (given)
ผู้ใช้ล็อกอินเป็น General User

## เมื่อ (when)
General User เปิดหน้าสิ่งอำนวยความสะดวก

## แล้ว (then)
แสดงข้อความ 'คุณไม่มีสิทธิ์เข้าหน้านี้' และไม่เห็นรายการสิ่งอำนวยความสะดวก

## พิสูจน์กฎ

- [BR-mrr-005@v1](../rules/BR-mrr-005@v1.md) ✅ ปัจจุบัน — การเพิ่ม แก้ไข ปิดปรับปรุง หรือลบข้อมูลห้องประชุม ทำได้เฉพาะ Room Administrator
