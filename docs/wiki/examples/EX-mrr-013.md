---
type: Example
title: happy — การจองเปลี่ยนเป็นสถานะ 'อนุมัติแล้ว' ใช้ห้องได้ และ Room Adm
description: การจองเปลี่ยนเป็นสถานะ 'อนุมัติแล้ว' ใช้ห้องได้ และ Room Administrator เห็นข้อความ 'อนุมัติการจองสำเร็จ'
resource: ../rules/BR-mrr-004@v1.md
tags: [mrr, example, happy]
id: EX-mrr-013
status: draft
kind: happy
proves: [BR-mrr-004@v1]
has_ui: true
timestamp: 2026-10-22T10:00:00+07:00
spec_hash: sha256:14d5adcb4ad8320b9cd55aa808a62bfab7aecc86f74a5e1e039bdcf38b916b3d
---

# EX-mrr-013

## กำหนดให้ (given)
การจองห้อง B พรุ่งนี้ 10:00–11:00 ของ U1 มีสถานะ 'รออนุมัติ' และผู้ใช้ล็อกอินเป็น Room Administrator

## เมื่อ (when)
Room Administrator กดอนุมัติการจองนี้

## แล้ว (then)
การจองเปลี่ยนเป็นสถานะ 'อนุมัติแล้ว' ใช้ห้องได้ และ Room Administrator เห็นข้อความ 'อนุมัติการจองสำเร็จ'

## พิสูจน์กฎ

- [BR-mrr-004@v1](../rules/BR-mrr-004@v1.md) ✅ ปัจจุบัน — การจองห้องที่ถูกตั้งไว้ว่า "ต้องอนุมัติ" จะใช้งานจริงได้ต่อเมื่อ Room Administrator อนุมัติแล้ว ห้องที่ไม่ได้ตั้งไว้ไม่ต้องรออนุมัติ
