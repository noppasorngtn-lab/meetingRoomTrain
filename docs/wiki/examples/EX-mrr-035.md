---
type: Example
title: happy — การจองเปลี่ยนเป็นสถานะ 'ปฏิเสธแล้ว' และ Room Administrator เ
description: การจองเปลี่ยนเป็นสถานะ 'ปฏิเสธแล้ว' และ Room Administrator เห็นข้อความ 'เปลี่ยนผลการอนุมัติสำเร็จ'
resource: ../rules/BR-mrr-011@v1.md
tags: [mrr, example, happy]
id: EX-mrr-035
status: draft
kind: happy
proves: [BR-mrr-011@v1]
has_ui: true
timestamp: 2026-10-19T12:10:00+07:00
spec_hash: sha256:23b0a95741057333f069816277b91ee5f85d0ff6ab3e2a5e99e6509b15bf4981
---

# EX-mrr-035

## กำหนดให้ (given)
การจองห้อง B 18/10 10:00–11:00 ของ U1 มีสถานะ 'อนุมัติแล้ว' · ขณะนี้ 16/10 15:00 และผู้ใช้ล็อกอินเป็น Room Administrator

## เมื่อ (when)
Room Administrator เปลี่ยนผลเป็นปฏิเสธ พร้อมเหตุผล 'อนุมัติผิดห้อง'

## แล้ว (then)
การจองเปลี่ยนเป็นสถานะ 'ปฏิเสธแล้ว' และ Room Administrator เห็นข้อความ 'เปลี่ยนผลการอนุมัติสำเร็จ'

## พิสูจน์กฎ

- [BR-mrr-011@v1](../rules/BR-mrr-011@v1.md) ✅ ปัจจุบัน — Room Administrator เปลี่ยนผลการอนุมัติหรือปฏิเสธการจองได้ โดยต้องระบุเหตุผลทุกครั้ง และทำได้เฉพาะก่อนถึงเวลาเริ่มประชุม
