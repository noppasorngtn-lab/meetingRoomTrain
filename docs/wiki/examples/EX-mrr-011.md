---
type: Example
title: alternate — รายการแสดงเฉพาะการจองห้อง A 10:00–11:00 ที่ U1 สร้างเอง ไม่แ
description: รายการแสดงเฉพาะการจองห้อง A 10:00–11:00 ที่ U1 สร้างเอง ไม่แสดงการจองห้อง B ของ U2
resource: ../rules/BR-mrr-003@v1.md
tags: [mrr, example, alternate]
id: EX-mrr-011
status: validated
kind: alternate
proves: [BR-mrr-003@v1]
has_ui: true
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:fd0d8a17dfca73665c7e260511066aeabec869ae66488c770a34b7c8b3d6a2c5
---

# EX-mrr-011

## กำหนดให้ (given)
U1 จองห้อง A พรุ่งนี้ 10:00–11:00 เอง และเป็นผู้เข้าร่วมในการจองห้อง B 13:00–14:00 ของ U2

## เมื่อ (when)
U1 เปิดหน้า My Bookings

## แล้ว (then)
รายการแสดงเฉพาะการจองห้อง A 10:00–11:00 ที่ U1 สร้างเอง ไม่แสดงการจองห้อง B ของ U2

## พิสูจน์กฎ

- [BR-mrr-003@v1](../rules/BR-mrr-003@v1.md) ✅ ปัจจุบัน — ผู้ใช้ดูประวัติ แก้ไข หรือยกเลิกได้เฉพาะการจองของตนเอง
