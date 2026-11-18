---
type: Example
title: happy — ระบบสร้างห้อง C และแสดงข้อความ 'บันทึกข้อมูลห้องสำเร็จ'
description: ระบบสร้างห้อง C และแสดงข้อความ 'บันทึกข้อมูลห้องสำเร็จ'
resource: ../rules/BR-mrr-005@v1.md
tags: [mrr, example, happy]
id: EX-mrr-015
status: validated
kind: happy
proves: [BR-mrr-005@v1]
has_ui: true
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:736a3dafc6dab2d6ece791bb6f2c0a5b6d58889ed407d4c9ff038ab66c844036
---

# EX-mrr-015

## กำหนดให้ (given)
ผู้ใช้ล็อกอินเป็น Room Administrator และยังไม่มีห้อง C ในระบบ

## เมื่อ (when)
Room Administrator เพิ่มห้อง C ความจุ 10 คน แล้วกดบันทึก

## แล้ว (then)
ระบบสร้างห้อง C และแสดงข้อความ 'บันทึกข้อมูลห้องสำเร็จ'

## พิสูจน์กฎ

- [BR-mrr-005@v1](../rules/BR-mrr-005@v1.md) ✅ ปัจจุบัน — การเพิ่ม แก้ไข ปิดปรับปรุง หรือลบข้อมูลห้องประชุม ทำได้เฉพาะ Room Administrator
