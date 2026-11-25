---
type: Example
title: exception — สถานะยังเป็น 'รออนุมัติ' และ Room Administrator เห็นข้อความ 
description: สถานะยังเป็น 'รออนุมัติ' และ Room Administrator เห็นข้อความ 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง'
resource: ../rules/BR-mrr-019@v1.md
tags: [mrr, example, exception]
id: EX-mrr-064
status: validated
kind: exception
proves: [BR-mrr-019@v1]
has_ui: true
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:c31f18339af774b080a9599c6cc29c4f365aee7a0d0f1cc76068105a94d6bf05
---

# EX-mrr-064

## กำหนดให้ (given)
การจองห้อง B 17/10 10:00–11:00 ของ U1 สถานะ 'รออนุมัติ' ผู้ใช้ล็อกอินเป็น Room Administrator · ระบบ Email ส่งไม่สำเร็จ (mail server ล่ม)

## เมื่อ (when)
Room Administrator กดอนุมัติการจองนี้

## แล้ว (then)
สถานะยังเป็น 'รออนุมัติ' และ Room Administrator เห็นข้อความ 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง'

## พิสูจน์กฎ

- [BR-mrr-019@v1](../rules/BR-mrr-019@v1.md) ✅ ปัจจุบัน — ถ้าส่ง Email แจ้งเตือนไม่สำเร็จ การกระทำของผู้ใช้ที่ทำให้เกิดแจ้งเตือนนั้นล้มทันที และแจ้งผู้ใช้ให้กดใหม่ — ไม่มีคิวส่งซ้ำ
