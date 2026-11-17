#!/usr/bin/env python3
"""T1 — สร้าง test case (E2E) จาก EX-mrr ใน docs/requirements/REQ-mrr-*.md

อ่านคอลัมน์ id/พิสูจน์/ชนิด/เมื่อ/ต้องได้ ของ EX ตามที่เขียนใน REQ (ไม่แก้ถ้อยคำ)
แล้วใส่ metadata ที่ QA เติม (function, UI, level, data source, automation, pre-condition)
เขียนผลลง docs/qa/t1-test-cases.csv และ docs/qa/t1-test-cases.md

รัน: python docs/qa/t1-generate.py
"""
import csv, io, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QA = ROOT / "docs" / "qa"

# ---------- อ่าน EX จาก REQ ----------
EX = {}
for f in sorted((ROOT / "docs" / "requirements").glob("REQ-mrr-00*.md")):
    for line in f.read_text(encoding="utf-8").splitlines():
        m = re.match(r"\| (EX-mrr-\d+) \| ([^|]+) \| (\w+) \| (.*?) \| (.*) \|\s*$", line)
        if m:
            ex, brs, kind, when, then = m.groups()
            EX[ex] = dict(brs=[b.strip() for b in brs.split(",")], kind=kind,
                          when=when.strip(), then=then.strip(), req=f.stem)

# ---------- priority ตาม §3.3 (Recommended) ----------
PRI = {"BR-mrr-001": "Critical", "BR-mrr-003": "Critical", "BR-mrr-005": "Critical",
       "BR-mrr-018": "Critical", "BR-mrr-021": "Critical", "BR-mrr-022": "Critical",
       "BR-mrr-026": "Critical", "BR-mrr-027": "Critical", "BR-mrr-028": "Critical",
       "BR-mrr-004": "High", "BR-mrr-008": "High", "BR-mrr-009": "High", "BR-mrr-010": "High",
       "BR-mrr-011": "High", "BR-mrr-012": "High", "BR-mrr-013": "High", "BR-mrr-014": "High",
       "BR-mrr-016": "High", "BR-mrr-023": "High",
       "BR-mrr-002": "Medium", "BR-mrr-006": "Medium", "BR-mrr-007": "Medium",
       "BR-mrr-015": "Medium", "BR-mrr-017": "Medium", "BR-mrr-019": "Medium",
       "BR-mrr-020": "Medium", "BR-mrr-024": "Medium", "BR-mrr-025": "Medium"}
RANK = ["Critical", "High", "Medium", "Low"]

# ---------- เคสที่มีสคริปต์แล้ว: ห้ามสร้างซ้ำ ----------
EXISTING = {
    "EX-mrr-001": "TC-BKG-UI006-019", "EX-mrr-002": "TC-BKG-UI006-020",
    "EX-mrr-003": "TC-BKG-UI006-021", "EX-mrr-005": "เคส #8, #10 (booking.spec.ts)",
    "EX-mrr-006": "TC-BKG-UI006-023", "EX-mrr-007": "TC-BKG-UI006-024",
    "EX-mrr-012": "TC-BKG-UI006-025", "EX-mrr-062": "TC-BKG-UI006-027 (stub)",
}
# EX-019 ถูกคลุมบางส่วนโดย TC-BKG-UI006-026 (Email ถึงผู้จอง) — ไม่คลุม "U2/U3 ไม่ได้รับ"
PARTIAL_EXISTING = {"EX-mrr-019": "TC-BKG-UI006-026"}
# EX ของ BR-mrr-010@v1 ที่ถูก v2 แทน และไม่มีใน AC — ไม่สร้างเคส (ดู Open Question)
SUPERSEDED = {"EX-mrr-031", "EX-mrr-032"}

# ---------- metadata: fn, ui, type|None, data_source, automation, pre-condition, note ----------
# automation: Yes = เขียนสคริปต์ได้ด้วย dev stack ตอนนี้ · Partial = ต้องเตรียมข้อมูล (ดูส่วน C)
#             No = ต้องมีกลไกที่ยังไม่มี (ดูส่วน D)
A = "Yes"; P = "Partial"; N = "No"
R = "real"; S = "stub"

def m(fn, ui, ds, auto, pre, typ=None, note=""):
    return dict(fn=fn, ui=ui, ds=ds, auto=auto, pre=pre, typ=typ, note=note)

U2 = "ต้องมีผู้ใช้ทั่วไปคนที่ 2"
RA = "ต้องมีผู้ใช้ Room Administrator"
CLK = "ต้องควบคุมเวลาฝั่งเซิร์ฟเวอร์ [TBD] OQ-T1-01"
JOB = "ต้องสั่งงานตามเวลาให้รันได้ [TBD] OQ-T1-02"
MAILF = "ต้องจำลองอีเมลล่มจริง [TBD] OQ-T1-03"
API = "ยิงคำสั่งตรงด้วย session ของบทบาทนั้น (ไม่ผ่านปุ่ม) เพราะปุ่มถูกซ่อน"

META = {
    # --- REQ-001 การจอง ---
    "EX-mrr-004": m("BKG", "UI006", R, P, "ห้อง A ว่าง · ผู้จองคนแรกจอง 09:00–10:00 แล้วยกเลิกการจองนั้น", note=U2 + " (EX ใช้ 'ผู้ใช้อีกคน'); ใช้ผู้จองเดิมได้ถ้ายอมรับว่าไม่พิสูจน์ข้ามผู้ใช้ · ID สงวนตาม test/README (TC-022)"),
    "EX-mrr-008": m("MYB", "UI008", R, A, "U1 มีการจองห้อง A ที่ยังไม่ถึงเวลาเริ่ม"),
    "EX-mrr-009": m("MYB", "UI007", R, A, "U1 มีการจองห้อง A ที่ยังไม่ถึงเวลาเริ่ม"),
    "EX-mrr-010": m("MYB", "UI007", R, P, "U1 มีการจอง · U2 ล็อกอินอยู่", note=U2 + " · " + API),
    "EX-mrr-011": m("MYB", "UI007", R, P, "U1 จองห้อง A 10:00–11:00 · U2 จองห้อง B", note=U2),
    "EX-mrr-026": m("MYB", "UI007", R, N, "U1 มีการจอง เริ่ม 10:00 · เวลาปัจจุบัน 09:59", note=CLK + " (ขอบเขต BVA ก่อนเริ่ม 1 นาที)"),
    "EX-mrr-027": m("MYB", "UI007", R, N, "U1 มีการจอง เริ่ม 10:00 · เวลาปัจจุบัน 10:00", note=CLK + " (ขอบเขต BVA เริ่มพอดี)"),
    "EX-mrr-028": m("APR", "UI010", R, P, "U1 มีการจองที่เริ่มแล้ว หรือ RA เปิดหน้าจัดการการจอง", note=RA),
    "EX-mrr-029": m("APR", "UI010", R, P, "เหมือน EX-028 แต่เว้นช่องเหตุผลว่าง", note=RA),
    "EX-mrr-088": m("APR", "UI010", R, P, "System Administrator ล็อกอิน · มีการจองให้เปิดดู", note="ต้องมีผู้ใช้ System Administrator"),
    "EX-mrr-043": m("APR", "UI010", R, N, "การจองที่ผ่านเวลาจบประชุมแล้ว (หัวข้อ 'ประชุมทีม') · RA1 ล็อกอิน", note=RA + " · การจองที่จบแล้วต้องสร้างด้วยการย้อนเวลา " + CLK),
    "EX-mrr-044": m("APR", "UI010", R, P, "การจองที่ยังไม่ถึงเวลาจบ (หัวข้อ 'ประชุมทีม') · RA1 ล็อกอิน", note=RA),
    "EX-mrr-045": m("APR", "UI011", R, N, "มีคำขอแก้ไขที่ RA1 สร้างไว้ (ผลของ EX-043) · RA2 ล็อกอิน", note=RA + " 2 คน · ต่อเนื่องจาก EX-043"),
    "EX-mrr-046": m("APR", "UI011", R, N, "มีคำขอแก้ไขที่ RA1 สร้างไว้ (ผลของ EX-043) · RA1 ล็อกอิน", typ="Negative", note=RA + " · ต่อเนื่องจาก EX-043"),
    "EX-mrr-068": m("CAL", "UI005", R, P, "U1 จองห้อง A 10:00–11:00 หัวข้อ 'ประชุมทีม' ผู้เข้าร่วม U2, U3", note=U2 + " ไม่ต้องใช้ในเคสนี้ แต่ต้องมีรายชื่อ U2/U3 ให้เลือก"),
    "EX-mrr-069": m("CAL", "UI005", R, P, "เหมือน EX-068 · U2 ล็อกอิน", note=U2),
    "EX-mrr-070": m("CAL", "UI005", R, P, "เหมือน EX-068 · U4 (ไม่ใช่ผู้จอง/ผู้เข้าร่วม) ล็อกอิน", note=U2 + " (U4)"),
    "EX-mrr-071": m("CAL", "UI005", R, P, "ห้อง B มีการจองที่ 'รออนุมัติ' ของผู้อื่น 10:00–11:00 · U4 ล็อกอิน", note=U2 + " (U4) · ห้อง B ต้องอนุมัติ"),
    "EX-mrr-091": m("AUTH", "UI001", R, A, "U1 อยู่ในรายชื่อ HR และ active · mailpit ว่าง"),
    "EX-mrr-092": m("AUTH", "UI001", R, N, "mail server ล่ม · U1 ยังไม่มีรหัสที่ใช้ได้", typ="Exception", note=MAILF + " · DQ-mrr-014 (rollback) ยัง open"),
    "EX-mrr-093": m("AUTH", "UI001", R, N, "ต่อจาก EX-092 · รอ 30 นาที", typ="Exception", note=MAILF + " · " + CLK),
    "EX-mrr-094": m("AUTH", "UI001", R, N, "ต่อจาก EX-092 · mail server กลับมาปกติ", note=MAILF + " · " + CLK),
    "EX-mrr-095": m("AUTH", "UI001", R, P, "U1 ขอรหัสแล้ว รหัสยังใช้ได้ · ขอซ้ำ", note="ขอบเขต 10:09:59 ต้อง " + CLK + " · ทดสอบ 'ขอซ้ำขณะรหัสยังใช้ได้' ได้เลย (Partial)"),
    "EX-mrr-096": m("AUTH", "UI001", R, N, "U1 ขอรหัสแล้ว รอให้รหัสหมดอายุพอดี 10 นาที · ขอซ้ำ", note=CLK),
    "EX-mrr-097": m("AUTH", "UI001", R, A, "U1 ขอรหัส แล้วใช้รหัสนั้นเข้าสู่ระบบแล้ว · ขอรหัสใหม่"),
    "EX-mrr-098": m("AUTH", "UI001", R, A, "Email ที่ไม่อยู่ในรายชื่อ HR (U9) · mailpit ว่าง", note="ต้องเทียบข้อความกับ EX-091 ทุกตัวอักษร และยืนยันว่า mailpit ไม่มีอีเมล"),
    "EX-mrr-099": m("AUTH", "UI001", R, P, "U5 อยู่ในรายชื่อ HR แต่บัญชีไม่ active", note="ต้องมีบัญชี inactive ใน dev"),
    "EX-mrr-100": m("AUTH", "UI002", R, A, "U1 ขอรหัสแล้ว รหัสยังไม่หมดอายุ", note="ขอบเขต 10:09:59 ต้อง " + CLK + " · เคสนี้พิสูจน์ได้เฉพาะ 'ใช้ภายในอายุ' (ครอบคลุมโดย global-setup)"),
    "EX-mrr-101": m("AUTH", "UI002", R, N, "U1 ขอรหัสแล้ว รอ ≥ 10 นาที", note=CLK),
    "EX-mrr-102": m("AUTH", "UI002", R, A, "U1 ใช้รหัสเข้าสู่ระบบเครื่องที่ 1 แล้ว · เครื่องที่ 2 (browser context ใหม่) กรอกรหัสเดิม"),
    "EX-mrr-103": m("AUTH", "UI002", R, A, "U1 ใช้รหัสเข้าสู่ระบบแล้ว · กด magic link ใน Email ฉบับเดียวกัน"),
    "EX-mrr-104": m("AUTH", "UI002", R, A, "U1 ขอรหัสแล้ว · กรอกรหัสที่ผิด (สลับตัวเลข)"),
    "EX-mrr-105": m("AUTH", "UI002", R, A, "U1 กรอกรหัสผิดแล้ว (EX-104) · กรอกรหัสที่ถูก"),
    # --- REQ-002 อนุมัติ ---
    "EX-mrr-013": m("APR", "UI009", R, P, "การจองห้อง B (ต้องอนุมัติ) สถานะ PENDING_APPROVAL · RA ล็อกอิน", note=RA),
    "EX-mrr-014": m("APR", "UI009", R, P, "U1 จองห้อง B สถานะ PENDING_APPROVAL · U1 ไม่ใช่ RA", note=API),
    "EX-mrr-035": m("APR", "UI010", R, P, "การจอง CONFIRMED ที่ยังไม่ถึงเวลาเริ่ม · RA ล็อกอิน", note=RA),
    "EX-mrr-036": m("APR", "UI010", R, P, "เหมือน EX-035 แต่เว้นช่องเหตุผลว่าง", note=RA),
    "EX-mrr-037": m("APR", "UI010", R, N, "การจอง REJECTED เริ่ม 10:00 · เวลาปัจจุบัน 09:59", note=RA + " · " + CLK),
    "EX-mrr-038": m("APR", "UI010", R, N, "การจอง CONFIRMED เริ่ม 10:00 · เวลาปัจจุบัน 10:00", note=RA + " · " + CLK),
    "EX-mrr-089": m("APR", "UI010", R, P, "System Administrator ล็อกอิน · การจอง CONFIRMED", note="ต้องมีผู้ใช้ System Administrator"),
    "EX-mrr-039": m("APR", "UI009", R, P, "ห้อง B กำหนดผู้อนุมัติประจำห้องเป็น RA1 · มีการจอง PENDING_APPROVAL", note=RA + " 2 คน"),
    "EX-mrr-040": m("APR", "UI009", R, P, "ห้อง B กำหนดผู้อนุมัติประจำห้องเป็น RA1 · RA2 ล็อกอิน", note=RA + " 2 คน"),
    "EX-mrr-041": m("APR", "UI009", R, P, "ห้องที่ต้องอนุมัติและยังไม่กำหนดผู้อนุมัติประจำห้อง · RA2 ล็อกอิน", note=RA),
    "EX-mrr-042": m("RMM", "UI013", R, P, "ห้อง B ต้องอนุมัติ · RA ล็อกอิน", note=RA),
    "EX-mrr-050": m("APR", "JOB", R, N, "การจอง PENDING_APPROVAL เริ่ม 10:00 · งานรันตอน 09:59", note=JOB + " · " + CLK),
    "EX-mrr-051": m("APR", "JOB", R, N, "การจอง PENDING_APPROVAL เริ่ม 10:00 · งานรันตอน 10:00 · ส่งอีเมลได้", note=JOB + " · " + CLK),
    "EX-mrr-052": m("APR", "JOB", R, N, "การจอง PENDING_APPROVAL เริ่ม 10:00 · งานรันตอน 10:00 · ส่งอีเมลล้มเหลว", typ="Exception", note=JOB + " · " + MAILF),
    "EX-mrr-053": m("APR", "UI009", R, N, "ต่อจาก EX-052 (ค้างอยู่) · RA กดอนุมัติก่อนงานรอบถัดไป", note=JOB + " · " + RA),
    "EX-mrr-054": m("AUD", "UI010", R, P, "การจอง PENDING_APPROVAL · RA1 ล็อกอิน", note=RA),
    "EX-mrr-055": m("AUD", "UI010", R, P, "การจอง CONFIRMED ของ U1 · RA1 ล็อกอิน", note=RA),
    "EX-mrr-056": m("AUD", "UI010", R, P, "U1 ยกเลิกการจองของตัวเอง · RA ล็อกอินเปิดดูร่องรอย", note=RA + " · " + U2),
    "EX-mrr-057": m("AUD", "UI010", R, P, "RA1 ยกเลิกแทน U1 โดยไม่ใส่เหตุผล", note=RA),
    "EX-mrr-058": m("AUD", "UI010", R, P, "มีร่องรอย 'ยกเลิกแทนผู้จอง' ของ RA1 (ผลของ EX-055) · RA2 ล็อกอิน", note=RA + " 2 คน · ต่อเนื่องจาก EX-055"),
    "EX-mrr-059": m("AUD", "UI010", R, P, "มีร่องรอยของ EX-055 · System Administrator ล็อกอิน", note="ต้องมีผู้ใช้ System Administrator · ต่อเนื่องจาก EX-055"),
    "EX-mrr-060": m("AUD", "UI010", R, P, "มีร่องรอยของ EX-055 · U1 ล็อกอิน", note=API),
    "EX-mrr-061": m("AUD", "UI010", R, P, "มีร่องรอยของ EX-055 · U2 ล็อกอิน", note=U2 + " · " + API),
    # --- REQ-003 ห้อง ---
    "EX-mrr-015": m("RMM", "UI013", R, P, "RA ล็อกอิน · ยังไม่มีห้อง C", note=RA + " · ห้อง E2E ที่สร้างต้องมีวิธีลบ/ซ่อน (DQ-mrr-003 open)"),
    "EX-mrr-016": m("RMM", "UI012", R, P, "ห้อง A มีการจองพรุ่งนี้ 10:00–11:00 · RA ล็อกอิน", note=RA + " · ใช้ห้อง E2E เฉพาะ ไม่ปิดห้อง A ของ dev"),
    "EX-mrr-017": m("RMM", "UI013", R, A, "ห้อง A ความจุ 8 · U1 (General User) ล็อกอิน", note=API),
    "EX-mrr-018": m("RMM", "UI013", R, P, "ห้อง A ความจุ 8 · System Administrator ล็อกอิน", note="ต้องมีผู้ใช้ System Administrator · " + API),
    "EX-mrr-090": m("RMM", "UI014", R, A, "U1 (General User) ล็อกอิน"),
    "EX-mrr-030": m("BKG", "UI006", R, P, "ห้อง A ถูก RA แก้เป็น 'ต้องอนุมัติ' ก่อนที่ U2 จอง", note=RA + " + " + U2),
    "EX-mrr-033": m("BKG", "UI006", R, N, "U2 เปิดฟอร์มจองห้อง A ไว้ · RA แก้ห้อง A เป็นต้องอนุมัติระหว่างที่ฟอร์มเปิด · U2 กดยืนยัน", typ="Boundary", note=RA + " + " + U2 + " (สองเซสชันขนาน)"),
    "EX-mrr-034": m("BKG", "UI006", R, P, "ห้อง A ความจุ 8 · U1 มีการจองผู้เข้าร่วม 8 คน · RA แก้ความจุเป็น 6 · U2 จองผู้เข้าร่วม 6 คน", note=RA + " + " + U2),
    "EX-mrr-078": m("RMM", "UI013", R, N, "U1 มีการจองห้อง A ที่ยังไม่ถึงเวลาเริ่ม (CONFIRMED) · RA แก้ห้อง A เป็นต้องอนุมัติ", note=RA + " · ขอบเขตเวลา 10:00 " + CLK),
    "EX-mrr-079": m("RMM", "UI013", R, N, "U1 มีการจองห้อง B PENDING_APPROVAL ที่ยังไม่ถึงเวลาเริ่ม · RA แก้ห้อง B เป็นไม่ต้องอนุมัติ", note=RA + " · " + CLK),
    "EX-mrr-080": m("RMM", "UI013", R, N, "ห้อง A มีการจอง U1 เริ่ม 10:00 และ U2 เริ่ม 11:00 · RA แก้เวลา 10:00 พอดี", typ="Boundary", note=RA + " + " + U2 + " · " + CLK),
    "EX-mrr-081": m("BKG", "UI006", R, P, "ห้อง A ปิดปรับปรุง · U2 ล็อกอิน", note=U2 + " + ห้องปิดปรับปรุงจริง · ID สงวนตาม test/README (TC-028) · เคสเดิม #13/#14 เป็น stub ไม่พิสูจน์ว่า API ไม่สร้างการจอง"),
    "EX-mrr-082": m("BKG", "UI008", R, P, "ห้อง A ปิดปรับปรุง · U1 มีการจองห้อง A เดิม 10:00–11:00", note="ต้องมีห้องปิดปรับปรุงที่มีการจองเดิม (ผลของ EX-016)"),
    "EX-mrr-083": m("RMM", "UI012", R, P, "ห้อง A ปิดปรับปรุง · RA เปิดห้องกลับมา · U2 จอง", note=RA + " + " + U2),
    # --- REQ-004 รายงาน ---
    "EX-mrr-047": m("RPT", "RPT001", R, P, "มีรายงานเดือน ต.ค. 2569 ฉบับที่ 1 · RA ล็อกอิน", note=RA),
    "EX-mrr-048": m("RPT", "RPT001", R, P, "มีรายงานฉบับที่ 1 · ส่งคำสั่งแก้ตัวเลข", note=RA + " · " + API),
    "EX-mrr-049": m("RPT", "RPT001", R, P, "ฉบับที่ 1 ออกเมื่อ 1/11 · ข้อมูลการจองถูกแก้ภายหลัง", note=RA + " · ต่อเนื่องจาก EX-047"),
    "EX-mrr-072": m("RPT", "RPT001", R, P, "RA ล็อกอิน · มีข้อมูลการจองเดือน ต.ค. 2569", note=RA),
    "EX-mrr-073": m("RPT", "RPT001", R, P, "System Administrator ล็อกอิน", note="ต้องมีผู้ใช้ System Administrator · " + API),
    "EX-mrr-074": m("RPT", "RPT001", R, A, "U1 (General User) ล็อกอิน", note=API),
    "EX-mrr-084": m("RPT", "RPT001", R, P, "fixture ตาม GD-mrr-001: ห้อง A, B มีการจองหลายสถานะ", note=RA + " · fixture ตาม golden · เทียบตัวเลขกับ GD-mrr-001 (round half up, 2 ตำแหน่ง)"),
    "EX-mrr-085": m("RPT", "RPT001", R, P, "fixture ตาม GD-mrr-001: ห้อง C มีการจอง 17:00–18:00 วันศุกร์ และหลัง 18:00 / วันเสาร์", typ="Boundary", note=RA + " · ชั่วโมงทำการ 13,200 นาที"),
    "EX-mrr-086": m("RPT", "RPT001", R, P, "fixture ตาม GD-mrr-001: ห้อง D ปิดปรับปรุง 3,000 นาที + มีการจอง 21/10 ในช่วงปิด", note=RA),
    "EX-mrr-087": m("RPT", "RPT001", R, P, "fixture ตาม GD-mrr-001: ห้อง E ชั่วโมงทำการเหลือ 0", note=RA),
    # --- REQ-005 แจ้งเตือน ---
    "EX-mrr-020": m("NTF", "JOB", R, N, "U1 จองห้อง A 10:00–11:00 ผู้เข้าร่วม U2,U3 (ล่วงหน้า > 15 นาที) · งานรันตอน 09:45", note=JOB + " · " + CLK + " · " + U2),
    "EX-mrr-021": m("NTF", "UI008", R, P, "U1 จองห้อง A 10:00–11:00 ผู้เข้าร่วม U2,U3 · ห้องว่าง 14:00–15:00", note=U2 + " (U2/U3 เป็นผู้เข้าร่วม ต้องมีกล่องจดหมายใน mailpit)"),
    "EX-mrr-022": m("NTF", "UI008", R, A, "U1 มีการจอง · แก้เฉพาะหัวข้อ", typ="Positive"),
    "EX-mrr-023": m("NTF", "JOB", R, N, "การจองเริ่ม 10:00 · งานรันตอน 09:44", typ="Boundary", note=JOB + " · " + CLK),
    "EX-mrr-024": m("NTF", "UI006", R, N, "เวลาปัจจุบัน 09:50 · U1 จองห้อง A 10:00–11:00 (เหลือ < 15 นาที)", note=CLK + " · หรือจองเริ่มภายใน 14 นาทีของเวลาจริง (Partial ได้ด้วยเวลาจริง)"),
    "EX-mrr-025": m("NTF", "JOB", R, N, "การจองห้อง B PENDING_APPROVAL เริ่ม 10:00 · งานรันตอน 09:45", typ="Negative", note=JOB + " · " + CLK),
    "EX-mrr-063": m("NTF", "UI008", R, N, "U1 มีการจอง 10:00–11:00 · อีเมลล้มเหลว · เปลี่ยนเวลา 14:00–15:00", typ="Exception", note=MAILF + " · DQ-mrr-005 (rollback) ยัง open"),
    "EX-mrr-064": m("NTF", "UI009", R, N, "การจอง PENDING_APPROVAL · อีเมลล้มเหลว · RA กดอนุมัติ", typ="Exception", note=MAILF + " · " + RA),
    "EX-mrr-065": m("NTF", "UI008", R, N, "U1 มีการจอง · อีเมลล้มเหลวอยู่ · แก้เฉพาะหัวข้อ", note=MAILF + " (พิสูจน์ว่าไม่ล้มตาม)"),
    "EX-mrr-066": m("NTF", "JOB", R, N, "การจองเริ่ม 10:00 · งานรัน 09:45 · อีเมลล้มเหลว", typ="Exception", note=JOB + " · " + MAILF + " · " + CLK),
    "EX-mrr-067": m("NTF", "JOB", R, N, "ต่อจาก EX-066 · งานรอบถัดไป 09:50", typ="Exception", note=JOB + " · " + CLK),
    "EX-mrr-075": m("NTF", "JOB", R, N, "การจองเริ่ม 10:00 ผู้เข้าร่วม U2,U3 · งานรันตอน 09:45", note=JOB + " · " + CLK),
    "EX-mrr-076": m("NTF", "JOB", R, N, "ต่อจาก EX-075 · งานรันซ้ำ 09:50", typ="Exception", note=JOB + " · " + CLK),
    "EX-mrr-077": m("NTF", "JOB", R, N, "การจอง 'ประชุมด่วน' ถูกเตือนทันทีตอนจอง (EX-024) · งานรัน 09:55", typ="Boundary", note=JOB + " · " + CLK),
}

TYPE_OF = {"happy": "Positive", "alternate": "Positive", "exception": "Negative", "boundary": "Boundary"}

# ---------- Test Condition (ส่วน A) ----------
COND = {
    "BR-mrr-001": [("ช่วงเวลาที่จบเท่ากับเริ่มของอีกรายการ ไม่ทับ (ขอบ [start,end))", "EX-mrr-001"),
                   ("ทับกัน 1 นาที ต้องปฏิเสธ", "EX-mrr-002"),
                   ("การจอง PENDING_APPROVAL กันช่วงเวลา", "EX-mrr-003"),
                   ("การจองที่ถูกยกเลิกไม่กันช่วงเวลา", "EX-mrr-004")],
    "BR-mrr-002": [("หัวข้อ+ผู้เข้าร่วมครบ อุปกรณ์เสริมไม่บังคับ", "EX-mrr-005"),
                   ("ขาดหัวข้อ", "EX-mrr-006"), ("ขาดผู้เข้าร่วม", "EX-mrr-007")],
    "BR-mrr-003": [("แก้ไข/ยกเลิกของตัวเอง", "EX-mrr-008, 009"),
                   ("แก้ไข/ยกเลิกของผู้อื่น (ยิงตรง) ต้องปฏิเสธ", "EX-mrr-010"),
                   ("หน้าการจองของฉันแสดงเฉพาะของตัวเอง", "EX-mrr-011")],
    "BR-mrr-004": [("ห้องต้องอนุมัติ → PENDING_APPROVAL → CONFIRMED", "EX-mrr-012, 013"),
                   ("ผู้จองอนุมัติเองไม่ได้", "EX-mrr-014"),
                   ("ห้องไม่ต้องอนุมัติ → CONFIRMED ทันที", "EX-mrr-001")],
    "BR-mrr-005": [("เพิ่ม/แก้/ปิดปรับปรุงห้อง โดย RA", "EX-mrr-015, 016"),
                   ("General User / System Administrator ทำไม่ได้", "EX-mrr-017, 018, 090")],
    "BR-mrr-006": [("อัตราการใช้งาน = นาทีที่จองใช้ได้ ÷ นาทีทำการ × 100 ปัด round half up 2 ตำแหน่ง", "EX-mrr-084"),
                   ("ขอบเขตชั่วโมงทำการ (หลัง 18:00 / เสาร์ไม่นับ)", "EX-mrr-085"),
                   ("ตัวหารหักช่วงปิดปรับปรุง", "EX-mrr-086"),
                   ("ตัวหาร 0 แสดง '—' ไม่จัดอันดับ", "EX-mrr-087")],
    "BR-mrr-007": [("จองสำเร็จ → Email ถึงผู้จองเท่านั้น", "EX-mrr-019"),
                   ("ใกล้เริ่ม/เปลี่ยนเวลา → ถึงผู้จองและผู้เข้าร่วมทุกคน", "EX-mrr-020, 021"),
                   ("แก้เฉพาะหัวข้อไม่ส่ง Email", "EX-mrr-022")],
    "BR-mrr-008": [("เตือน 15 นาทีก่อนเริ่ม ขอบ 09:44/09:45", "EX-mrr-020, 023"),
                   ("จองเมื่อเหลือ < 15 นาที เตือนทันที", "EX-mrr-024"),
                   ("PENDING_APPROVAL ไม่เตือน", "EX-mrr-025")],
    "BR-mrr-009": [("ก่อนเริ่ม/ที่เริ่มพอดี ผู้จองยกเลิกเอง", "EX-mrr-026, 027"),
                   ("RA ยกเลิกแทน ต้องมีเหตุผล", "EX-mrr-028, 029"),
                   ("System Administrator ไม่มีปุ่มแก้/ยกเลิกแทน", "EX-mrr-088")],
    "BR-mrr-010@v2": [("ห้องแก้เป็นต้องอนุมัติ → การจองที่ยังไม่เริ่มกลับเป็นรออนุมัติ", "EX-mrr-078"),
                      ("ห้องแก้เป็นไม่ต้องอนุมัติ → ใช้ได้ทันที", "EX-mrr-079"),
                      ("เริ่มพอดีเวลาที่แก้ นับว่าเริ่มแล้ว", "EX-mrr-080"),
                      ("การจองหลังแก้ใช้ค่าตั้งใหม่ · นับเวลาที่กดยืนยัน", "EX-mrr-030, 033"),
                      ("ความจุไม่บังคับจำนวนผู้เข้าร่วม", "EX-mrr-034")],
    "BR-mrr-011": [("เปลี่ยนผลอนุมัติ/ปฏิเสธ ต้องมีเหตุผล", "EX-mrr-035, 036"),
                   ("ขอบเขต 1 นาทีก่อนเริ่ม / เริ่มแล้ว", "EX-mrr-037, 038"),
                   ("System Administrator ไม่เห็นปุ่มเปลี่ยนผล", "EX-mrr-089")],
    "BR-mrr-012": [("ห้องปิดปรับปรุงรับจองใหม่ไม่ได้ การจองเดิมคงไว้", "EX-mrr-016, 081"),
                   ("แก้เวลาการจองนับเป็นจองใหม่", "EX-mrr-082"),
                   ("เปิดห้องกลับแล้วจองได้", "EX-mrr-083")],
    "BR-mrr-013": [("ห้องกำหนดผู้อนุมัติ เฉพาะผู้นั้นอนุมัติได้", "EX-mrr-039, 040"),
                   ("ยังไม่กำหนด RA ทุกคนอนุมัติได้", "EX-mrr-041"),
                   ("กำหนดผู้อนุมัติทีหลังได้", "EX-mrr-042")],
    "BR-mrr-014": [("หลังจบประชุม แก้ → สร้างคำขอแก้ ค่าเดิมคงไว้", "EX-mrr-043"),
                   ("ก่อนจบประชุม แก้มีผลทันที", "EX-mrr-044"),
                   ("RA คนอื่นอนุมัติคำขอได้ · คนแก้อนุมัติเองไม่ได้", "EX-mrr-045, 046")],
    "BR-mrr-015": [("ออกรายงานซ้ำ → ฉบับใหม่ ฉบับเดิมเก็บ", "EX-mrr-047"),
                   ("แก้ฉบับที่ออกแล้วไม่ได้", "EX-mrr-048"),
                   ("ฉบับเดิมไม่เปลี่ยนตามข้อมูลที่แก้ภายหลัง", "EX-mrr-049")],
    "BR-mrr-016": [("PENDING_APPROVAL ที่ถึงเวลาเริ่ม → ยกเลิกอัตโนมัติ ขอบ 09:59/10:00", "EX-mrr-050, 051"),
                   ("ส่ง Email ไม่สำเร็จ → ยังไม่ยกเลิก รอรอบถัดไป", "EX-mrr-052"),
                   ("RA อนุมัติได้ระหว่างค้าง", "EX-mrr-053")],
    "BR-mrr-017": [("การกระทำของ RA ถูกบันทึก ใคร·เมื่อไหร่·ทำอะไร·เหตุผล", "EX-mrr-054, 055"),
                   ("การกระทำของผู้จองเอง/ที่ล้มเหลว ไม่บันทึก", "EX-mrr-056, 057")],
    "BR-mrr-018": [("RA และ System Administrator ดูร่องรอยได้", "EX-mrr-058, 059"),
                   ("ผู้จอง/ผู้ใช้อื่นดูไม่ได้", "EX-mrr-060, 061")],
    "BR-mrr-019": [("ส่ง Email ไม่สำเร็จ → การกระทำล้มทันที ไม่สร้าง/ไม่เปลี่ยน", "EX-mrr-062, 063, 064"),
                   ("การกระทำที่ไม่ส่ง Email ไม่ล้มตาม", "EX-mrr-065")],
    "BR-mrr-020": [("งานเตือนส่งไม่สำเร็จ → บันทึกส่งไม่สำเร็จ ไม่ส่งซ้ำ", "EX-mrr-066, 067")],
    "BR-mrr-021": [("ผู้จอง/ผู้เข้าร่วมเห็นรายละเอียดในปฏิทิน", "EX-mrr-068, 069"),
                   ("คนอื่นเห็นแค่ 'ไม่ว่าง'", "EX-mrr-070, 071")],
    "BR-mrr-022": [("RA ดูรายงานได้", "EX-mrr-072"),
                   ("System Administrator / General User ดูไม่ได้", "EX-mrr-073, 074")],
    "BR-mrr-023": [("เตือนครั้งเดียวต่อการจอง", "EX-mrr-075"),
                   ("งานรันซ้ำต้องข้าม", "EX-mrr-076"),
                   ("Email ที่ส่งทันทีตอนจองนับเป็นครั้งเดียว", "EX-mrr-077")],
    "BR-mrr-024": [("ส่งรหัสไม่สำเร็จ → ล้มทันที ไม่มีคิวส่งซ้ำ", "EX-mrr-092, 093"),
                   ("ขอใหม่หลังล้ม ไม่ถูกกันการขอซ้ำ", "EX-mrr-094"),
                   ("ขอรหัสสำเร็จ ข้อความเป็นกลาง", "EX-mrr-091")],
    "BR-mrr-025": [("ขอซ้ำขณะรหัสยังใช้ได้ → error ไม่ออกรหัสใหม่", "EX-mrr-095"),
                   ("หมดอายุพอดี 10:00 ขอใหม่ได้", "EX-mrr-096"),
                   ("รหัสถูกใช้แล้วขอใหม่ได้", "EX-mrr-097")],
    "BR-mrr-026": [("Email นอกรายชื่อ/บัญชีไม่ active ได้ข้อความเดียวกัน แต่ไม่ส่งรหัส", "EX-mrr-098, 099"),
                   ("Email ในรายชื่อได้รหัส", "EX-mrr-091")],
    "BR-mrr-027": [("รหัส 6 หลักอายุ 10 นาที ขอบ 09:59/10:00", "EX-mrr-100, 101"),
                   ("รหัสกับ magic link ใช้ร่วมกันครั้งเดียว", "EX-mrr-102, 103")],
    "BR-mrr-028": [("รหัสผิด/หมดอายุ/ถูกใช้ ไม่สร้าง session", "EX-mrr-101, 102, 104"),
                   ("กรอกผิดไม่ทำให้รหัสเสีย", "EX-mrr-105")],
}


def hi_pri(brs):
    ps = [PRI.get(b.split("@")[0], "Low") for b in brs]
    return sorted(ps, key=RANK.index)[0]


# ---------- สร้างเคส ----------
rows = []
seq = {}
for ex in sorted(EX):
    if ex in EXISTING or ex in PARTIAL_EXISTING or ex in SUPERSEDED:
        continue
    if ex not in META:
        sys.exit(f"ไม่มี metadata สำหรับ {ex}")
    d, mt = EX[ex], META[ex]
    prefix = f"TC-{mt['fn']}-{mt['ui']}"
    if ex == "EX-mrr-004":
        tcid = "TC-BKG-UI006-022"
    elif ex == "EX-mrr-081":
        tcid = "TC-BKG-UI006-028"
    else:
        seq[prefix] = seq.get(prefix, 100) + 1
        tcid = f"{prefix}-{seq[prefix]}"
    typ = mt["typ"] or TYPE_OF[d["kind"]]
    steps = (f"1. เตรียม: {mt['pre']}  2. ทำ: {d['when']}  3. ตรวจ: ผลลัพธ์ตามช่อง Expected "
             f"{'(ส่งผ่าน session ของบทบาทนั้นโดยตรง)' if API in mt['note'] else ''}").strip()
    br_txt = " / ".join(b.replace("@v1", "").replace("@v2", " v2") if False else b for b in d["brs"])
    rows.append({
        "TC ID": tcid, "Requirement ID": f"{br_txt} / {ex}", "Function": mt["fn"],
        "Screen": mt["ui"], "Scenario": f"[{d['kind']}] {d['when']}", "Type": typ,
        "Pre-condition": f"[Inferred] {mt['pre']}",
        "Test Data": "ผู้ใช้/ห้องสังเคราะห์ (หัวข้อขึ้นต้น E2E) · วันที่ใช้วันอนาคตแบบสุ่ม ไม่ใช้วันที่ใน EX · ดู §C",
        "Steps": steps, "Expected Result": f"[Explicit {ex}] {d['then']}",
        "Priority": hi_pri(d["brs"]), "Test Level": "E2E", "Data Source": mt["ds"],
        "Automation": mt["auto"], "Tag": "AI-generated",
        "Note": mt["note"] or "",
    })

# ---------- เขียน CSV ----------
cols = list(rows[0].keys())
buf = io.StringIO()
w = csv.DictWriter(buf, fieldnames=cols, lineterminator="\n")
w.writeheader(); w.writerows(rows)
(QA / "t1-test-cases.csv").write_text("\ufeff" + buf.getvalue(), encoding="utf-8")

# ---------- เขียน markdown ----------
def esc(s): return str(s).replace("|", "\\|").replace("\n", " ")
out = []
out.append("# รายงาน T1 — สร้าง Test Case (E2E) · REQ-mrr-001 ถึง 005\n")
out.append("วันที่: 2026-11-17 · Test Level: E2E · ขอบเขต: ทั้ง 5 REQ (28 BR ที่ใช้อยู่ · 105 EX) · ใช้ template T1 ของ [qa-playbook.md](qa-playbook.md)\n")
out.append("ไฟล์ที่เกี่ยวข้อง: [t1-test-cases.csv](t1-test-cases.csv) (นำเข้า Excel/Test Management ได้) · สร้างโดย [t1-generate.py](t1-generate.py) (`python docs/qa/t1-generate.py`)\n")
out.append("> **สถานะ: ร่างสำหรับ QA review** — ทุกเคส Tag = AI-generated · ต้องมี QA 1 คนตรวจก่อนนำเข้า · ยังไม่ได้เขียนสคริปต์ Playwright และ **ยังไม่ได้รันอะไรเลย** (T1 คือขั้นออกแบบเคส)\n")
out.append("## 0. สรุป\n")
n_new = len(rows)
by_auto = {k: sum(1 for r in rows if r['Automation'] == k) for k in ("Yes", "Partial", "No")}
by_pri = {k: sum(1 for r in rows if r['Priority'] == k) for k in RANK}
out.append(f"- EX ทั้งหมด **{len(EX)}** รายการ · มีสคริปต์แล้ว **{len(EXISTING)}** (ไม่สร้างซ้ำ) · คลุมบางส่วน **{len(PARTIAL_EXISTING)}** · ไม่สร้างเคส **{len(SUPERSEDED)}** (ถูก v2 แทน) · **เคสใหม่ {n_new}**")
out.append(f"- เคสใหม่ตาม Automation: **Yes {by_auto['Yes']}** (เขียนได้ด้วย dev stack ตอนนี้) · **Partial {by_auto['Partial']}** (ต้องเตรียมข้อมูล §C) · **No {by_auto['No']}** (ต้องมีกลไกที่ยังไม่มี §D)")
out.append("- Priority: " + " · ".join(f"{k} {v}" for k, v in by_pri.items()) + " — ตาม §3.3 ของ playbook ซึ่งเป็น [Recommended] รอ PO ยืนยัน")
out.append("- Data Source: เคสใหม่ทั้งหมดออกแบบเป็น `real` (คุยกับ API/DB จริง) — ไม่มีเคส stub ใหม่ เพราะ stub พิสูจน์ได้แค่หน้าจอ ไม่ใช่กฎ")
out.append("- **ข้อควรระวัง:** เคสส่วนใหญ่ต้องการผู้ใช้หลายบทบาทและการควบคุมเวลา ซึ่ง dev stack ตอนนี้ไม่มี (มีผู้ใช้ล็อกอินคนเดียว `tester@mrr.local`) จึงเขียนสคริปต์ได้ทันทีเพียงส่วนน้อย\n")

out.append("## A) Test Condition\n")
out.append("| Condition ID | Condition | Source (BR / EX) |\n|---|---|---|")
for br in sorted(COND, key=lambda s: (s.split('@')[0], s)):
    n = br.split("@")[0].replace("BR-mrr-", "")
    for i, (c, e) in enumerate(COND[br], 1):
        out.append(f"| TCND-{n}-{i:02d} | {esc(c)} | {br} · {esc(e)} |")
out.append("\nหมายเหตุ: BR-mrr-010@v1 ถูก @v2 แทน — ไม่แตก condition จาก v1 (ดู OQ-T1-06)\n")

out.append("## B) Test Case\n")
out.append("### B1. เคสที่มีสคริปต์แล้ว — ใช้ TC ID เดิม ไม่สร้างซ้ำ\n")
out.append("| EX | TC เดิม | หมายเหตุ |\n|---|---|---|")
note_ex = {"EX-mrr-004": ""}
for ex, tc in EXISTING.items():
    out.append(f"| {ex} | {tc} | {'พิสูจน์ที่ชั้น stub เท่านั้น ไม่พิสูจน์ว่า \"ไม่เกิดการจอง\" (DQ-mrr-005 open)' if ex=='EX-mrr-062' else ('ผู้จองคนเดียวกัน ยังไม่พิสูจน์ \"ผู้ใช้อีกคน\"' if ex=='EX-mrr-003' else '')} |")
for ex, tc in PARTIAL_EXISTING.items():
    out.append(f"| {ex} | {tc} (บางส่วน) | เสนอเพิ่ม assertion ใน TC เดิมว่า U2/U3 ไม่ได้รับอีเมล — ต้องมีผู้ใช้ที่สอง/สาม |")
out.append("")
out.append(f"EX-mrr-031, 032 (BR-mrr-010@v1): ไม่สร้างเคส — ถูก v2 แทนและไม่มี AC (ตาม t2-coverage-report ข้อ 3)\n")
out.append(f"### B2. เคสใหม่ ({n_new} เคส)\n")
out.append("คอลัมน์เต็มอยู่ใน CSV · ตารางนี้แสดงคอลัมน์สำคัญ · Pre-condition/Test Data/Steps/Expected เต็มดูใน CSV\n")
out.append("| TC ID | Requirement ID | Type | Priority | Data Source | Automation | Scenario (เมื่อ) | Expected Result (ต้องได้) |\n|---|---|---|---|---|---|---|---|")
for r in rows:
    out.append(f"| {r['TC ID']} | {esc(r['Requirement ID'])} | {r['Type']} | {r['Priority']} | {r['Data Source']} | {r['Automation']} | {esc(r['Scenario'])} | {esc(r['Expected Result'])} |")
out.append("")
out.append("**นิยาม Automation:** Yes = เขียนสคริปต์ได้ด้วย dev stack ตอนนี้ · Partial = ต้องเตรียมข้อมูล/ผู้ใช้ตาม §C · No = ต้องมีกลไกที่ยังไม่มีตาม §D\n")
out.append("**หมายเหตุ ID:** เคสใหม่ใช้เลขลำดับตั้งแต่ 101 ต่อท้ายของแต่ละ `TC-<Function>-<Screen>` เพื่อไม่ชนเลขที่ test/README ใช้ไปแล้ว (UI006: 019–027) · `TC-BKG-UI006-022` (EX-004) และ `TC-BKG-UI006-028` (EX-081 แบบ real) สงวนไว้ตาม README\n")

# C) test data requirement
out.append("## C) Test Data Requirement (สิ่งที่ dev ต้องเตรียม)\n")
out.append("| # | ต้องมี | ใช้กับ | หมายเหตุ |\n|---|---|---|---|")
need = [
    ("ผู้ใช้ทั่วไปเพิ่มอีก ≥ 3 คน (U2, U3, U4) ที่ล็อกอินได้ และมีกล่องจดหมายใน mailpit", "EX-004, 010, 011, 021, 030, 033, 034, 056, 061, 068–071, 083, 080", "dev ตอนนี้มีผู้ใช้ล็อกอินเดียว (`tester@mrr.local`)"),
    ("Room Administrator ≥ 2 คน (RA1, RA2) ที่ล็อกอินได้", "EX-013, 028–029, 035–045, 054–061, 078–080, 015–016, 042 และอื่น ๆ", "ต้อง 2 คน เพราะกฎ 'คนอื่นที่ไม่ใช่คนแก้อนุมัติ' (BR-014) และ 'ผู้อนุมัติประจำห้อง' (BR-013)"),
    ("System Administrator ≥ 1 คน", "EX-018, 059, 073, 088, 089", "พิสูจน์ว่าบทบาทนี้ถูกปฏิเสธ (ห้ามแก้ห้อง/ดูรายงาน/เปลี่ยนผล)"),
    ("บัญชี HR ที่ไม่ active (U5) และอีเมลนอกรายชื่อ (U9)", "EX-098, 099", "ข้อมูลสังเคราะห์เท่านั้น ห้ามใช้อีเมลพนักงานจริง"),
    ("ห้อง E2E เฉพาะ: ห้องไม่ต้องอนุมัติ, ห้องต้องอนุมัติ (ไม่กำหนดผู้อนุมัติ), ห้องต้องอนุมัติ + กำหนด RA1, ห้องปิดปรับปรุงที่มีการจองเดิม", "EX-004, 013, 016, 039–042, 081–083 ฯลฯ", "อย่าแก้ห้อง A/B ของ dev ตรง ๆ — ใช้ห้อง E2E เฉพาะเพื่อไม่กระทบ suite เดิม · วิธีลบห้อง (DQ-mrr-003 open)"),
    ("สิ่งอำนวยความสะดวก ≥ 2 รายการใน dev", "BR-002 (อุปกรณ์เสริม)", "dev มี 0 รายการ จึงทดสอบกับ API จริงไม่ได้ (test/README)"),
    ("fixture รายงานตาม GD-mrr-001 (ห้อง A–E เดือน ต.ค. 2569: ชั่วโมงทำการ 13,200 นาที, ห้อง D ปิดซ่อม 3,000 นาที, ห้อง E ชั่วโมงทำการ 0)", "EX-084–087, 047–049", "ใช้เลขเฉลย GD-mrr-001 (status validated) · ต้อง seed การจองหลายสถานะ"),
    ("การจองที่ผ่านเวลาจบประชุมแล้ว", "EX-043, 045, 046", "สร้างด้วยการย้อนเวลา หรือ seed ตรงใน DB ที่ test ใช้เท่านั้น [TBD]"),
]
for i, (a, b, c) in enumerate(need, 1):
    out.append(f"| {i} | {a} | {b} | {c} |")
out.append("\nกติกาข้อมูล: ใช้ข้อมูลสังเคราะห์ · หัวข้อขึ้นต้น `E2E` · วันที่ในอนาคตแบบสุ่มเพื่อไม่ชนกัน (วันที่ใน EX เช่น 17/10 เป็นตัวอย่างเชิงตรรกะ ไม่ใช่วันที่ต้องใช้จริง)\n")

# D) open questions
out.append("## D) Open Questions (TBD)\n")
out.append("| ID | คำถาม | กระทบ | ผู้ตอบที่เสนอ |\n|---|---|---|---|")
oq = [
    ("OQ-T1-01", "ฝั่งเซิร์ฟเวอร์ควบคุมเวลาให้เทสต์ได้หรือไม่ (เช่น ตัวแปร/endpoint เฉพาะ dev ให้ตั้ง 'เวลาปัจจุบัน') — Playwright `page.clock` เปลี่ยนเวลาเฉพาะ browser ไม่เปลี่ยนเวลาของ API/DB", f"เคส Automation=No ที่มี 'CLK' — ขอบเขตเวลา 09:59/10:00, อายุรหัส 10 นาที, ตัดสิทธิ์ที่เวลาเริ่มประชุม", "Dev lead"),
    ("OQ-T1-02", "สั่งงานตามเวลา (เตือน 15 นาที, ยกเลิกอัตโนมัติ) ให้รันตามต้องการจากเทสต์ได้หรือไม่ (endpoint/CLI เฉพาะ dev)", "BR-008, 016, 020, 023 ทั้งหมด (EX-020, 023, 025, 050–053, 066, 067, 075–077)", "Dev lead"),
    ("OQ-T1-03", "จำลองอีเมลล่มแบบ real ได้อย่างไร (หยุด mailpit / ตั้ง SMTP ผิดเฉพาะเทสต์) และ transaction boundary เมื่อส่งไม่สำเร็จคืออะไร", "BR-019, 024 (EX-052, 062–065, 092–094) — เกี่ยวกับ DQ-mrr-005 และ DQ-mrr-014 ที่ยัง open", "Dev lead + PO"),
    ("OQ-T1-04", "ผู้ใช้ 'ปุ่มถูกซ่อน' (EX-010, 014, 017, 018, 048, 060, 061, 073, 074) — ยอมรับให้ทดสอบด้วยการยิงคำสั่งตรงผ่าน session ของ browser (Playwright `request`) เป็น E2E หรือควรจัดเป็นระดับ API", "การจัดระดับเคสต่อ Test Level", "QA Lead"),
    ("OQ-T1-05", "EX ที่อ้าง 'ผู้ใช้อีกคน' (EX-003, 004) ยอมรับผู้จองคนเดียวกันได้หรือไม่ เพราะ test/README ใช้ผู้จองคนเดียวมาก่อน", "EX-003, 004 และความหมายของ 'พิสูจน์ข้ามผู้ใช้'", "PO"),
    ("OQ-T1-06", "ยืนยันว่า EX-mrr-031/032 (BR-mrr-010@v1 ถูกแทนด้วย v2) ไม่ต้องมีเคส", "EX-031, 032", "BA / PO"),
    ("OQ-T1-07", "ตัวเลขรายงานในเคสรายงาน (EX-084–087) ผูกกับ GD-mrr-001 · DQ-mrr-010 (decimal ใน DB) ยัง open — หน้าจอแสดง 2 ตำแหน่งตาม EX แต่ไม่ได้ระบุว่าเก็บกี่ตำแหน่ง", "EX-084–087", "PO"),
    ("OQ-T1-08", "ปฏิทิน: DQ-mrr-011 (หัวหน้าเห็นรายละเอียดลูกน้องไหม) ยัง open — EX-068–071 ไม่คลุมกรณีนี้ จึงไม่เขียนเคส", "BR-021", "PO"),
    ("OQ-T1-09", "NFR-mrr-001–004 (โหลด 200 คน, HTTPS, uptime) ไม่ใช่ระดับ E2E — ไม่อยู่ในขอบเขต T1 รอบนี้ (ดู t2-coverage-report ช่องว่างข้อ 1 และ Q-mrr-004)", "NFR", "PO"),
]
for r in oq:
    out.append("| " + " | ".join(esc(x) for x in r) + " |")
out.append("\n## Next Actions\n")
out.append("1. QA review เคสใหม่ตาม CSV (ปัจจุบัน Tag = AI-generated ทั้งหมด)")
out.append("2. ตอบ OQ-T1-01, 02 และเตรียมผู้ใช้/ข้อมูลตาม §C — ปลดล็อกเคส Partial/No เป็นส่วนใหญ่")
out.append("3. เริ่มเขียนสคริปต์จากเคส `Automation = Yes` ก่อน (ไม่ต้องรอข้อมูลเพิ่ม)")
out.append("4. หลังเขียนสคริปต์ ให้รัน T2 อีกครั้ง (Gate G1) แล้วอัปเดต `docs/qa/e2e-ex-map.json`")

(QA / "t1-test-cases.md").write_text("\n".join(out) + "\n", encoding="utf-8")
print(f"EX={len(EX)} existing={len(EXISTING)} partial={len(PARTIAL_EXISTING)} superseded={len(SUPERSEDED)} new={n_new} auto={by_auto} pri={by_pri}")
