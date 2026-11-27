---
type: Example
title: exception — แสดงข้อความ 'คุณไม่มีสิทธิ์เข้าหน้านี้' และไม่เห็นรายการสิ่ง
description: แสดงข้อความ 'คุณไม่มีสิทธิ์เข้าหน้านี้' และไม่เห็นรายการสิ่งอำนวยความสะดวก
resource: ../rules/BR-mrr-005@v1.md
tags: [mrr, example, exception]
id: EX-mrr-090
status: validated
kind: exception
proves: [BR-mrr-005@v1]
has_ui: true
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:4db21791e6662e43db096597bba07887653a52341adac884bc901a5720a9fb8c
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
