---
type: Example
title: happy — ระบบแสดงข้อความ 'ลบห้องแล้ว' · ห้อง A เป็นสถานะ ARCHIVED ไม่
description: ระบบแสดงข้อความ 'ลบห้องแล้ว' · ห้อง A เป็นสถานะ ARCHIVED ไม่แสดงในการค้นหาและการจอง
resource: ../rules/BR-mrr-005@v1.md
tags: [mrr, example, happy]
id: EX-mrr-109
status: draft
kind: happy
proves: [BR-mrr-005@v1]
has_ui: true
timestamp: 2026-10-22T10:30:00+07:00
spec_hash: sha256:1e4db3e38991d76d066214a052bd99794960c47a5acb4d113e9428fc1d72c50e
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
