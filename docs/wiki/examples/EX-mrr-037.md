---
type: Example
title: boundary — การจองเปลี่ยนเป็นสถานะ 'อนุมัติแล้ว' และ Room Administrator 
description: การจองเปลี่ยนเป็นสถานะ 'อนุมัติแล้ว' และ Room Administrator เห็นข้อความ 'เปลี่ยนผลการอนุมัติสำเร็จ' — 1 นาทีก่อนเริ่มยังเปลี่ยนได้
resource: ../rules/BR-mrr-011@v1.md
tags: [mrr, example, boundary]
id: EX-mrr-037
status: draft
kind: boundary
proves: [BR-mrr-011@v1]
has_ui: true
timestamp: 2026-10-19T12:10:00+07:00
spec_hash: sha256:0fb1ec8faff22e60c3f986238368c012a2c49541e3a38c528923077e844ee704
---

# EX-mrr-037

## กำหนดให้ (given)
การจองห้อง B 18/10 10:00–11:00 ของ U1 มีสถานะ 'ปฏิเสธแล้ว' ห้อง B ช่วงนั้นยังไม่มีการจองอื่น · ขณะนี้ 18/10 09:59 และผู้ใช้ล็อกอินเป็น Room Administrator

## เมื่อ (when)
Room Administrator เปลี่ยนผลเป็นอนุมัติ พร้อมเหตุผล 'ปฏิเสธผิดคน'

## แล้ว (then)
การจองเปลี่ยนเป็นสถานะ 'อนุมัติแล้ว' และ Room Administrator เห็นข้อความ 'เปลี่ยนผลการอนุมัติสำเร็จ' — 1 นาทีก่อนเริ่มยังเปลี่ยนได้

## พิสูจน์กฎ

- [BR-mrr-011@v1](../rules/BR-mrr-011@v1.md) ✅ ปัจจุบัน — Room Administrator เปลี่ยนผลการอนุมัติหรือปฏิเสธการจองได้ โดยต้องระบุเหตุผลทุกครั้ง และทำได้เฉพาะก่อนถึงเวลาเริ่มประชุม
