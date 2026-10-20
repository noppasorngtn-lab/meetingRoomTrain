---
type: Example
title: exception — สถานะยังเป็น 'อนุมัติแล้ว' และแสดงข้อความ 'กรุณาระบุเหตุผล'
description: สถานะยังเป็น 'อนุมัติแล้ว' และแสดงข้อความ 'กรุณาระบุเหตุผล'
resource: ../rules/BR-mrr-011@v1.md
tags: [mrr, example, exception]
id: EX-mrr-036
status: draft
kind: exception
proves: [BR-mrr-011@v1]
has_ui: true
timestamp: 2026-10-19T12:10:00+07:00
spec_hash: sha256:3feae22bd7bd6e01671511f618637fd3b4c354bf3fc6b0c78861ef192bd84921
---

# EX-mrr-036

## กำหนดให้ (given)
การจองห้อง B 18/10 10:00–11:00 ของ U1 มีสถานะ 'อนุมัติแล้ว' · ขณะนี้ 16/10 15:00 และผู้ใช้ล็อกอินเป็น Room Administrator

## เมื่อ (when)
Room Administrator เปลี่ยนผลเป็นปฏิเสธ โดยเว้นช่องเหตุผลว่าง

## แล้ว (then)
สถานะยังเป็น 'อนุมัติแล้ว' และแสดงข้อความ 'กรุณาระบุเหตุผล'

## พิสูจน์กฎ

- [BR-mrr-011@v1](../rules/BR-mrr-011@v1.md) ✅ ปัจจุบัน — Room Administrator เปลี่ยนผลการอนุมัติหรือปฏิเสธการจองได้ โดยต้องระบุเหตุผลทุกครั้ง และทำได้เฉพาะก่อนถึงเวลาเริ่มประชุม
