---
type: Example
title: happy — เห็นรายงานเดือน ต.ค. 2569 พร้อมอันดับห้องที่มีอัตราการใช้งาน
description: เห็นรายงานเดือน ต.ค. 2569 พร้อมอันดับห้องที่มีอัตราการใช้งานสูงสุด
resource: ../rules/BR-mrr-022@v1.md
tags: [mrr, example, happy]
id: EX-mrr-072
status: draft
kind: happy
proves: [BR-mrr-022@v1]
has_ui: true
timestamp: 2026-10-19T12:10:00+07:00
spec_hash: sha256:8f3dd91db6c46d19f3208646a481dbcdb105301c2f6dab33152f2cc2373c10c0
---

# EX-mrr-072

## กำหนดให้ (given)
รายงานการใช้ห้องประจำเดือน ต.ค. 2569 ออกแล้ว · ผู้ใช้ล็อกอินเป็น Room Administrator

## เมื่อ (when)
Room Administrator เปิดหน้ารายงานการใช้ห้อง เดือน ต.ค. 2569

## แล้ว (then)
เห็นรายงานเดือน ต.ค. 2569 พร้อมอันดับห้องที่มีอัตราการใช้งานสูงสุด

## พิสูจน์กฎ

- [BR-mrr-022@v1](../rules/BR-mrr-022@v1.md) ✅ ปัจจุบัน — รายงานและสถิติการใช้ห้องดูได้เฉพาะ Room Administrator
