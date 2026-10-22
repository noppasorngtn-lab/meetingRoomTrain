---
type: Example
title: exception — U1 ไม่เห็นรายงานและสถิติ และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่
description: U1 ไม่เห็นรายงานและสถิติ และแสดงข้อความ 'เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้'
resource: ../rules/BR-mrr-022@v1.md
tags: [mrr, example, exception]
id: EX-mrr-074
status: draft
kind: exception
proves: [BR-mrr-022@v1]
has_ui: true
timestamp: 2026-10-22T10:00:00+07:00
spec_hash: sha256:c52207350e88d9f6263de4537b1a5694841d39611c9a9d9399611026afad35b0
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
