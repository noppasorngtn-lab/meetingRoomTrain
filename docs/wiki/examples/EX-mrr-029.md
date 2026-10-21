---
type: Example
title: exception — การจองคงเดิม และแสดงข้อความ 'กรุณาระบุเหตุผล'
description: การจองคงเดิม และแสดงข้อความ 'กรุณาระบุเหตุผล'
resource: ../rules/BR-mrr-009@v1.md
tags: [mrr, example, exception]
id: EX-mrr-029
status: draft
kind: exception
proves: [BR-mrr-009@v1]
has_ui: true
timestamp: 2026-10-19T12:10:00+07:00
spec_hash: sha256:8b8ab758afcfb6bf6c9a2941deed9f895f8007bbe3c66a79993cc3145dc50810
---

# EX-mrr-029

## กำหนดให้ (given)
U1 เป็นผู้จองห้อง A วันนี้ 10:00–11:00 ขณะนี้เวลา 10:30 และผู้ใช้ล็อกอินเป็น Room Administrator

## เมื่อ (when)
Room Administrator ยกเลิกการจองนี้แทน U1 โดยเว้นช่องเหตุผลว่าง

## แล้ว (then)
การจองคงเดิม และแสดงข้อความ 'กรุณาระบุเหตุผล'

## พิสูจน์กฎ

- [BR-mrr-009@v1](../rules/BR-mrr-009@v1.md) ✅ ปัจจุบัน — เมื่อถึงเวลาเริ่มประชุมแล้ว ผู้จองแก้ไขหรือยกเลิกการจองเองไม่ได้ — ต้องให้ Room Administrator เป็นผู้แก้ไขหรือยกเลิก โดยต้องระบุเหตุผลทุกครั้ง
