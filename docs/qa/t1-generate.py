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

# EX ที่เพิ่มหลัง docs/requirements ถูกสร้าง (EX-106..110) อ่านจาก docs/wiki/examples แทน
for f in sorted((ROOT / "docs" / "wiki" / "examples").glob("EX-mrr-*.md")):
    if f.stem in EX:
        continue
    t = f.read_text(encoding="utf-8")
    kind = re.search(r"^kind: (\w+)", t, re.M).group(1)
    brs = re.search(r"^proves: \[(.*?)\]", t, re.M).group(1).split(",")
    sec = lambda h: re.search(rf"^## {h}[^\n]*\n(.*?)(?=^## |\Z)", t, re.M | re.S).group(1).strip()
    EX[f.stem] = dict(brs=[b.strip() for b in brs], kind=kind, when=sec("เมื่อ"), then=sec("แล้ว"), req="wiki")

# CHG-mrr-003 (2026-11-18): EX บางข้อพิสูจน์ทั้ง @v1 และ @v2 · ให้ TC ผูกกับเวอร์ชันปัจจุบัน (สูงสุด) ของแต่ละ BR
for f in sorted((ROOT / "docs" / "wiki" / "examples").glob("EX-mrr-*.md")):
    if f.stem not in EX:
        continue
    pm = re.search(r"^proves: \[(.*?)\]", f.read_text(encoding="utf-8"), re.M)
    best = {}
    for b in (x.strip() for x in pm.group(1).split(",")):
        bid, _, ver = b.partition("@v")
        best[bid] = max(best.get(bid, 0), int(ver or 1))
    EX[f.stem]["brs"] = [f"{k}@v{v}" for k, v in best.items()]

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
    "EX-mrr-119": "TC-BKG-UI006-104 (§B4 · ผูกเพิ่มตามคำตัดสิน QA 2026-11-18)",
}
# EX-019 ถูกคลุมบางส่วนโดย TC-BKG-UI006-026 (Email ถึงผู้จอง) — ไม่คลุม "U2/U3 ไม่ได้รับ"
PARTIAL_EXISTING = {"EX-mrr-019": "TC-BKG-UI006-026"}
# EX-031/032 เดิมพิสูจน์ BR-mrr-010@v1 แล้ว BA/PO เลือกเขียนใหม่ให้ตรง v2 (ทางเลือก B · docs/qa/decision-ex-031-032.md)
# — ตอนนี้เป็น EX ปกติของ v2 · เลข TC คงที่ต่อท้ายชุด UI013 เพื่อไม่ให้ TC-RMM-UI013-101… ของ EX อื่นเลื่อน
SUPERSEDED = {}
FIXED_TC = {"EX-mrr-031": "TC-RMM-UI013-108", "EX-mrr-032": "TC-RMM-UI013-109",
            "EX-mrr-109": "TC-RMM-UI013-110", "EX-mrr-110": "TC-RMM-UI013-111",
            # 104–106 ถูก §B4 (อุปกรณ์เสริม) ใช้แล้ว — ห้ามชน
            "EX-mrr-113": "TC-BKG-UI006-107"}

# ---------- metadata: fn, ui, type|None, data_source, automation, pre-condition, note ----------
# automation: Yes = เขียนสคริปต์ได้ด้วย dev stack ตอนนี้ · Partial = ต้องเตรียมข้อมูล (ดูส่วน C)
#             No = ต้องมีกลไกที่ยังไม่มี (ดูส่วน D)
A = "Yes"; P = "Partial"; N = "No"
R = "real"; S = "stub"

def m(fn, ui, ds, auto, pre, typ=None, note=""):
    return dict(fn=fn, ui=ui, ds=ds, auto=auto, pre=pre, typ=typ, note=note)

U2 = "ต้องมีผู้ใช้ทั่วไปคนที่ 2"
RA = "ต้องมีผู้ใช้ Room Administrator"
CLK = "ควบคุมเวลาด้วย /__test/clock (support/clock.ts) · OQ-T1-01 ปิดแล้ว"
JOB = "งานตามเวลา: สั่งรันตามต้องการด้วย /__test/jobs/run · OQ-T1-02 ปิดแล้ว"
MAILF = "อีเมลล่มจริง: หยุด container mailpit (support/mail.ts) · OQ-T1-03 ปิดแล้ว"
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
    # --- เพิ่ม 2026-11-18: ค้นหาห้องว่าง (UC-mrr-001) และลบห้อง (UC-mrr-015) ---
    "EX-mrr-106": m("BKG", "UI004", R, P, "ห้อง A ความจุ 10 ว่าง 13:00–14:00 · ห้อง B ความจุ 4", note="ต้องมีห้อง E2E ที่กำหนดความจุ 10 และ 4 (สร้างได้ด้วยชุดเดียวกับ EX-015) · ชื่อปุ่ม 'ไปหน้าจอง' อ้างตาม EX"),
    "EX-mrr-107": m("BKG", "UI004", R, P, "ทุกห้องมีการจองทับ 13:00–14:00 หรือปิดปรับปรุง", note="'ทุกห้อง' = ทุกห้องในระบบ (OQ-T1-11 ตอบแล้ว) → ต้องทำให้ทุกห้องใน dev ถูกจองทับหรือปิดปรับปรุงในช่วงนั้น ห้องที่ไม่ใช่ห้อง E2E ต้องไม่ว่าง"),
    "EX-mrr-108": m("BKG", "UI004", R, P, "ห้อง B มีการจอง PENDING_APPROVAL 13:00–14:00 ทับช่วงที่ค้นหา · ห้อง C ปิดปรับปรุง", typ="Boundary", note="ห้อง B ต้องเป็นห้องต้องอนุมัติ · ห้อง C ตั้งปิดปรับปรุงด้วย RA · " + RA),
    "EX-mrr-109": m("RMM", "UI013", R, P, "RA ล็อกอิน · ห้อง A ไม่มีการจอง", note=RA + " · ต้องตรวจทั้งผลค้นหา หน้าจอง และสถานะในฐานข้อมูล · ห้องที่ archive แล้วเปิดกลับไม่ได้ (STM-mrr-003) ต้องสร้างห้อง E2E ใหม่ทุกรอบ"),
    "EX-mrr-110": m("RMM", "UI013", R, A, "ห้อง A ความจุ 8 · U1 (General User) ล็อกอิน", note=API + " · ตรวจว่าห้อง A ไม่ ARCHIVED และยังค้นหา/จองได้"),
    # --- รอบ 2026-11-18 (CHG-mrr-003): EX-111..122 ---
    "EX-mrr-111": m("NTF", "JOB", R, P, "U1 จองห้อง A 10:00–11:00 ผู้เข้าร่วม U2, U3 · อีเมลใช้งานได้ · งานรัน 09:45", note=JOB + " · " + CLK + " · ตรวจกล่องอีเมลของ 3 คน และ bookings.reminder_status = SENT (OQ-T1-14 ปิดแล้ว)"),
    "EX-mrr-112": m("NTF", "JOB", R, P, "เหมือน EX-111 แต่อีเมลของ U3 ส่งไม่สำเร็จ", note=JOB + " · " + CLK + " · สคริปต์เป็น test.fixme — ต้องทำให้ SMTP ปฏิเสธเฉพาะผู้รับ U3 (mailpit หยุดทั้งตัวทำไม่ได้ ซ้ำกับ TC-NTF-JOB-104) [TBD] OQ-T1-15 · ต่อด้วย EX-067 (งาน 09:50 ไม่ส่งซ้ำ)"),
    "EX-mrr-113": m("BKG", "UI006", R, P, "ห้อง A (ไม่ต้องอนุมัติ) ว่าง 13:00–14:00 · อีเมลใช้งานได้", note="ตรวจว่าไม่มีข้อความ 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง' · ใกล้เคียง TC-BKG-UI006-026 (Email ถึงผู้จอง) แต่ EX นี้ตรวจฝั่งไม่มีข้อความล้ม"),
    "EX-mrr-114": m("NTF", "UI006", R, P, "ห้อง B (ต้องอนุมัติ) ว่าง 10:00–11:00 · อีเมลใช้งานได้", note="ตรวจเชิงลบ: ไม่มีอีเมล 'จองสำเร็จ' ถึงใครใน mailpit · ต้องรอพอให้ยืนยันว่า 'ไม่มี' (ระบุเวลารอ)"),
    "EX-mrr-115": m("NTF", "UI009", R, P, "การจองห้อง B ของ U1 PENDING_APPROVAL ผู้เข้าร่วม U2 · RA ล็อกอิน", note=RA + " · " + U2 + " · ทับกับ EX-013 (อนุมัติ) — เคสนี้เพิ่มเฉพาะ Email ถึง U1 และ U2 ไม่ได้"),
    "EX-mrr-116": m("NTF", "UI008", R, P, "การจองห้อง A ของ U1 ผู้เข้าร่วม U2, U3 ยังไม่ถึงเวลาเริ่ม · U1 ล็อกอิน", note=U2 + " · ทับกับ EX-009 (ผู้จองยกเลิกเอง) — เคสนี้เพิ่มเฉพาะ Email ถึงทั้ง 3 คน"),
    "EX-mrr-117": m("NTF", "UI010", R, N, "การจองห้อง A ของ U1 ผู้เข้าร่วม U2, U3 · เวลาปัจจุบัน 10:30 (เริ่มไปแล้ว) · RA ล็อกอิน", note=RA + " · " + CLK + " · ทับกับ EX-028 (RA ยกเลิกแทน) — เคสนี้เพิ่มเฉพาะ Email ถึงทั้ง 3 คน"),
    "EX-mrr-118": m("NTF", "UI009", R, N, "การจองห้อง B ของ U1 PENDING_APPROVAL ผู้เข้าร่วม U2 · เวลาปัจจุบัน 16/10 14:10 · RA ล็อกอิน", note=RA + " · " + CLK + " · พิสูจน์ 2 กฎ (BR-007@v2 Email ปฏิเสธ + BR-017@v2 ร่องรอย) ในเคสเดียว · ถ้าตรวจแยกให้ไล่ตามเคส EX-120"),
    "EX-mrr-120": m("AUD", "UI010", R, P, "การจองห้อง B ของ U1 PENDING_APPROVAL · เวลาปัจจุบัน 16/10 14:10 · RA1 ล็อกอิน", note=RA + " · " + CLK + " · ทับกับ EX-118 แต่ตรวจเฉพาะร่องรอย (ค่าช่อง 'การกระทำ' = 'ปฏิเสธการจอง')"),
    "EX-mrr-121": m("AUD", "UI010", R, P, "การจองห้อง B ของ U1 CONFIRMED · เวลาปัจจุบัน 16/10 15:00 · RA1 ล็อกอิน", note=RA + " · " + CLK + " · ค่าช่อง 'การกระทำ' = 'ถอยผล'"),
    "EX-mrr-122": m("AUD", "UI010", R, P, "การจองห้อง A ของ U1 หัวข้อ 'ประชุมทีม' · เวลาปัจจุบัน 18/10 10:30 (เริ่มไปแล้ว) · RA1 ล็อกอิน", note=RA + " · " + CLK + " · ค่าช่อง 'การกระทำ' = 'แก้แทนผู้จอง'"),
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
    "EX-mrr-031": m("RMM", "UI013", R, A, "U1 จองห้อง A (ไม่ต้องอนุมัติ) 18/10 แล้ว RA แก้ห้อง A เป็นต้องอนุมัติ", note=RA + " · ใช้ห้อง E2E-FLIP · เขียนใหม่ให้ตรง BR-mrr-010@v2"),
    "EX-mrr-032": m("RMM", "UI013", R, A, "U1 จองห้อง B (ต้องอนุมัติ) 18/10 รออนุมัติ แล้ว RA แก้ห้อง B เป็นไม่ต้องอนุมัติ", note=RA + " · ใช้ห้อง E2E-FLIP · เขียนใหม่ให้ตรง BR-mrr-010@v2"),
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
                   ("การจองที่ถูกยกเลิกไม่กันช่วงเวลา", "EX-mrr-004"),
                   ("ค้นหาห้องว่าง: แสดงเฉพาะห้องที่ความจุพอ ไม่ถูกจองทับ · ไม่พบห้องแสดงข้อความแนะนำ", "EX-mrr-106, 107"),
                   ("ค้นหาห้องว่าง: การจองรออนุมัติกันช่วงเวลา · ห้องปิดปรับปรุงไม่แสดง", "EX-mrr-108")],
    "BR-mrr-002": [("หัวข้อ+ผู้เข้าร่วมครบ อุปกรณ์เสริมไม่บังคับ", "EX-mrr-005"),
                   ("ขาดหัวข้อ", "EX-mrr-006"), ("ขาดผู้เข้าร่วม", "EX-mrr-007"),
                   ("เลือกอุปกรณ์เสริม 1 รายการ → การจองบันทึกอุปกรณ์นั้น", "EX-mrr-119")],
    "BR-mrr-003": [("แก้ไข/ยกเลิกของตัวเอง", "EX-mrr-008, 009"),
                   ("แก้ไข/ยกเลิกของผู้อื่น (ยิงตรง) ต้องปฏิเสธ", "EX-mrr-010"),
                   ("หน้าการจองของฉันแสดงเฉพาะของตัวเอง", "EX-mrr-011")],
    "BR-mrr-004": [("ห้องต้องอนุมัติ → PENDING_APPROVAL → CONFIRMED", "EX-mrr-012, 013"),
                   ("ผู้จองอนุมัติเองไม่ได้", "EX-mrr-014"),
                   ("ห้องไม่ต้องอนุมัติ → CONFIRMED ทันที", "EX-mrr-001")],
    "BR-mrr-005": [("เพิ่ม/แก้/ปิดปรับปรุงห้อง โดย RA", "EX-mrr-015, 016"),
                   ("General User / System Administrator ทำไม่ได้", "EX-mrr-017, 018, 090"),
                   ("ลบห้อง = ARCHIVED ไม่แสดงในค้นหา/จอง โดย RA", "EX-mrr-109"),
                   ("ผู้ที่ไม่ใช่ RA ลบห้องไม่ได้ ห้องไม่เปลี่ยน", "EX-mrr-110")],
    "BR-mrr-006": [("อัตราการใช้งาน = นาทีที่จองใช้ได้ ÷ นาทีทำการ × 100 ปัด round half up 2 ตำแหน่ง", "EX-mrr-084"),
                   ("ขอบเขตชั่วโมงทำการ (หลัง 18:00 / เสาร์ไม่นับ)", "EX-mrr-085"),
                   ("ตัวหารหักช่วงปิดปรับปรุง", "EX-mrr-086"),
                   ("ตัวหาร 0 แสดง '—' ไม่จัดอันดับ", "EX-mrr-087")],
    "BR-mrr-007": [("จองสำเร็จ → Email ถึงผู้จองเท่านั้น", "EX-mrr-019"),
                   ("ใกล้เริ่ม/เปลี่ยนเวลา → ถึงผู้จองและผู้เข้าร่วมทุกคน", "EX-mrr-020, 021"),
                   ("แก้เฉพาะหัวข้อไม่ส่ง Email", "EX-mrr-022"),
                   ("การจองรออนุมัติยังไม่ส่ง 'จองสำเร็จ' (กฎ v2)", "EX-mrr-114"),
                   ("อนุมัติ → Email 'อนุมัติแล้ว' ถึงผู้จองเท่านั้น (กฎ v2)", "EX-mrr-115"),
                   ("ยกเลิก (ผู้จอง/RA) → Email 'ยกเลิกการจอง' ถึงผู้จองและผู้เข้าร่วมทุกคน (กฎ v2)", "EX-mrr-116, 117"),
                   ("ปฏิเสธ → Email 'ปฏิเสธการจอง' ถึงผู้จองและผู้เข้าร่วมทุกคน (กฎ v2)", "EX-mrr-118")],
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
                   ("เปิดห้องกลับแล้วจองได้", "EX-mrr-083"),
                   ("ค้นหาห้องว่างไม่แสดงห้องปิดปรับปรุง", "EX-mrr-106, 107, 108")],
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
                   ("การกระทำของผู้จองเอง/ที่ล้มเหลว ไม่บันทึก", "EX-mrr-056, 057"),
                   ("ค่าช่อง 'การกระทำ' ปฏิเสธการจอง / ถอยผล / แก้แทนผู้จอง (กฎ v2)", "EX-mrr-118, 120, 121, 122")],
    "BR-mrr-018": [("RA และ System Administrator ดูร่องรอยได้", "EX-mrr-058, 059"),
                   ("ผู้จอง/ผู้ใช้อื่นดูไม่ได้", "EX-mrr-060, 061")],
    "BR-mrr-019": [("ส่ง Email ไม่สำเร็จ → การกระทำล้มทันที ไม่สร้าง/ไม่เปลี่ยน", "EX-mrr-062, 063, 064"),
                   ("การกระทำที่ไม่ส่ง Email ไม่ล้มตาม", "EX-mrr-065"),
                   ("Email ปกติ → จองสำเร็จ ไม่มีข้อความล้ม", "EX-mrr-113")],
    "BR-mrr-020": [("งานเตือนส่งไม่สำเร็จ → บันทึกส่งไม่สำเร็จ ไม่ส่งซ้ำ", "EX-mrr-066, 067"),
                   ("ส่งเตือนสำเร็จครบทุกคน → บันทึก 'ส่งสำเร็จ'", "EX-mrr-111"),
                   ("ผู้รับบางคนล้ม → นับล้มทั้งการจอง ไม่แยกรายคน (กฎ v2)", "EX-mrr-112")],
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
    if ex in EXISTING or ex in PARTIAL_EXISTING:
        continue
    if ex not in META:
        sys.exit(f"ไม่มี metadata สำหรับ {ex}")
    d, mt = EX[ex], META[ex]
    prefix = f"TC-{mt['fn']}-{mt['ui']}"
    if ex == "EX-mrr-004":
        tcid = "TC-BKG-UI006-022"
    elif ex == "EX-mrr-081":
        tcid = "TC-BKG-UI006-028"
    elif ex in FIXED_TC:
        tcid = FIXED_TC[ex]
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

# ---------- เคสที่เขียนสคริปต์แล้ว: อ่านจากชื่อเคสใน test/e2e/*.spec.ts ----------
SCRIPTED = {}
for f in sorted((ROOT / "test" / "e2e").glob("*.spec.ts")):
    for tc in set(re.findall(r"(TC-[A-Z]+-[A-Z0-9]+-\d+)", f.read_text(encoding="utf-8"))):
        SCRIPTED[tc] = f.name
# เคสที่สคริปต์สร้างชื่อจาก loop (`TC-AUD-UI010-${tc}` ใน t1-roles.spec.ts) — regex ข้างบนอ่านเลข TC ที่เขียนตรง ๆ ไม่เจอ
# ผู้ review พบ 2026-11-18 ว่า TC-AUD-UI010-107/108 ถูกรายงานว่า "ไม่มีสคริปต์" ทั้งที่มีและรันผ่านอยู่แล้ว
SCRIPTED.update({"TC-AUD-UI010-107": "t1-roles.spec.ts", "TC-AUD-UI010-108": "t1-roles.spec.ts"})
for r in rows:
    r["Script"] = SCRIPTED.get(r["TC ID"], "")

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
out.append(f"วันที่: 2026-11-17 (อัปเดตรอบ 2026-11-18 เพิ่ม EX-106–110 และรอบ 2 เพิ่ม EX-111–122 ตาม CHG-mrr-003) · Test Level: E2E · ขอบเขต: ทั้ง 5 REQ (28 BR ที่ใช้อยู่ · {len(EX)} EX) · ใช้ template T1 ของ [qa-playbook.md](qa-playbook.md)\n")
out.append("ไฟล์ที่เกี่ยวข้อง: [t1-test-cases.csv](t1-test-cases.csv) (นำเข้า Excel/Test Management ได้) · สร้างโดย [t1-generate.py](t1-generate.py) (`python docs/qa/t1-generate.py`)\n")
out.append("> **รอบ 2 (EX-111–122, CHG-mrr-003): เคสใหม่ 11 เคส (EX-119 ผูกเข้ากับ TC-BKG-UI006-104 ตามคำตัดสิน QA) · ยังไม่ผ่าน QA review · เขียนสคริปต์แล้ว 11 เคส (`t1-round2.spec.ts`; TC-NTF-JOB-110 เป็น test.fixme) · หลัง Dev แก้ตาม v2 และเจ้าของตอบเรื่องถ้อยคำ (2026-11-18): ผ่าน 10 · ล้ม 0 · ข้าม 1 (ดู §B6 · EX-118/120/122 ต้องให้ req แก้ถ้อยคำข้อความ — OQ-T1-16)** (ไม่นับใน 'review เสร็จ' ด้านล่าง) · BR-mrr-007/017/020 เป็น @v2 — เคสเดิมที่ EX ผูกทั้ง v1+v2 ถูกอัปเดตช่อง Requirement ID เป็น v2 (ถ้อยคำ Expected ของเคสเดิมไม่เปลี่ยน — ตรวจซ้ำว่ายังตรงกับ EX-019–022, 054–057, 066–067 ปัจจุบัน)\n>\n> **สถานะรอบ 1: QA review เสร็จสมบูรณ์ (completed) · ผู้ review: QA_Noppasorn · 2026-11-18 · ขอบเขต: ทุกเคส (CSV 101 เคส + §B3 ออกจากระบบ + §B4 อุปกรณ์เสริม)** — Tag ในคอลัมน์ยังเป็น AI-generated เพราะบอกที่มาของเคส ไม่ใช่สถานะ review · เขียนสคริปต์ Playwright ครบและรันกับระบบจริงแล้ว (เฉพาะเคสรอบ 1 · ข้อ 0) · ผลรันผ่านไม่ใช่การ review เคส · §B3/B4 เป็นเคส [Recommended] นอก BR (B3 PO รับแล้ว: OQ-T1-10)")
out.append("## 0. สรุป\n")
n_new = len(rows)
by_auto = {k: sum(1 for r in rows if r['Automation'] == k) for k in ("Yes", "Partial", "No")}
n_scripted = sum(1 for r in rows if r["Script"])
by_pri = {k: sum(1 for r in rows if r['Priority'] == k) for k in RANK}
out.append(f"- EX ทั้งหมด **{len(EX)}** รายการ · มีสคริปต์แล้ว **{len(EXISTING)}** (ไม่สร้างซ้ำ) · คลุมบางส่วน **{len(PARTIAL_EXISTING)}** · **เคสใหม่ {n_new}**")
out.append(f"- Automation (จัดตอนออกแบบเคส 2026-11-17 ไม่ใช่สถานะปัจจุบัน): **Yes {by_auto['Yes']}** · **Partial {by_auto['Partial']}** (ต้องเตรียมข้อมูล §C) · **No {by_auto['No']}** (ต้องมีกลไกที่ยังไม่มี) — กลไกที่ขาด (ผู้ใช้หลายบทบาท นาฬิกา งานตามเวลา อีเมลล่ม fixture รายงาน) ทำครบแล้ว ดู OQ-T1-01–03")
out.append(f"- **เขียนสคริปต์แล้ว {n_scripted} จาก {n_new} เคส** (คอลัมน์ Script ใน CSV · อ่านจากชื่อเคสใน `test/e2e/*.spec.ts` · TC-AUD-UI010-107/108 ตั้งชื่อจาก loop จึงใช้ mapping ใน t1-generate.py)")
out.append("- **ผลรัน 2026-11-18** (Chromium · ระบบจริงบน Docker · suite เต็ม): 145 ผ่าน · 1 ข้าม (NFR-005 อุปกรณ์สัมผัสบนเดสก์ท็อป ข้ามโดยออกแบบ) · 0 ล้ม · รัน 2 รอบติด ผลเหมือนกัน · ตัวเลขนี้รวมเคสเดิมนอก T1 ด้วย ไม่ใช่เฉพาะเคสในไฟล์นี้")
out.append("- Priority: " + " · ".join(f"{k} {v}" for k, v in by_pri.items()) + " — ตาม §3.3 ของ playbook ซึ่งเป็น [Recommended] รอ PO ยืนยัน")
out.append("- Data Source: เคสใหม่ทั้งหมดออกแบบเป็น `real` (คุยกับ API/DB จริง) — ไม่มีเคส stub ใหม่ เพราะ stub พิสูจน์ได้แค่หน้าจอ ไม่ใช่กฎ")
out.append("- **ข้อควรระวัง:** ผู้ใช้ 9 บัญชี ห้อง E2E นาฬิกาฝั่งเซิร์ฟเวอร์ งานตามเวลา และการหยุด mailpit พร้อมแล้ว (global-setup.ts, support/*) · สิ่งอำนวยความสะดวกใน dev พร้อมแล้ว 2 รายการ (E2E Projector, E2E Whiteboard) มีเคสใช้แล้ว §B4 · เคสที่รอ EX จาก req (OQ-T1-11, 12) · เคสออกจากระบบ §B3 มีสคริปต์แล้ว (t1-logout.spec.ts) แต่ AC-112 พิสูจน์ที่ชั้น [stub] เท่านั้น · มี 8 เคส [stub] เดิมนอก T1 (booking.spec.ts, nfr-005) ซึ่งไม่ใช่เคสใหม่\n")

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
out.append(f"### B2. เคสใหม่ ({n_new} เคส)\n")
out.append("คอลัมน์เต็มอยู่ใน CSV · ตารางนี้แสดงคอลัมน์สำคัญ · Pre-condition/Test Data/Steps/Expected เต็มดูใน CSV\n")
out.append("| TC ID | Requirement ID | Type | Priority | Data Source | Automation | Script | Scenario (เมื่อ) | Expected Result (ต้องได้) |\n|---|---|---|---|---|---|---|---|---|")
for r in rows:
    out.append(f"| {r['TC ID']} | {esc(r['Requirement ID'])} | {r['Type']} | {r['Priority']} | {r['Data Source']} | {r['Automation']} | {r['Script'] or '—'} | {esc(r['Scenario'])} | {esc(r['Expected Result'])} |")
out.append("")
out.append("**นิยาม Automation:** Yes = เขียนสคริปต์ได้ด้วย dev stack ตอนนี้ · Partial = ต้องเตรียมข้อมูล/ผู้ใช้ตาม §C · No = ต้องมีกลไกที่ยังไม่มีตาม §D\n · (ค่านี้บันทึกตอนออกแบบ — ปัจจุบันทุกเคสมีสคริปต์แล้ว ดูคอลัมน์ Script)")
out.append("**หมายเหตุ ID:** เคสใหม่ใช้เลขลำดับตั้งแต่ 101 ต่อท้ายของแต่ละ `TC-<Function>-<Screen>` เพื่อไม่ชนเลขที่ test/README ใช้ไปแล้ว (UI006: 019–027) · `TC-BKG-UI006-022` (EX-004) และ `TC-BKG-UI006-028` (EX-081 แบบ real) สงวนไว้ตาม README\n")

# C) test data requirement
out.append("### B3. [Recommended] ออกจากระบบ — ไม่มี BR/EX (AC ของ design เท่านั้น)\n")
out.append("ไม่อยู่ใน CSV เพราะกฎข้อ 3 ต้องผูก BR · ข้อความ Expected คัดจาก AC-mrr-111–113 (.aeon/design/modules/mrr/functions.json) ตรงตัวอักษร · รอ PO ยืนยัน (OQ-T1-10)\n")
out.append("| TC ID | Source | Type | Scenario | Expected Result | Data Source | Automation |\n|---|---|---|---|---|---|---|")
out.append("| TC-AUTH-UI003-101 | [Recommended] AC-mrr-111 | Positive | ผู้ใช้เข้าสู่ระบบอยู่ กดออกจากระบบ | ระบบยกเลิก session ของผู้ใช้ และแสดงหน้า 'ออกจากระบบแล้ว' พร้อมทางเข้าสู่ระบบอีกครั้ง · ตรวจเพิ่ม: ใช้ session เดิมเรียก API แล้วถูกปฏิเสธ | real | Yes · [สคริปต์แล้ว] t1-logout.spec.ts |")
out.append("| TC-AUTH-UI003-102 | [Recommended] AC-mrr-112 | Exception | ผู้ใช้เข้าสู่ระบบอยู่ แต่ยกเลิก session ไม่สำเร็จ แล้วกดออกจากระบบ | แสดง 'ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง' และยังไม่แสดงว่าออกจากระบบแล้ว | stub (เบราว์เซอร์ตอบ 500 แทน API) | Partial · [สคริปต์แล้ว] t1-logout.spec.ts · ยังไม่พิสูจน์กับ API จริง เพราะไม่มีกลไกบังคับให้ logout ล้ม |")
out.append("| TC-AUTH-UI003-103 | [Recommended] AC-mrr-113 | Positive (alternate) | ผู้ใช้ที่ยังไม่ได้เข้าสู่ระบบเปิดหน้าออกจากระบบ | แสดงหน้า 'ออกจากระบบแล้ว' พร้อมทางเข้าสู่ระบบอีกครั้ง เหมือนกับผู้ที่เพิ่งออกจากระบบ | real | Yes |")
out.append("")
out.append("### B4. [Recommended] อุปกรณ์เสริม (BR-mrr-002) — ฝั่ง \"เลือก\" ที่ EX ไม่มี")
out.append("")
out.append("ไม่อยู่ใน CSV เพราะไม่มี EX รองรับ (EX-005 คลุมฝั่ง \"ไม่เลือก\" แล้ว) · technique EP · สคริปต์ `t1-equipment.spec.ts` · ข้อมูล: E2E Projector / E2E Whiteboard (§C ข้อ 6)")
out.append("")
out.append("| TC ID | Source | Type | Scenario | Expected Result | Data Source | Script |")
out.append("|---|---|---|---|---|---|---|")
out.append("| TC-BKG-UI006-104 | [Explicit EX-mrr-119] + [Recommended] BR-mrr-002@v1 | Positive | เลือกอุปกรณ์เสริม 1 รายการแล้วจองผ่านฟอร์ม | รับการจอง (CONFIRMED) · บันทึกอุปกรณ์ตรงที่เลือกใน booking_equipment_requests | real | t1-equipment.spec.ts |")
out.append("| TC-BKG-UI006-105 | [Recommended] BR-mrr-002@v1 | Positive | เลือกอุปกรณ์เสริมทั้ง 2 รายการ | รับการจอง · บันทึกครบทั้งสอง | real | t1-equipment.spec.ts |")
out.append("| TC-BKG-UI006-106 | [Recommended] BR-mrr-002@v1 · [TBD] OQ-T1-13 | Negative | ส่งอุปกรณ์เสริมที่ไม่มีอยู่ (ยิงตรง) | 400 \"ไม่พบอุปกรณ์เสริมบางรายการ\" (ข้อความจากโค้ด) · ไม่เกิดการจอง | real | t1-equipment.spec.ts |")
out.append("")
out.append("### B5. [Recommended] ร่าง EX A/B/C — ตรวจเวลาค้นหาและข้อความยืนยันลบห้อง (ยังไม่มี EX จาก req)")
out.append("")
out.append("ประโยคมาจากคำตัดสินของ PO/BA 2026-11-18 (ตามโค้ด) · ร่าง EX อยู่ใน req-request-ex-validation-delete-2026-11-18.md · สคริปต์ `t1-draft-ex.spec.ts` · เมื่อ req ออก EX ให้ผูก TC เข้ากับ EX นั้นและเปลี่ยน Tag เป็น [Explicit] · ร่าง D (กดไม่ยืนยันตอนลบ) และ E (ลบห้องที่มีการจอง) **ไม่มีเคส** เพราะยังไม่มีคำตอบ (OQ-T1-12)")
out.append("")
out.append("| TC ID | Source | Type | Scenario | Expected Result | Data Source | Script |")
out.append("|---|---|---|---|---|---|---|")
out.append("| TC-BKG-UI004-104 | [Recommended] ร่าง EX A · BR [TBD] OQ-T1-11 | Negative | ค้นหาโดยเวลาสิ้นสุดก่อนเวลาเริ่ม (14:00 → 13:00) | ไม่ค้นหา · ไม่มีคำขอไป API · แสดง 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม' · API ยิงตรงตอบ 400 ประโยคเดียวกัน | real | t1-draft-ex.spec.ts |")
out.append("| TC-BKG-UI004-105 | [Recommended] ร่าง EX B · BR [TBD] OQ-T1-11 | Boundary | เวลาเริ่มเท่ากับเวลาสิ้นสุด (14:00 → 14:00) | เหมือน 104 (ตอบแล้วว่าเท่ากันถูกปฏิเสธ) | real | t1-draft-ex.spec.ts |")
out.append("| TC-BKG-UI004-106 | [Recommended] ขอบ BVA ฝั่งผ่านของ ร่าง EX B | Boundary | สิ้นสุดมากกว่าเริ่ม 1 นาที (14:00 → 14:01) | ค้นหาได้ ไม่มีข้อความตรวจเวลา · [Inferred] จาก 'ต้องมากกว่า' | real | t1-draft-ex.spec.ts |")
out.append("| TC-RMM-UI013-112 | [Recommended] ร่าง EX C · OQ-T1-12 | Positive | RA กดลบห้อง | ถามด้วย 'ลบห้อง <ชื่อห้อง>' + 'การลบจะเลิกใช้ห้องถาวรและเปิดกลับไม่ได้ การจองเดิมคงไว้ ยืนยันลบหรือไม่' ตรงตัวอักษร · ตอนถามห้องยัง ACTIVE | real | t1-draft-ex.spec.ts |")
out.append("")
out.append("### B5b. [Recommended] DEF-04 — ปฏิเสธโดยไม่ระบุเหตุผล (ไม่มี EX · ถ้อยคำ error ชั่วคราว)\n")
out.append("ไม่อยู่ใน CSV เพราะยังไม่มี EX ผูก · ที่มา: ตัวบท BR-mrr-017@v2 'การปฏิเสธต้องระบุเหตุผล' + EX-mrr-057 (แบบแผนของเคสเหตุผลว่างของการยกเลิกแทน) · สคริปต์ `t1-round2.spec.ts` · Dev บังคับเหตุผลแล้ว (UI-mrr-009 ช่องเหตุผล + API 400) ด้วยถ้อยคำ 'กรุณาระบุเหตุผล' ที่ req/design ยังไม่ยืนยัน (OQ-T1-17) · 2026-11-18 ผ่านทั้ง 2 เคสกับระบบจริง\n")
out.append("| TC ID | Source | Type | Scenario | Expected Result | Data Source | Script |")
out.append("|---|---|---|---|---|---|---|")
out.append("| TC-AUD-UI010-112 | [Recommended] BR-mrr-017@v2 · DEF-04 · [TBD - Require Business Confirmation] ถ้อยคำ error | Negative | RA ปฏิเสธการจอง PENDING_APPROVAL โดยเว้นเหตุผล (ไม่ส่ง / ว่าง / ช่องว่างล้วน) ผ่าน API ตรง | ปฏิเสธไม่สำเร็จ (HTTP ≥ 400) · ข้อความ 'กรุณาระบุเหตุผล' (ชั่วคราว) · สถานะยัง 'รออนุมัติ' · ร่องรอยไม่มีรายการใหม่ · ไม่มี Email 'ปฏิเสธการจอง' | real | t1-round2.spec.ts |")
out.append("| TC-AUD-UI009-101 | [Recommended] BR-mrr-017@v2 · DEF-04 · [TBD - Require Business Confirmation] ถ้อยคำ error + รูปแบบช่องเหตุผล (OQ-T1-17) | Negative + Positive | RA กด 'ปฏิเสธ' บน UI-mrr-009 → กด 'ยืนยันปฏิเสธ' โดยไม่กรอกเหตุผล แล้วกรอกเหตุผลและกดอีกครั้ง | ครั้งแรกแจ้ง 'กรุณาระบุเหตุผล' และไม่ส่งคำขอ (สถานะยังรออนุมัติ ไม่มีร่องรอย) · ครั้งที่สองแจ้ง 'ปฏิเสธการจองสำเร็จ' · ร่องรอยมี 1 รายการ การกระทำ REJECT พร้อมเหตุผล | real | t1-round2.spec.ts |")
out.append("")
out.append("### B6. ผลรันสคริปต์รอบ 2 (2026-11-18 · Chromium · ระบบจริง · รันเฉพาะ t1-round2.spec.ts + t1-equipment.spec.ts — ยังไม่ใช่ T3)\n")
out.append("| TC ID | EX | ผล | สิ่งที่พบ (หลักฐานจากสคริปต์และโค้ด) | ประเภทเบื้องต้น |")
out.append("|---|---|---|---|---|")
for r in [
    ("TC-NTF-JOB-109", "111", "ผ่าน", "—", "—"),
    ("TC-NTF-JOB-110", "112", "ข้าม (test.fixme)", "ยังไม่มี fixture ผู้รับล้มเฉพาะ U3 · OQ-T1-15", "Environment (ขาดกลไก)"),
    ("TC-BKG-UI006-107", "113", "ผ่าน", "—", "—"),
    ("TC-NTF-UI006-102", "114", "ผ่าน", "—", "—"),
    ("TC-NTF-UI009-102", "115", "ผ่านหลังแก้", "รอบแรกล้ม: Email ใช้คำ 'อนุมัติ' (v1) · แก้ booking-notifier.ts เป็น 'อนุมัติแล้ว'", "Product Bug (แก้แล้ว)"),
    ("TC-NTF-UI008-105", "116", "ผ่านหลังแก้", "รอบแรกล้ม: ระบบใช้คำ 'ยกเลิก' · แก้เป็น 'ยกเลิกการจอง'", "Product Bug (แก้แล้ว)"),
    ("TC-NTF-UI010-101", "117", "ผ่านหลังแก้", "root cause เดียวกับ EX-116", "Product Bug (แก้แล้ว)"),
    ("TC-NTF-UI009-103", "118", "ผ่านหลังแก้", "Email 'ปฏิเสธการจอง:' ถึง U1/U2 และร่องรอยผ่านหลังแก้ · เจ้าของตอบว่าข้อความที่ถูกคือ 'ปฏิเสธการจองสำเร็จ' (EX-118 แก้เป็น 'ปฏิเสธการจองสำเร็จ' แล้ว 2026-11-18 ตามเจ้าของ · OQ-T1-16)", "No Defect ฝั่งระบบ · แก้ EX แล้ว"),
    ("TC-BKG-UI006-104", "119", "ผ่าน", "เพิ่มตรวจข้อความ 'จองห้องสำเร็จ' · EX ระบุผู้เข้าร่วม 3 คน เคสนี้ใช้ 1 คน", "—"),
    ("TC-AUD-UI010-109", "120", "ผ่านหลังแก้", "API /reject รับและบันทึกเหตุผล · ป้าย 'ปฏิเสธการจอง' ผ่าน · ข้อความ 'ปฏิเสธการจองสำเร็จ' ตามเจ้าของ (EX-120 แก้แล้ว · OQ-T1-16) · บังคับเหตุผลแล้ว (DEF-04 → TC-AUD-UI010-112, TC-AUD-UI009-101)", "No Defect ฝั่งระบบ · แก้ EX แล้ว"),
    ("TC-AUD-UI010-110", "121", "ผ่านหลังแก้", "รอบแรกล้ม: ป้ายเป็น 'เปลี่ยนผลการอนุมัติ' · แก้ AuditTrail.tsx เป็น 'ถอยผล'", "Product Bug (แก้แล้ว)"),
    ("TC-AUD-UI010-111", "122", "ผ่านหลังแก้", "เจ้าของตอบว่าข้อความที่ถูกคือ 'บันทึกการแก้ไขสำเร็จ' (EX-122 แก้เป็น 'บันทึกการแก้ไขสำเร็จ' แล้ว · OQ-T1-16) · ร่องรอยและป้าย 'แก้แทนผู้จอง' ผ่าน", "No Defect ฝั่งระบบ · แก้ EX แล้ว"),
]:
    out.append("| " + " | ".join([r[0], "EX-mrr-" + r[1], r[2], esc(r[3]), esc(r[4])]) + " |")
out.append("")
out.append("เคสที่ล้มทั้งหมดเป็นการตรวจถ้อยคำตาม EX (แหล่งความจริง) — ไม่ได้ปรับ assertion ให้ผ่าน · ประเภทเบื้องต้นยังต้องยืนยันใน T3\n")
out.append("## C) Test Data Requirement (สิ่งที่ dev ต้องเตรียม)\n")
out.append("| # | ต้องมี | ใช้กับ | หมายเหตุ |\n|---|---|---|---|")
need = [
    ("ผู้ใช้ทั่วไปเพิ่มอีก ≥ 3 คน (U2, U3, U4) ที่ล็อกอินได้ และมีกล่องจดหมายใน mailpit", "EX-004, 010, 011, 021, 030, 033, 034, 056, 061, 068–071, 083, 080", "[พร้อมแล้ว] ACCOUNTS ใน test/e2e/support/accounts.ts: global-setup seed U2–U4 และล็อกอินให้ (ก่อนหน้านี้ dev มีผู้ใช้ล็อกอินเดียว `tester@mrr.local`)"),
    ("Room Administrator ≥ 2 คน (RA1, RA2) ที่ล็อกอินได้", "EX-013, 028–029, 035–045, 054–061, 078–080, 015–016, 042 และอื่น ๆ", "ต้อง 2 คน เพราะกฎ 'คนอื่นที่ไม่ใช่คนแก้อนุมัติ' (BR-014) และ 'ผู้อนุมัติประจำห้อง' (BR-013) · [พร้อมแล้ว] ra1, ra2"),
    ("System Administrator ≥ 1 คน", "EX-018, 059, 073, 088, 089", "พิสูจน์ว่าบทบาทนี้ถูกปฏิเสธ (ห้ามแก้ห้อง/ดูรายงาน/เปลี่ยนผล) · [พร้อมแล้ว] sa"),
    ("บัญชี HR ที่ไม่ active (U5) และอีเมลนอกรายชื่อ (U9)", "EX-098, 099", "ข้อมูลสังเคราะห์เท่านั้น ห้ามใช้อีเมลพนักงานจริง · [พร้อมแล้ว] u5 = e2e.u5.inactive@mrr.local"),
    ("ห้อง E2E เฉพาะ: ห้องไม่ต้องอนุมัติ, ห้องต้องอนุมัติ (ไม่กำหนดผู้อนุมัติ), ห้องต้องอนุมัติ + กำหนด RA1, ห้องปิดปรับปรุงที่มีการจองเดิม", "EX-004, 013, 016, 039–042, 081–083 ฯลฯ", "อย่าแก้ห้อง A/B ของ dev ตรง ๆ — ใช้ห้อง E2E เฉพาะเพื่อไม่กระทบ suite เดิม · วิธีลบห้อง (DQ-mrr-003 open) · [พร้อมแล้ว] ROOMS ใน accounts.ts + E2E-SRCH-* (support/search-fixture.ts) · ห้องที่ไม่มีการจองลบด้วย SQL ได้ ส่วนห้องที่เคยมีการจองหรือช่วงปิดปรับปรุงลบไม่ได้ (FK) จึงเก็บถาวร"),
    ("สิ่งอำนวยความสะดวก ≥ 2 รายการใน dev", "BR-002 (อุปกรณ์เสริม)", "dev มี 0 รายการ จึงทดสอบกับ API จริงไม่ได้ (test/README) · [พร้อมแล้ว 2026-11-18] global-setup สร้าง E2E Projector / E2E Whiteboard ผ่าน API (FACILITIES ใน accounts.ts) · ลบไม่ได้ จึงค้างถาวร · ใช้ใน §B4 (TC-BKG-UI006-104–106)"),
    ("fixture รายงานตาม GD-mrr-001 (ห้อง A–E เดือน ต.ค. 2569: ชั่วโมงทำการ 13,200 นาที, ห้อง D ปิดซ่อม 3,000 นาที, ห้อง E ชั่วโมงทำการ 0)", "EX-084–087, 047–049", "[พร้อมแล้ว] test/e2e/support/report-fixture.ts seed ห้อง E2E Rpt A–E ด้วย SQL (การจองย้อนหลัง) · แต่ละเคสใช้เดือนอดีตของตัวเองที่ปฏิทินเหมือน ต.ค. 2569 (1 = พฤหัส · 31 วัน · จ.–ศ. 22 วัน = 13,200 นาที) เพราะรายงานจัดอันดับทุกห้อง · ตัวเลขตาม GD-mrr-001"),
    ("การจองที่ผ่านเวลาจบประชุมแล้ว", "EX-043, 045, 046", "สร้างด้วยการย้อนเวลา หรือ seed ตรงใน DB ที่ test ใช้เท่านั้น [TBD] · [พร้อมแล้ว] ย้อนเวลาด้วย /__test/clock (t1-clock.spec.ts)"),
]
for i, (a, b, c) in enumerate(need, 1):
    out.append(f"| {i} | {a} | {b} | {c} |")
out.append("\nกติกาข้อมูล: ใช้ข้อมูลสังเคราะห์ · หัวข้อขึ้นต้น `E2E` · วันที่ในอนาคตแบบสุ่มเพื่อไม่ชนกัน (วันที่ใน EX เช่น 17/10 เป็นตัวอย่างเชิงตรรกะ ไม่ใช่วันที่ต้องใช้จริง)\n")

# D) open questions
out.append("## D) Open Questions (TBD)\n")
out.append("| ID | คำถาม | กระทบ | ผู้ตอบที่เสนอ |\n|---|---|---|---|")
oq = [
    ("OQ-T1-01", "[ปิดแล้ว] ควบคุมเวลาฝั่งเซิร์ฟเวอร์: api มี `POST /__test/clock` (เปิดเฉพาะเมื่อ ENABLE_TEST_CONTROLS=true · dev compose เปิดไว้ ค่าเริ่มต้นปิด) · ใช้ผ่าน test/e2e/support/clock.ts", "เคสที่ใช้เวลาเสร็จแล้ว (ดู t1-clock.spec.ts)", "Dev lead"),
    ("OQ-T1-02", "[ปิดแล้ว] พบว่า ReminderJob / AutoCancelJob ไม่ได้รันจริงใน api (ไม่มี store ต่อ Postgres ไม่ได้ลงทะเบียนใน AppModule) → ต่อแล้ว: PgReminderStore, PgAutoCancelStore และลงทะเบียนใน AppModule · เทสต์สั่งรันรอบหนึ่งผ่าน /__test/jobs/run (จำกัดตามหัวข้อ)", "BR-008, 016, 020, 023 เป็นของจริงแล้ว", "Dev lead"),
    ("OQ-T1-03", "[ปิดแล้ว] จำลองอีเมลล่มแบบ real ด้วยการหยุด container mailpit (support/mail.ts) · ส่วน transaction boundary ยังเป็น DQ-mrr-005 / DQ-mrr-014 ที่ PO ยังไม่ตอบ (เคสพิสูจน์พฤติกรรมปัจจุบัน: ล้มทั้งการกระทำ ไม่สร้าง/ไม่เปลี่ยนข้อมูล)", "BR-019, 024", "Dev lead + PO"),
    ("OQ-T1-04", "ผู้ใช้ 'ปุ่มถูกซ่อน' (EX-010, 014, 017, 018, 048, 060, 061, 073, 074) — ยอมรับให้ทดสอบด้วยการยิงคำสั่งตรงผ่าน session ของ browser (Playwright `request`) เป็น E2E หรือควรจัดเป็นระดับ API", "การจัดระดับเคสต่อ Test Level", "QA Lead"),
    ("OQ-T1-05", "EX ที่อ้าง 'ผู้ใช้อีกคน' (EX-003, 004) ยอมรับผู้จองคนเดียวกันได้หรือไม่ เพราะ test/README ใช้ผู้จองคนเดียวมาก่อน", "EX-003, 004 และความหมายของ 'พิสูจน์ข้ามผู้ใช้'", "PO"),
    ("OQ-T1-06", "[ปิดแล้ว] EX-031/032 (เดิมพิสูจน์ BR-mrr-010@v1 ที่ถูก v2 แทน): BA/PO เลือกเขียนใหม่ให้ตรง v2 (ทางเลือก B) → แก้ใน spec.json แล้ว (proves = BR-mrr-010@v2) · เคส TC-RMM-UI013-108/109 ยืนยันตาม then ใหม่ตรงตัวอักษร · หมายเหตุ: ซ้อนกับ EX-078/079 ที่ given/when เดียวกัน", "EX-031, 032", "BA / PO"),
    ("OQ-T1-07", "ตัวเลขรายงานในเคสรายงาน (EX-084–087) ผูกกับ GD-mrr-001 · DQ-mrr-010 (decimal ใน DB) ยัง open — หน้าจอแสดง 2 ตำแหน่งตาม EX แต่ไม่ได้ระบุว่าเก็บกี่ตำแหน่ง", "EX-084–087", "PO"),
    ("OQ-T1-08", "ปฏิทิน: DQ-mrr-011 (หัวหน้าเห็นรายละเอียดลูกน้องไหม) ยัง open — EX-068–071 ไม่คลุมกรณีนี้ จึงไม่เขียนเคส", "BR-021", "PO"),
    ("OQ-T1-10", "[ปิดแล้ว 2026-11-18 · PO/BA: รับเป็นเคสนอก BR ได้] ออกจากระบบ (UI-mrr-003 · AC-mrr-111–113) ไม่มี BR/EX — req ตอบว่าเป็นฟังก์ชันแพลตฟอร์ม (Q3.1) ทำให้ไม่มีเคสที่ผูก BR ได้ตามกฎข้อ 3 · QA เสนอเคส [Recommended] ใน §B3 แยกจาก CSV · ขอ PO ยืนยันว่ารับเป็นเคสนอก BR (Test Level E2E)", "AC-111–113 (3 เคสเสนอ)", "PO / BA"),
    ("OQ-T1-11", "[ตอบแล้ว 2026-11-18 · รอ req เขียน EX] (1) ตอบ: เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม — ตัดสินแล้วให้ใช้ข้อความตามโค้ด: 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม' · ยังไม่มี EX จึงยังไม่ออกแบบเคส (รอ req เขียน EX · ตอบแล้ว: เวลาเริ่มเท่ากับเวลาสิ้นสุดถูกปฏิเสธด้วย → ขอบ BVA: สิ้นสุด < เริ่ม / = เริ่ม ปฏิเสธ · เริ่ม+1 นาที ผ่าน) (2) ตอบ: 'ทุกห้อง' = ทุกห้องในระบบ → EX-107 ต้องล็อกทุกห้องใน dev ไม่ใช่เฉพาะห้อง fixture · ค้นหาห้องว่าง — (1) เวลาสิ้นสุดไม่หลังเวลาเริ่ม ข้อความ error คืออะไร (Q1.2 ใน req-questions-search-delete-logout.md · req ยังไม่มี EX) (2) 'ทุกห้อง' ใน EX-107 หมายถึงทุกห้องที่ active ทั้งระบบหรือเฉพาะห้องของ fixture", "EX-107 · เคสเวลาไม่ถูกต้อง (ยังไม่ออกแบบ)", "BA / PO"),
    ("OQ-T1-12", "[ตอบบางส่วน 2026-11-18 · รอ req เขียน EX] ตัดสินแล้วให้ใช้ข้อความตามโค้ด: 'การลบจะเลิกใช้ห้องถาวรและเปิดกลับไม่ได้ การจองเดิมคงไว้ ยืนยันลบหรือไม่' (ยังไม่มี EX · ผลเมื่อกดยกเลิกยังไม่ระบุ) · TBD - Require Business Confirmation: การจองเดิมของห้องที่ลบเป็นอย่างไร (Q2b) · ลบห้องที่มีการจองในอนาคต — ผู้ใช้เห็นอะไรก่อนยืนยัน และการจองเดิมเป็นอย่างไร (Q2b · req ยังไม่มี EX · STM-mrr-003 บอกแค่ 'การจองเดิมคงไว้') · และข้อความเมื่อลบสำเร็จของ EX-109 ยืนยันแล้ว ('ลบห้องแล้ว')", "EX-109 · เคสลบห้องที่มีการจอง (ยังไม่ออกแบบ)", "BA / PO"),
    ("OQ-T1-13", "TBD - Require Business Confirmation: อุปกรณ์เสริม — (1) อุปกรณ์ที่เลิกใช้แล้ว (active = false) ในการจอง: ปฏิเสธหรือรับ และข้อความคืออะไร (โค้ดปฏิเสธด้วย 'ไม่พบอุปกรณ์เสริมบางรายการ' แต่ไม่มี BR/EX) (2) จองไปแล้วจึงเลิกใช้อุปกรณ์: การจองเดิมคงไว้หรือไม่", "TC-BKG-UI006-106 · เคสอุปกรณ์เลิกใช้ (ยังไม่ออกแบบ)", "BA / PO"),
    ("OQ-T1-14", "[ปิดแล้ว 2026-11-18 · QA ตอบจาก BR-mrr-020@v2 · SRC-028 · .aeon/spec.json] 'บันทึกการส่งเตือน' คือสถานะการเตือนของการจอง (ส่งสำเร็จ / ส่งไม่สำเร็จ) ซึ่งระบบเก็บที่คอลัมน์ bookings.reminder_status (SENT / FAILED) — เคสตรวจค่านี้ผ่าน psql เหมือน TC-NTF-JOB-106 ไม่ต้องมีหน้าจอ", "—"),
    ("OQ-T1-15", "[ตอบบางส่วน 2026-11-18 · EX-mrr-112] นิยามตอบแล้ว: ผู้รับบางคนล้ม = บันทึก 'ส่งไม่สำเร็จ' ทั้งการจอง ไม่แยกรายคน การจองยังใช้ได้ งานรอบ 09:50 ไม่ส่งซ้ำ · ยังขาด fixture ที่ทำให้ SMTP ปฏิเสธเฉพาะผู้รับ U3 (mailpit v1.21.8 ในกอง dev ล้มได้ทั้งตัวเท่านั้น) → TC-NTF-JOB-110 เป็น test.fixme", "Dev (fixture)"),
    ("OQ-T1-16", "[เจ้าของตอบแล้ว 2026-11-18 · แก้ EX-118/120/122 ใน spec แล้ว · เหลือ: ขอ EX ใหม่ของ Email ตอนเปลี่ยนผลเป็นปฏิเสธ] ข้อความที่ถูกคือ 'ปฏิเสธการจองสำเร็จ' และ 'บันทึกการแก้ไขสำเร็จ' — (EX-mrr-118, 120, 122 แก้เติม 'สำเร็จ' แล้ว) · อีกข้อ: เปลี่ยนผลอนุมัติ→ปฏิเสธต้องส่ง Email ถึงผู้จองและผู้เข้าร่วมด้วย (ระบบทำแล้ว มี jest คลุม) แต่ยังไม่มี EX รองรับ → ขอ EX เพิ่ม", "req"),
    ("OQ-T1-17", "[TBD - Require Business Confirmation · DEF-04 · BR-mrr-017@v2] ถ้อยคำ error ที่ RA เห็นเมื่อปฏิเสธโดยไม่ระบุเหตุผล (ใช้ 'กรุณาระบุเหตุผล' เหมือน EX-mrr-057 หรือถ้อยคำอื่น) และช่องเหตุผลบน UI-mrr-009 ออกแบบอย่างไร · ยังไม่มี Q-mrr/DQ-mrr ครอบ (DQ-mrr-007 เป็นเรื่องจองซ้ำ) · ผลต่อเคส: TC-AUD-UI010-112 และ TC-AUD-UI009-101 (ใช้ 'กรุณาระบุเหตุผล' ชั่วคราว — แก้ค่าคงที่ที่เดียวถ้าเปลี่ยน)", "req / design"),
    ("OQ-T1-09", "NFR-mrr-001–004 (โหลด 200 คน, HTTPS, uptime) ไม่ใช่ระดับ E2E — ไม่อยู่ในขอบเขต T1 รอบนี้ (ดู t2-coverage-report ช่องว่างข้อ 1 และ Q-mrr-004)", "NFR", "PO"),
]
for r in oq:
    out.append("| " + " | ".join(esc(x) for x in r) + " |")
out.append("\n## Next Actions\n")
out.append("1. QA review เคสรอบ 2 (11 เคส) และตรวจว่า Expected ของเคสเดิมที่เปลี่ยนเป็น v2 ยังตรงกับ EX-019–022, 054–057, 066–067")
out.append("2. Dev: ปรับระบบให้ตรง v2 (CHG-mrr-003) — หัวเรื่อง Email 'อนุมัติแล้ว' / 'ยกเลิกการจอง' · ส่ง Email ตอนปฏิเสธถึงผู้จองและผู้เข้าร่วม · ปฏิเสธต้องมีเหตุผลและบันทึกในร่องรอย · ป้ายร่องรอย 'ปฏิเสธการจอง' / 'ถอยผล' (ดู §B6) · req ยืนยันถ้อยคำ 'ปฏิเสธการจอง' และ 'บันทึกการแก้ไข' ของ EX ว่าตรงกับข้อความระบบหรือไม่")
out.append("3. Dev: fixture ให้ SMTP ปฏิเสธเฉพาะผู้รับ U3 (OQ-T1-15) แล้วเปลี่ยน test.fixme ของ TC-NTF-JOB-110 เป็นเคสจริง")
out.append("4. รัน T3 ตรวจผล + triage เมื่อรัน suite เต็ม (ผล §B6 เป็นการรันเฉพาะไฟล์ใหม่ ยังไม่ใช่ T3) · ร่าง defect ด้วย T4 หลัง QA ยืนยัน triage")
out.append("5. ออกจากระบบ §B3 · เหลือพิสูจน์ AC-112 กับ API จริง · เคสอุปกรณ์เสริม §B4 รอ OQ-T1-13 (เคสอุปกรณ์ที่เลิกใช้)")
out.append("6. รัน T2 ซ้ำเมื่อมีเคสเพิ่ม (ล่าสุด 2026-11-18 รอบ 2: t2-coverage-report.md)")

(QA / "t1-test-cases.md").write_text("\n".join(out) + "\n", encoding="utf-8")
print(f"EX={len(EX)} existing={len(EXISTING)} partial={len(PARTIAL_EXISTING)} superseded={len(SUPERSEDED)} new={n_new} auto={by_auto} pri={by_pri}")
