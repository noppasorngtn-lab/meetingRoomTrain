---
type: Example
title: exception — U1 ไม่เห็นรายงานและสถิติ และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่
description: U1 ไม่เห็นรายงานและสถิติ และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้'
resource: ../rules/BR-mrr-022@v1.md
tags: [mrr, example, exception]
id: EX-mrr-074
status: validated
kind: exception
proves: [BR-mrr-022@v1]
has_ui: true
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:44430d0cc8446d638631c933e0e7b13d118d489f5b8f8aa19e4c6ef557d3c082
---

# EX-mrr-074

## กำหนดให้ (given)
รายงานการใช้ห้องประจำเดือน ต.ค. 2569 ออกแล้ว · ผู้ใช้ล็อกอินเป็น U1 (General User)

## เมื่อ (when)
U1 ส่งคำขอเปิดหน้ารายงานการใช้ห้อง เดือน ต.ค. 2569

## แล้ว (then)
U1 ไม่เห็นรายงานและสถิติ และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้'

## พิสูจน์กฎ

- [BR-mrr-022@v1](../rules/BR-mrr-022@v1.md) ✅ ปัจจุบัน — รายงานและสถิติการใช้ห้องดูได้เฉพาะ Room Administrator
