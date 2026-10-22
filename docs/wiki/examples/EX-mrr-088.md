---
type: Example
title: exception — System Administrator เห็นข้อมูลการจองและร่องรอย แต่ไม่เห็นช่
description: System Administrator เห็นข้อมูลการจองและร่องรอย แต่ไม่เห็นช่องเหตุผล ไม่เห็นปุ่ม 'แก้แทนผู้จอง' และ 'ยกเลิกแทนผู้จอง' — การจองคงเดิม
resource: ../rules/BR-mrr-009@v1.md
tags: [mrr, example, exception]
id: EX-mrr-088
status: draft
kind: exception
proves: [BR-mrr-009@v1]
has_ui: true
timestamp: 2026-10-22T10:00:00+07:00
spec_hash: sha256:b4324be457da832022eb251e31c19fc9bb4f66487b82750654ed52bf86296602
---

# EX-mrr-088

## กำหนดให้ (given)
U1 เป็นผู้จองห้อง A วันนี้ 10:00–11:00 ขณะนี้เวลา 10:30 และผู้ใช้ล็อกอินเป็น System Administrator

## เมื่อ (when)
System Administrator เปิดหน้าจัดการการจองนี้

## แล้ว (then)
System Administrator เห็นข้อมูลการจองและร่องรอย แต่ไม่เห็นช่องเหตุผล ไม่เห็นปุ่ม 'แก้แทนผู้จอง' และ 'ยกเลิกแทนผู้จอง' — การจองคงเดิม

## พิสูจน์กฎ

- [BR-mrr-009@v1](../rules/BR-mrr-009@v1.md) ✅ ปัจจุบัน — เมื่อถึงเวลาเริ่มประชุมแล้ว ผู้จองแก้ไขหรือยกเลิกการจองเองไม่ได้ — ต้องให้ Room Administrator เป็นผู้แก้ไขหรือยกเลิก โดยต้องระบุเหตุผลทุกครั้ง
