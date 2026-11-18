---
type: Example
title: happy — ระบบแสดงข้อความ 'ลบห้องแล้ว' · ห้อง A เป็นสถานะ ARCHIVED ไม่
description: ระบบแสดงข้อความ 'ลบห้องแล้ว' · ห้อง A เป็นสถานะ ARCHIVED ไม่แสดงในการค้นหาและการจอง
resource: ../rules/BR-mrr-005@v1.md
tags: [mrr, example, happy]
id: EX-mrr-109
status: validated
kind: happy
proves: [BR-mrr-005@v1]
has_ui: true
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:04cbac1aec9c1a4bf7db01f1d6643758a2549ed3abad28b3b52e364d1cd75f68
---

# EX-mrr-109

## กำหนดให้ (given)
ผู้ใช้ล็อกอินเป็น Room Administrator และห้อง A ไม่มีการจอง

## เมื่อ (when)
Room Administrator ลบห้อง A

## แล้ว (then)
ระบบแสดงข้อความ 'ลบห้องแล้ว' · ห้อง A เป็นสถานะ ARCHIVED ไม่แสดงในการค้นหาและการจอง

## พิสูจน์กฎ

- [BR-mrr-005@v1](../rules/BR-mrr-005@v1.md) ✅ ปัจจุบัน — การเพิ่ม แก้ไข ปิดปรับปรุง หรือลบข้อมูลห้องประชุม ทำได้เฉพาะ Room Administrator
