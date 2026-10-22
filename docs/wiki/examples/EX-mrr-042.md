---
type: Example
title: happy — ผู้อนุมัติประจำห้อง B เป็น RA1 และแสดงข้อความ 'บันทึกข้อมูลห
description: ผู้อนุมัติประจำห้อง B เป็น RA1 และแสดงข้อความ 'บันทึกข้อมูลห้องสำเร็จ' — กำหนดทีหลังได้
resource: ../rules/BR-mrr-013@v1.md
tags: [mrr, example, happy]
id: EX-mrr-042
status: draft
kind: happy
proves: [BR-mrr-013@v1]
has_ui: true
timestamp: 2026-10-22T10:00:00+07:00
spec_hash: sha256:b0a805415e49032c1cc18c8e2527c0d54c29fa3c9b8a883b9811b09f26297482
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
