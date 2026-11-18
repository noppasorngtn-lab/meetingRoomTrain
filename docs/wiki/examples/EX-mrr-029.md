---
type: Example
title: exception — การจองคงเดิม และแสดงข้อความ 'กรุณาระบุเหตุผล'
description: การจองคงเดิม และแสดงข้อความ 'กรุณาระบุเหตุผล'
resource: ../rules/BR-mrr-009@v1.md
tags: [mrr, example, exception]
id: EX-mrr-029
status: validated
kind: exception
proves: [BR-mrr-009@v1]
has_ui: true
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:41103427ba253b541506369dc852aff869406e936e9f9eb837398af4676430f0
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
