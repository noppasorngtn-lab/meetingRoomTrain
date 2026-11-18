---
type: Example
title: alternate — การจองเปลี่ยนเป็นสถานะ 'อนุมัติแล้ว' และ RA2 เห็นข้อความ 'อน
description: การจองเปลี่ยนเป็นสถานะ 'อนุมัติแล้ว' และ RA2 เห็นข้อความ 'อนุมัติการจองสำเร็จ' — ห้องที่ยังไม่กำหนด Room Administrator ทุกคนอนุมัติได้
resource: ../rules/BR-mrr-013@v1.md
tags: [mrr, example, alternate]
id: EX-mrr-041
status: validated
kind: alternate
proves: [BR-mrr-013@v1]
has_ui: true
timestamp: 2026-11-18T12:30:00+07:00
spec_hash: sha256:caf742fecae122b4499839b3e5bee72bb42c751b62ffb4164317e7769dfdcacf
---

# EX-mrr-041

## กำหนดให้ (given)
ห้อง B ต้องอนุมัติ และยังไม่กำหนดผู้อนุมัติประจำห้อง · การจองห้อง B 18/10 10:00–11:00 ของ U1 มีสถานะ 'รออนุมัติ' · ผู้ใช้ล็อกอินเป็น RA2

## เมื่อ (when)
RA2 กดอนุมัติการจองนี้

## แล้ว (then)
การจองเปลี่ยนเป็นสถานะ 'อนุมัติแล้ว' และ RA2 เห็นข้อความ 'อนุมัติการจองสำเร็จ' — ห้องที่ยังไม่กำหนด Room Administrator ทุกคนอนุมัติได้

## พิสูจน์กฎ

- [BR-mrr-013@v1](../rules/BR-mrr-013@v1.md) ✅ ปัจจุบัน — แต่ละห้องที่ต้องอนุมัติกำหนดผู้อนุมัติประจำห้อง (Room Administrator) ได้ — ถ้ายังไม่กำหนด Room Administrator ทุกคนอนุมัติได้ และกำหนดทีหลังได้
