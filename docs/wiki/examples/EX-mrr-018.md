---
type: Example
title: exception — ความจุห้อง A ยังเป็น 8 คน และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท
description: ความจุห้อง A ยังเป็น 8 คน และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้'
resource: ../rules/BR-mrr-005@v1.md
tags: [mrr, example, exception]
id: EX-mrr-018
status: draft
kind: exception
proves: [BR-mrr-005@v1]
has_ui: true
timestamp: 2026-10-19T12:10:00+07:00
spec_hash: sha256:2397a39706bb42b44f12e4467a10e37edd1e036cf0ed90478b885cb3dab78286
---

# EX-mrr-018

## กำหนดให้ (given)
ห้อง A ความจุ 8 คน และผู้ใช้ล็อกอินเป็น System Administrator

## เมื่อ (when)
System Administrator ส่งคำสั่งแก้ความจุห้อง A เป็น 12 คน

## แล้ว (then)
ความจุห้อง A ยังเป็น 8 คน และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้'

## พิสูจน์กฎ

- [BR-mrr-005@v1](../rules/BR-mrr-005@v1.md) ✅ ปัจจุบัน — การเพิ่ม แก้ไข ปิดปรับปรุง หรือลบข้อมูลห้องประชุม ทำได้เฉพาะ Room Administrator
