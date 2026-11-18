---
type: Example
title: exception — System Administrator ไม่เห็นรายงานและสถิติ และแสดงข้อความ 'เ
description: System Administrator ไม่เห็นรายงานและสถิติ และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้'
resource: ../rules/BR-mrr-022@v1.md
tags: [mrr, example, exception]
id: EX-mrr-073
status: validated
kind: exception
proves: [BR-mrr-022@v1]
has_ui: true
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:a56783bb71d3de57b0f8b32ed91abfb0c4f05df0d860ebae03248bdbad48fa92
---

# EX-mrr-073

## กำหนดให้ (given)
รายงานการใช้ห้องประจำเดือน ต.ค. 2569 ออกแล้ว · ผู้ใช้ล็อกอินเป็น System Administrator

## เมื่อ (when)
System Administrator ส่งคำขอเปิดหน้ารายงานการใช้ห้อง เดือน ต.ค. 2569

## แล้ว (then)
System Administrator ไม่เห็นรายงานและสถิติ และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้'

## พิสูจน์กฎ

- [BR-mrr-022@v1](../rules/BR-mrr-022@v1.md) ✅ ปัจจุบัน — รายงานและสถิติการใช้ห้องดูได้เฉพาะ Room Administrator
