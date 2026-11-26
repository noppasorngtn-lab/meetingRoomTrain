---
type: Example
title: exception — การจองยังอยู่ สถานะเดิม และ Room Administrator เห็นข้อความ '
description: การจองยังอยู่ สถานะเดิม และ Room Administrator เห็นข้อความ 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง'
resource: ../rules/BR-mrr-019@v1.md
tags: [mrr, example, exception]
id: EX-mrr-142
status: validated
kind: exception
proves: [BR-mrr-019@v1]
has_ui: true
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:9003b91a3c2796e45ab47c342848c2f4916f1854e22c869c5ad48c0f6ae7c7ce
---

# EX-mrr-142

## กำหนดให้ (given)
การจองห้อง A 17/10 10:00–11:00 หัวข้อ 'ประชุมทีม' ของ U1 ผู้เข้าร่วม U2 และ U3 ขณะนี้เวลา 10:30 และผู้ใช้ล็อกอินเป็น Room Administrator · mail server ปฏิเสธ Email ถึง U3 เท่านั้น (ผู้รับคนอื่นรับได้)

## เมื่อ (when)
Room Administrator ยกเลิกการจองนี้แทน U1 พร้อมเหตุผล 'ห้องต้องใช้จัดงานด่วน'

## แล้ว (then)
การจองยังอยู่ สถานะเดิม และ Room Administrator เห็นข้อความ 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง'

## พิสูจน์กฎ

- [BR-mrr-019@v1](../rules/BR-mrr-019@v1.md) ✅ ปัจจุบัน — ถ้าส่ง Email แจ้งเตือนไม่สำเร็จ การกระทำของผู้ใช้ที่ทำให้เกิดแจ้งเตือนนั้นล้มทันที และแจ้งผู้ใช้ให้กดใหม่ — ไม่มีคิวส่งซ้ำ
