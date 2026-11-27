---
type: Example
title: exception — ระบบไม่ลบห้อง และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่จัด
description: ระบบไม่ลบห้อง และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้' · ห้อง A ไม่เปลี่ยน
resource: ../rules/BR-mrr-005@v1.md
tags: [mrr, example, exception]
id: EX-mrr-110
status: validated
kind: exception
proves: [BR-mrr-005@v1]
has_ui: true
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:5c39d2172731e4189daf7763cd301e4f835420e7d6e04c81798c16f941cb2f48
---

# EX-mrr-110

## กำหนดให้ (given)
ผู้ใช้ล็อกอินเป็นผู้ใช้ทั่วไป (ไม่ใช่ Room Administrator)

## เมื่อ (when)
ผู้ใช้พยายามลบห้อง A

## แล้ว (then)
ระบบไม่ลบห้อง และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้' · ห้อง A ไม่เปลี่ยน

## พิสูจน์กฎ

- [BR-mrr-005@v1](../rules/BR-mrr-005@v1.md) ✅ ปัจจุบัน — การเพิ่ม แก้ไข ปิดปรับปรุง หรือลบข้อมูลห้องประชุม ทำได้เฉพาะ Room Administrator
