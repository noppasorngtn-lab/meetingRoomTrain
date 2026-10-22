---
type: Example
title: happy — System Administrator เห็นร่องรอย 1 รายการ: ผู้ทำ RA1 · เวลา 
description: System Administrator เห็นร่องรอย 1 รายการ: ผู้ทำ RA1 · เวลา 18/10 10:30 · การกระทำ 'ยกเลิกแทนผู้จอง' · เหตุผล 'ห้องต้องใช้จัดงานด่วน'
resource: ../rules/BR-mrr-018@v1.md
tags: [mrr, example, happy]
id: EX-mrr-059
status: draft
kind: happy
proves: [BR-mrr-018@v1]
has_ui: true
timestamp: 2026-10-22T10:00:00+07:00
spec_hash: sha256:7a31bdc41cbc6ff64565063645755de77a200f659d777767c741d6b4e452ff3b
---

# EX-mrr-059

## กำหนดให้ (given)
การจองห้อง A 18/10 10:00–11:00 ของ U1 ผู้เข้าร่วม U2 ถูก RA1 ยกเลิกแทนผู้จองเมื่อ 18/10 10:30 พร้อมเหตุผล 'ห้องต้องใช้จัดงานด่วน' · ผู้ใช้ล็อกอินเป็น System Administrator

## เมื่อ (when)
System Administrator เปิดดูร่องรอยของการจองนี้

## แล้ว (then)
System Administrator เห็นร่องรอย 1 รายการ: ผู้ทำ RA1 · เวลา 18/10 10:30 · การกระทำ 'ยกเลิกแทนผู้จอง' · เหตุผล 'ห้องต้องใช้จัดงานด่วน'

## พิสูจน์กฎ

- [BR-mrr-018@v1](../rules/BR-mrr-018@v1.md) ✅ ปัจจุบัน — ร่องรอยการกระทำดูได้เฉพาะ Room Administrator และ System Administrator — ผู้จองดูไม่ได้
