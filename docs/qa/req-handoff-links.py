#!/usr/bin/env python3
"""Generate docs/qa/req-handoff-test-links.md: for every current BR, the EX that prove it and the test cases
that cite those EX (so req can fill the "เทสต์" field of docs/wiki/requirements/REQ-mrr-*.md through req's own tool).

Run:  python docs/qa/req-handoff-links.py --write      (omit --write to print)
Sources (read only): docs/wiki/examples/EX-*.md (proves:), docs/wiki/rules/BR-*.md (current version),
  docs/qa/e2e-ex-map.json, docs/qa/t1-test-cases.csv, test/e2e/*.spec.ts (TC id + EX id on the same line),
  .aeon/design/modules/mrr/functions.json (AC -> EX/BR), apps/api/test, apps/web/src/__tests__ (cite AC).
A case is listed against a BR only through an EX (or the CSV 'Requirement ID' column); nothing is guessed.
"""
import csv, json, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.stdout.reconfigure(encoding='utf-8')
rd = lambda p: p.read_text(encoding='utf-8')

ex_br = {}
for p in (ROOT / 'docs/wiki/examples').glob('EX-*.md'):
    m = re.search(r'^proves:\s*\[(.*?)\]', rd(p), re.M)
    ex_br[p.stem] = re.findall(r'BR-mrr-\d+@v\d+', m.group(1)) if m else []
current = {}  # BR number -> current id
for p in (ROOT / 'docs/wiki/rules').glob('BR-*.md'):
    t = rd(p)
    if re.search(r'^is_current:\s*true', t, re.M) or not re.search(r'^is_current:', t, re.M):
        current[p.stem.split('@')[0]] = p.stem
# if both versions lack the flag, keep the highest version
for p in sorted((ROOT / 'docs/wiki/rules').glob('BR-*.md')):
    k = p.stem.split('@')[0]
    if p.stem > current.get(k, ''): current[k] = p.stem
sup = {}
for p in (ROOT / 'docs/wiki/rules').glob('BR-*.md'):
    sup.setdefault(p.stem.split('@')[0], []).append(p.stem)

tc_ex = {}  # TC -> set(EX)
def link(tc, ex): tc_ex.setdefault(tc, set()).add(ex)
emap = json.loads(rd(ROOT / 'docs/qa/e2e-ex-map.json'))['covers']
for ex, v in emap.items():
    cs = v['cases']
    ids = re.findall(r'TC-[A-Z]+-[A-Z0-9]+-\d+', cs)
    for t in ids: link(t, ex)
    for sh in re.findall(r',\s*-(\d+)', cs):  # shorthand like 'TC-AUD-UI010-105, -102'
        link(re.sub(r'-\d+$', '-' + sh, ids[-1]), ex)
    rest = re.sub(r'TC-[A-Z]+-[A-Z0-9]+-\d+|-\d+', '', cs)
    for n in re.findall(r'(?<![\w-])\d+(?![\w-])', rest): link(f'booking.spec.ts #{n}', ex)
for p in (ROOT / 'test/e2e').glob('*.spec.ts'):
    for line in rd(p).splitlines():
        tcs = re.findall(r'TC-[A-Z]+-[A-Z0-9]+-\d+', line)
        for ex in re.findall(r'EX-mrr-\d+', line):
            for tc in tcs: link(tc, ex)
# only scripted rows: the output column says "E2E [real]", so a case with no script yet must not be listed there
csvrows = [r for r in csv.DictReader(open(ROOT / 'docs/qa/t1-test-cases.csv', encoding='utf-8-sig')) if r['Script'].strip()]
tc_br = {}
for r in csvrows:
    for ex in re.findall(r'EX-mrr-\d+', r['Requirement ID']): link(r['TC ID'], ex)
    for b in re.findall(r'BR-mrr-\d+', r['Requirement ID']): tc_br.setdefault(r['TC ID'], set()).add(b)
fixme = set(re.findall(r"test\.fixme\('\[real\] (TC-[A-Z]+-[A-Z0-9]+-\d+)", ''.join(rd(p) for p in (ROOT / 'test/e2e').glob('*.spec.ts'))))

acs = json.loads(rd(ROOT / '.aeon/design/modules/mrr/functions.json'))['acceptance']
unit_files = list((ROOT / 'apps/api/test').rglob('*.ts')) + list((ROOT / 'apps/web/src/__tests__').glob('*.tsx'))
ac_files = {}
for p in unit_files:
    for a in set(re.findall(r'AC-mrr-\d+', rd(p))): ac_files.setdefault(a, set()).add(p.name)

def key(tc): return (0, tc) if tc.startswith('TC-') else (1, int(tc.split('#')[1]))
out = []; w = out.append
w('# ข้อมูลสำหรับ req: เคสทดสอบของแต่ละ BR (ไว้เติมช่อง "เทสต์" ใน REQ wiki)\n')
w('สร้างโดย `docs/qa/req-handoff-links.py` (อย่าแก้ด้วยมือ) · แหล่ง: `proves:` ของ EX · `e2e-ex-map.json` · `t1-test-cases.csv` · ชื่อเคสใน `test/e2e/*.spec.ts` · AC จาก `functions.json`\n')
w('ช่อง "เทสต์" ของทุก BR ใน `docs/wiki/requirements/REQ-mrr-001–005.md` ยังเป็น *(ยังไม่มี)* 🔴 (เกณฑ์ G1) · wiki สร้างจาก `.aeon/req` ด้วยเครื่องมือของ req และมีลายเซ็น จึงไม่แก้ด้วยมือ — ตารางนี้ให้ req ใช้เติมผ่านเครื่องมือของ req\n')
w('| BR (ปัจจุบัน) | EX ที่พิสูจน์ | เคส E2E [real] (TC ID) | เทสชั้น API / web (อ้าง AC) | หมายเหตุ |\n|---|---|---|---|---|')
total_gap = []
for k in sorted(current):
    br = current[k]
    exs = sorted(e for e, bs in ex_br.items() if br in bs)
    tcs = {tc for tc, es in tc_ex.items() if es & set(exs)} | {tc for tc, bs in tc_br.items() if k in bs}
    tcs = sorted(tcs, key=key)
    ac = sorted(a['id'] for a in acs if br in a['rules'])
    files = sorted({f for a in ac for f in ac_files.get(a, [])})
    notes = []
    if not tcs: notes.append('**ไม่มีเคส E2E**'); total_gap.append(br)
    skipped = [t for t in tcs if t in fixme]
    if skipped: notes.append('ข้าม (test.fixme): ' + ', '.join(skipped))
    noac = [a for a in ac if a not in ac_files]
    if noac: notes.append('AC ไม่มีเทสอ้าง: ' + ', '.join(noac))
    if not files: notes.append('ไม่มีเทส API/web อ้าง')
    old = [v for v in sup[k] if v != br]
    exs_s = ', '.join(e.replace('EX-mrr-', '') for e in exs) or '—'
    w(f"| {br} | {exs_s} | {len(tcs)}: {', '.join(tcs) or '—'} | {len(files)} ไฟล์: {', '.join(files[:6])}{' …' if len(files) > 6 else ''} | {'; '.join(notes) or '—'} |")
w(f'\nBR ปัจจุบัน {len(current)} ข้อ · BR ที่ไม่มีเคส E2E ผ่าน EX/CSV: {", ".join(total_gap) or "ไม่มี"}\n')
w('หมายเหตุ: `booking.spec.ts #N` = เคสเลขเดิมใน booking.spec.ts / test/README (ยังไม่มี TC ID แบบ TC-…) · เคสที่เป็น `[stub]` ไม่พิสูจน์ API จริง ดู t2-coverage-report.md ข้อ 2 · เคส `[Recommended]` ที่ไม่ผูก EX: TC-BKG-UI006-104–106 (BR-mrr-002) และ TC-AUTH-UI003-101–103 (AC-mrr-111–113 ไม่มี BR)')
text = '\n'.join(out) + '\n'
if '--write' in sys.argv:
    (ROOT / 'docs/qa/req-handoff-test-links.md').write_text(text, encoding='utf-8', newline='\n'); print('wrote')
else: print(text)
