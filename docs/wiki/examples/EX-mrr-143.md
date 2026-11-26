---
type: Example
title: exception — สถานะยังเป็น 'รออนุมัติ' และ Room Administrator เห็นข้อความ 
description: สถานะยังเป็น 'รออนุมัติ' และ Room Administrator เห็นข้อความ 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง'
resource: ../rules/BR-mrr-019@v1.md
tags: [mrr, example, exception]
id: EX-mrr-143
status: validated
kind: exception
proves: [BR-mrr-019@v1]
has_ui: true
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:09e34e2bee8950b5a81597ff6653af799294a6bfd3824551b25404431721813a
---

# EX-mrr-143

## กำหนดให้ (given)
การจองห้อง B 17/10 10:00–11:00 หัวข้อ 'ประชุมทีม' ของ U1 ผู้เข้าร่วม U2 และ U3 สถานะ 'รออนุมัติ' ผู้ใช้ล็อกอินเป็น Room Administrator · mail server ปฏิเสธ Email ถึง U3 เท่านั้น (ผู้รับคนอื่นรับได้)

## เมื่อ (when)
Room Administrator ปฏิเสธการจองนี้พร้อมเหตุผล 'ห้องไม่เหมาะกับการประชุมนี้'

## แล้ว (then)
สถานะยังเป็น 'รออนุมัติ' และ Room Administrator เห็นข้อความ 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง'

## พิสูจน์กฎ

- [BR-mrr-019@v1](../rules/BR-mrr-019@v1.md) ✅ ปัจจุบัน — ถ้าส่ง Email แจ้งเตือนไม่สำเร็จ การกระทำของผู้ใช้ที่ทำให้เกิดแจ้งเตือนนั้นล้มทันที และแจ้งผู้ใช้ให้กดใหม่ — ไม่มีคิวส่งซ้ำ
