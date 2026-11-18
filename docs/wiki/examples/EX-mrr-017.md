---
type: Example
title: exception — ความจุห้อง A ยังเป็น 8 คน และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท
description: ความจุห้อง A ยังเป็น 8 คน และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้'
resource: ../rules/BR-mrr-005@v1.md
tags: [mrr, example, exception]
id: EX-mrr-017
status: validated
kind: exception
proves: [BR-mrr-005@v1]
has_ui: true
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:86ea32be4ec79561be32caa7e251af0927b51c42bf16d7ffced934c1423aaece
---

# EX-mrr-017

## กำหนดให้ (given)
ห้อง A ความจุ 8 คน และผู้ใช้ล็อกอินเป็น General User

## เมื่อ (when)
General User ส่งคำสั่งแก้ความจุห้อง A เป็น 12 คน

## แล้ว (then)
ความจุห้อง A ยังเป็น 8 คน และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้'

## พิสูจน์กฎ

- [BR-mrr-005@v1](../rules/BR-mrr-005@v1.md) ✅ ปัจจุบัน — การเพิ่ม แก้ไข ปิดปรับปรุง หรือลบข้อมูลห้องประชุม ทำได้เฉพาะ Room Administrator
