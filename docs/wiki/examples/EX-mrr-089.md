---
type: Example
title: exception — System Administrator เห็นข้อมูลการจองและร่องรอย แต่ไม่เห็นช่
description: System Administrator เห็นข้อมูลการจองและร่องรอย แต่ไม่เห็นช่องเหตุผล และไม่เห็นปุ่ม 'เปลี่ยนผลการอนุมัติ' — สถานะยังเป็น 'อนุมัติแล้ว'
resource: ../rules/BR-mrr-011@v1.md
tags: [mrr, example, exception]
id: EX-mrr-089
status: draft
kind: exception
proves: [BR-mrr-011@v1]
has_ui: true
timestamp: 2026-10-19T12:10:00+07:00
spec_hash: sha256:576d6b3d6a7924c81caa2f3e916ca8cd2401563552fc2e57150c0e83e70c22a3
---

# EX-mrr-089

## กำหนดให้ (given)
การจองห้อง B 18/10 10:00–11:00 ของ U1 มีสถานะ 'อนุมัติแล้ว' · ขณะนี้ 16/10 15:00 และผู้ใช้ล็อกอินเป็น System Administrator

## เมื่อ (when)
System Administrator เปิดหน้าจัดการการจองนี้

## แล้ว (then)
System Administrator เห็นข้อมูลการจองและร่องรอย แต่ไม่เห็นช่องเหตุผล และไม่เห็นปุ่ม 'เปลี่ยนผลการอนุมัติ' — สถานะยังเป็น 'อนุมัติแล้ว'

## พิสูจน์กฎ

- [BR-mrr-011@v1](../rules/BR-mrr-011@v1.md) ✅ ปัจจุบัน — Room Administrator เปลี่ยนผลการอนุมัติหรือปฏิเสธการจองได้ โดยต้องระบุเหตุผลทุกครั้ง และทำได้เฉพาะก่อนถึงเวลาเริ่มประชุม
