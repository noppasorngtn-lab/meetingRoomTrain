---
type: Example
title: exception — แสดงข้อความ 'ส่งรหัสไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' · U1 ไม่
description: แสดงข้อความ 'ส่งรหัสไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' · U1 ไม่ได้รับ Email และยังเข้าสู่ระบบไม่ได้
resource: ../rules/BR-mrr-024@v1.md
tags: [mrr, example, exception]
id: EX-mrr-092
status: validated
kind: exception
proves: [BR-mrr-024@v1]
has_ui: true
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:7a7fa779141a9e6b0b3ac0b2a76074d41ccd5a483c6dd92ab9caacad828d0882
---

# EX-mrr-092

## กำหนดให้ (given)
U1 เป็นพนักงานในรายชื่อนำเข้าจาก HR บัญชี active · ระบบ Email ส่งไม่สำเร็จ (mail server ล่ม)

## เมื่อ (when)
U1 กรอก Email องค์กรของตน แล้วกด 'ขอรหัสเข้าสู่ระบบ' ตอน 10:00

## แล้ว (then)
แสดงข้อความ 'ส่งรหัสไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' · U1 ไม่ได้รับ Email และยังเข้าสู่ระบบไม่ได้

## พิสูจน์กฎ

- [BR-mrr-024@v1](../rules/BR-mrr-024@v1.md) ✅ ปัจจุบัน — ถ้าส่ง Email รหัสเข้าสู่ระบบไม่สำเร็จ การขอรหัสครั้งนั้นล้มทันที และแจ้งผู้ใช้ให้กดขอรหัสใหม่เอง — ไม่มีคิวส่งซ้ำ
