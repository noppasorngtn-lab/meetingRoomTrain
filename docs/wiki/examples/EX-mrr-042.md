---
type: Example
title: happy — ผู้อนุมัติประจำห้อง B เป็น RA1 และแสดงข้อความ 'บันทึกข้อมูลห
description: ผู้อนุมัติประจำห้อง B เป็น RA1 และแสดงข้อความ 'บันทึกข้อมูลห้องสำเร็จ' — กำหนดทีหลังได้
resource: ../rules/BR-mrr-013@v1.md
tags: [mrr, example, happy]
id: EX-mrr-042
status: validated
kind: happy
proves: [BR-mrr-013@v1]
has_ui: true
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:785094be90ca8025704b9d86557a79ff0030f20ed1d9eb5c92304006dc70c00c
---

# EX-mrr-042

## กำหนดให้ (given)
ห้อง B ต้องอนุมัติ ยังไม่กำหนดผู้อนุมัติประจำห้อง และผู้ใช้ล็อกอินเป็น Room Administrator

## เมื่อ (when)
Room Administrator แก้ข้อมูลห้อง B กำหนดผู้อนุมัติประจำห้องเป็น RA1 แล้วกดบันทึก

## แล้ว (then)
ผู้อนุมัติประจำห้อง B เป็น RA1 และแสดงข้อความ 'บันทึกข้อมูลห้องสำเร็จ' — กำหนดทีหลังได้

## พิสูจน์กฎ

- [BR-mrr-013@v1](../rules/BR-mrr-013@v1.md) ✅ ปัจจุบัน — แต่ละห้องที่ต้องอนุมัติกำหนดผู้อนุมัติประจำห้อง (Room Administrator) ได้ — ถ้ายังไม่กำหนด Room Administrator ทุกคนอนุมัติได้ และกำหนดทีหลังได้
