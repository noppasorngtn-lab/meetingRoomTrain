---
type: Example
title: exception — ระบบไม่ลบห้อง และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่จัด
description: ระบบไม่ลบห้อง และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้' · ห้อง A ไม่เปลี่ยน
resource: ../rules/BR-mrr-005@v1.md
tags: [mrr, example, exception]
id: EX-mrr-110
status: draft
kind: exception
proves: [BR-mrr-005@v1]
has_ui: true
timestamp: 2026-10-22T10:30:00+07:00
spec_hash: sha256:448735ee075c723098b726bfed7ef302e595e8fa4d419f09f69ffdcbb291dd0c
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
