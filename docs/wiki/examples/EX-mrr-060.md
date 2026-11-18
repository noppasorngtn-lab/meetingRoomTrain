---
type: Example
title: exception — U1 ไม่เห็นร่องรอย และแสดงข้อความ 'เฉพาะผู้ดูแลห้องและผู้ดูแล
description: U1 ไม่เห็นร่องรอย และแสดงข้อความ 'เฉพาะผู้ดูแลห้องและผู้ดูแลระบบเท่านั้นที่ดูร่องรอยได้'
resource: ../rules/BR-mrr-018@v1.md
tags: [mrr, example, exception]
id: EX-mrr-060
status: validated
kind: exception
proves: [BR-mrr-018@v1]
has_ui: true
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:e6dd1c85ab745418247447e35f2533d51ce7d451806fcceae764ff332f17e0d0
---

# EX-mrr-060

## กำหนดให้ (given)
การจองห้อง A 18/10 10:00–11:00 ของ U1 ผู้เข้าร่วม U2 ถูก RA1 ยกเลิกแทนผู้จองเมื่อ 18/10 10:30 พร้อมเหตุผล 'ห้องต้องใช้จัดงานด่วน' · ผู้ใช้ล็อกอินเป็น U1 (ผู้จอง · General User)

## เมื่อ (when)
U1 ส่งคำขอดูร่องรอยของการจองนี้

## แล้ว (then)
U1 ไม่เห็นร่องรอย และแสดงข้อความ 'เฉพาะผู้ดูแลห้องและผู้ดูแลระบบเท่านั้นที่ดูร่องรอยได้'

## พิสูจน์กฎ

- [BR-mrr-018@v1](../rules/BR-mrr-018@v1.md) ✅ ปัจจุบัน — ร่องรอยการกระทำดูได้เฉพาะ Room Administrator และ System Administrator — ผู้จองดูไม่ได้
