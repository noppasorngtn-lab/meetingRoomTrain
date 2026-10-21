import { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError, getJson, postJson } from '../../shared/api';
import { Pager } from '../../shared/Pager';
import { routeOf } from '../../shared/sitemap';
import { bangkokDate, instantLabel } from '../../shared/time';

type PeriodType = 'MONTH' | 'YEAR';

interface ReportLine {
  room: { id: string; name: string };
  bookedMinutes: number;
  operatingMinutes: number;
  utilizationPct: string | null;
  /** "66.67%", or "—" when the room had no operating minutes. */
  display: string;
  rank: number | null;
}

interface Report {
  id: string;
  periodType: PeriodType;
  periodStart: string;
  periodEnd: string;
  issueNo: number;
  issuedAt: string;
  issues: { issueNo: number; issuedAt: string }[];
  lines: ReportLine[];
}

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; report: Report }
  | { kind: 'none'; message: string }
  | { kind: 'forbidden'; message: string }
  | { kind: 'failed' }
  | { kind: 'unauthorized' };

const SIGN_IN = 'UI-mrr-001';
/** issue's, open-issue's and export's destination in screens.json — they stay here. */
const REPORT = 'RPT-mrr-001';
/** RPT-mrr-001 overflow — the screen pages past this many rooms; the export carries them all. */
const PAGE_SIZE = 50;

const PERIOD_LABEL: Record<PeriodType, string> = { MONTH: 'รายเดือน', YEAR: 'รายปี' };

/** The first day of the period the field shows: YYYY-MM → its 1st, YYYY → 1 January. */
const periodStartOf = (type: PeriodType, value: string) => (type === 'MONTH' ? `${value}-01` : `${value}-01-01`);
const fieldValueOf = (type: PeriodType, periodStart: string) => (type === 'MONTH' ? periodStart.slice(0, 7) : periodStart.slice(0, 4));

const thousands = (n: number) => n.toLocaleString('en-US');

/**
 * RPT-mrr-001 — a Room Administrator chooses a month or a year, reads its latest report (API-029),
 * issues a new one from the bookings as they are now (API-028), opens an earlier issue exactly as
 * it was issued, and exports the one on screen (API-030). The numbers are the api's; nothing is
 * computed here (CALC-mrr-001@v1 · BR-mrr-015).
 */
export function UtilizationReportPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [periodType, setPeriodType] = useState<PeriodType>('MONTH');
  // This month in Bangkok to begin with.
  const [periodValue, setPeriodValue] = useState(() => bangkokDate(new Date()).slice(0, 7));
  const [chosenIssue, setChosenIssue] = useState<number | null>(null);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [issuing, setIssuing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const valid = periodType === 'MONTH' ? /^\d{4}-\d{2}$/.test(periodValue) : /^\d{4}$/.test(periodValue);
  const periodStart = valid ? periodStartOf(periodType, periodValue) : null;

  const fetchReport = useCallback(
    (issueNo?: number) => {
      if (!periodStart) return;
      setLoad({ kind: 'loading' });
      setPage(1);
      const issue = issueNo === undefined ? '' : `&issueNo=${issueNo}`;
      getJson<Report>(`/reports/utilization?periodType=${periodType}&periodStart=${periodStart}${issue}`)
        .then((report) => {
          setChosenIssue(report.issueNo);
          setLoad({ kind: 'ready', report });
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 401) return setLoad({ kind: 'unauthorized' });
          // Not a Room Administrator — the api's words, 'เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้'.
          if (err instanceof ApiError && err.status === 403) return setLoad({ kind: 'forbidden', message: err.message });
          // Empty state — 'ยังไม่มีรายงานของช่วงนี้'.
          if (err instanceof ApiError && err.status === 404) return setLoad({ kind: 'none', message: err.message });
          setLoad({ kind: 'failed' });
        });
    },
    [periodType, periodStart],
  );

  // A new period shows its latest issue.
  useEffect(() => fetchReport(), [fetchReport]);

  const issue = async () => {
    if (!periodStart) return;
    setIssuing(true);
    setFailure(null);
    try {
      const done = await postJson<{ message: string; report: Report }>('/reports/utilization', { periodType, periodStart });
      // Said through the shell's notice, the way every other page reports a change.
      navigate({ pathname: routeOf(REPORT), search: location.search }, { replace: true, state: { notice: done.message } });
      setChosenIssue(done.report.issueNo);
      setPage(1);
      setLoad({ kind: 'ready', report: done.report });
    } catch (err) {
      // Nothing is issued (RPT-mrr-001 error state); what is on screen stays.
      if (err instanceof ApiError && err.status === 401) return setLoad({ kind: 'unauthorized' });
      setFailure(err instanceof ApiError && err.status !== 500 ? err.message : 'ออกรายงานไม่สำเร็จ กรุณากดอีกครั้ง');
    } finally {
      setIssuing(false);
    }
  };

  if (load.kind === 'unauthorized') return <Navigate to={routeOf(SIGN_IN)} replace />;
  const report = load.kind === 'ready' ? load.report : null;
  const shown = report ? report.lines.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : [];
  return (
    <>
      <h1>รายงานการใช้ห้อง</h1>
      <p className="purpose">Room Administrator ออกและดูรายงานอัตราการใช้งานรายห้องรายเดือน/รายปี พร้อมอันดับ</p>
      {load.kind === 'forbidden' ? (
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">{load.message}</span>
        </div>
      ) : (
        <form className="card" onSubmit={(e) => e.preventDefault()}>
          <h2>ช่วงรายงาน</h2>
          <div className="grid">
            <div className="field">
              <label htmlFor="rpt-mrr-001-ent-012-period-type">
                ช่วงรายงาน<span className="req" aria-hidden="true">*</span>
              </label>
              <select
                className="input"
                id="rpt-mrr-001-ent-012-period-type"
                data-testid="rpt-mrr-001-ent-012-period-type"
                value={periodType}
                onChange={(e) => {
                  const next = e.target.value as PeriodType;
                  setPeriodType(next);
                  setPeriodValue(fieldValueOf(next, periodStartOf(periodType, periodValue)));
                }}
              >
                {(['MONTH', 'YEAR'] as const).map((t) => (
                  <option key={t} value={t}>{PERIOD_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="rpt-mrr-001-ent-012-period-start">
                เริ่มช่วง<span className="req" aria-hidden="true">*</span>
              </label>
              <input
                className="input"
                id="rpt-mrr-001-ent-012-period-start"
                data-testid="rpt-mrr-001-ent-012-period-start"
                type={periodType === 'MONTH' ? 'month' : 'number'}
                min={periodType === 'YEAR' ? 2000 : undefined}
                value={periodValue}
                onChange={(e) => setPeriodValue(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="rpt-mrr-001-ent-012-issue-no">ฉบับที่</label>
              <select
                className="input"
                id="rpt-mrr-001-ent-012-issue-no"
                data-testid="rpt-mrr-001-ent-012-issue-no"
                value={chosenIssue ?? ''}
                disabled={!report}
                onChange={(e) => setChosenIssue(Number(e.target.value))}
              >
                {report?.issues.map((i) => (
                  <option key={i.issueNo} value={i.issueNo}>
                    ฉบับที่ {i.issueNo} · ออกเมื่อ {instantLabel(i.issuedAt)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              data-testid="rpt-mrr-001-issue"
              disabled={!periodStart || issuing || load.kind === 'loading'}
              aria-busy={issuing || undefined}
              onClick={issue}
            >
              ออกรายงานฉบับใหม่
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="rpt-mrr-001-open-issue"
              disabled={!report || chosenIssue === null || chosenIssue === report.issueNo || issuing}
              onClick={() => fetchReport(chosenIssue ?? undefined)}
            >
              เปิดฉบับที่ออกแล้ว
            </button>
            {report ? (
              // A plain download of the issue on screen, every room in it (API-030).
              <a className="btn btn-secondary" data-testid="rpt-mrr-001-export" href={`/reports/utilization/${report.id}/export`} download>
                ส่งออก
              </a>
            ) : (
              <button type="button" className="btn btn-secondary" data-testid="rpt-mrr-001-export" disabled>
                ส่งออก
              </button>
            )}
          </div>
        </form>
      )}
      {/* Not role="status": the shell's notice after an issue is the page's one status message. */}
      {issuing && <p className="help" aria-live="polite">กำลังคำนวณรายงาน…</p>}
      {!issuing && load.kind === 'loading' && <p className="help" aria-live="polite">กำลังโหลดรายงาน…</p>}
      {failure && (
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">{failure}</span>
        </div>
      )}
      {load.kind === 'failed' && (
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">โหลดรายงานไม่สำเร็จ</span>
          <button type="button" className="btn btn-secondary" onClick={() => fetchReport()}>
            โหลดใหม่
          </button>
        </div>
      )}
      {load.kind === 'none' && (
        <div className="card">
          <p>{load.message}</p>
        </div>
      )}
      {report && (
        <div className="card">
          <p className="help">
            {PERIOD_LABEL[report.periodType]} {report.periodStart} ถึง {report.periodEnd} · ฉบับที่ {report.issueNo} · ออกเมื่อ {instantLabel(report.issuedAt)}
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">ห้อง</th>
                  <th scope="col">นาทีที่ใช้จริง</th>
                  <th scope="col">นาทีทำการ</th>
                  <th scope="col">อัตราการใช้งาน</th>
                  <th scope="col">อันดับ</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.room.id}>
                    <td data-testid="rpt-mrr-001-ent-013-room">{l.room.name}</td>
                    <td data-testid="rpt-mrr-001-ent-013-booked-minutes">{thousands(l.bookedMinutes)}</td>
                    <td data-testid="rpt-mrr-001-ent-013-operating-minutes">{thousands(l.operatingMinutes)}</td>
                    <td data-testid="rpt-mrr-001-ent-013-utilization-pct">{l.display}</td>
                    {/* A room with no operating minutes takes no rank (AC-mrr-085). */}
                    <td data-testid="rpt-mrr-001-ent-013-rank">{l.rank ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={report.lines.length} onPage={setPage} />
        </div>
      )}
    </>
  );
}
