import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, getJson, postJson } from '../../shared/api';
import { Pager } from '../../shared/Pager';
import { routeOf } from '../../shared/sitemap';
import { slotLabel } from '../../shared/time';

type AdjustmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface AdjustmentRequest {
  id: string;
  booking: { id: string; roomName: string; title: string; startAt: string; endAt: string };
  requestedBy: { id: string; fullName: string };
  /** Only the fields asked to change, in the api's names: title · startAt · endAt · attendeeIds · equipmentIds. */
  proposedChanges: Record<string, unknown>;
  reason: string;
  status: AdjustmentStatus;
  createdAt: string;
  /** False on the caller's own request (BR-mrr-014) — the api refuses it anyway. */
  canDecide: boolean;
}

interface AdjustmentPage {
  items: AdjustmentRequest[];
  page: number;
  pageSize: number;
  total: number;
}

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; data: AdjustmentPage }
  | { kind: 'failed' }
  | { kind: 'forbidden'; message: string }
  | { kind: 'unauthorized' };

type Verb = 'approve' | 'reject';

/** STM-mrr-002's state labels, word for word. */
const STATUS_LABEL: Record<AdjustmentStatus, string> = {
  PENDING: 'รออนุมัติ',
  APPROVED: 'อนุมัติแล้ว — ค่าใหม่มีผล',
  REJECTED: 'ปฏิเสธแล้ว — ค่าเดิมคงไว้',
};

/** BR-mrr-014 · AC-mrr-044 — said on the asker's own row, where the buttons are disabled. */
const OWN_REQUEST = 'ผู้แก้ไขอนุมัติคำขอของตัวเองไม่ได้ ต้องให้ผู้ดูแลห้องคนอื่นอนุมัติ';

/** UI-mrr-011 overflow — past this many asked-for values the rest fold behind แสดงทั้งหมด. */
const SHOWN_CHANGES = 2;

const SIGN_IN = 'UI-mrr-001';
/** approve's and reject's destination in screens.json — they stay here. */
const REQUESTS = 'UI-mrr-011';

/** Each asked-for value as a person reads it; the time is one line whichever end moved. */
function changeLines(r: AdjustmentRequest): string[] {
  const c = r.proposedChanges;
  const lines: string[] = [];
  if (typeof c.title === 'string') lines.push(`หัวข้อ: ${c.title}`);
  if (typeof c.startAt === 'string' || typeof c.endAt === 'string') {
    const start = typeof c.startAt === 'string' ? c.startAt : r.booking.startAt;
    const end = typeof c.endAt === 'string' ? c.endAt : r.booking.endAt;
    lines.push(`ช่วงเวลา: ${slotLabel(start, end)}`);
  }
  // API-017 carries ids only, so these say how many rather than who or what.
  if (Array.isArray(c.attendeeIds)) lines.push(`ผู้เข้าร่วม: ${c.attendeeIds.length} คน`);
  if (Array.isArray(c.equipmentIds)) lines.push(c.equipmentIds.length ? `อุปกรณ์: ${c.equipmentIds.length} รายการ` : 'อุปกรณ์: ไม่ขออุปกรณ์');
  return lines;
}

function ProposedChanges({ request }: { request: AdjustmentRequest }) {
  const lines = changeLines(request);
  const rest = lines.slice(SHOWN_CHANGES);
  return (
    <>
      <ul>
        {lines.slice(0, SHOWN_CHANGES).map((l) => <li key={l}>{l}</li>)}
      </ul>
      {rest.length > 0 && (
        <details>
          <summary>แสดงทั้งหมด ({lines.length})</summary>
          <ul>
            {rest.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </details>
      )}
    </>
  );
}

/**
 * UI-mrr-011 — a Room Administrator's queue of adjustment requests made after a meeting ended
 * (API-017), approved or rejected right here (API-018 · API-019). 20 to a page, the longest waiting
 * first; ?page=<n> picks the page. Whoever asked sees the buttons disabled, and the api refuses
 * it anyway (ACL-012 · BR-mrr-014).
 */
export function AdjustmentRequestsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const page = Number(params.get('page')) || 1;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [deciding, setDeciding] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const fetchPage = useCallback(() => {
    setLoad({ kind: 'loading' });
    getJson<AdjustmentPage>(`/adjustment-requests?status=PENDING&page=${page}`)
      .then((data) => setLoad({ kind: 'ready', data }))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) return setLoad({ kind: 'unauthorized' });
        // Not a Room Administrator — the api's words, 'คุณไม่มีสิทธิ์เข้าหน้านี้'.
        if (err instanceof ApiError && err.status === 403) return setLoad({ kind: 'forbidden', message: err.message });
        setLoad({ kind: 'failed' });
      });
  }, [page]);

  useEffect(fetchPage, [fetchPage]);

  const decide = async (verb: Verb, id: string) => {
    setDeciding(id);
    setFailure(null);
    try {
      const done = await postJson<{ message: string }>(`/adjustment-requests/${id}/${verb}`, {});
      // Said through the shell's notice; the decided request leaves the queue on the next read.
      navigate({ pathname: routeOf(REQUESTS), search: params.toString() }, { replace: true, state: { notice: done.message } });
      fetchPage();
    } catch (err) {
      // The request stays pending (UI-mrr-011 error state) — the api says why: one's own request,
      // already decided, or the new time is now another booking's.
      if (err instanceof ApiError && err.status === 401) return setLoad({ kind: 'unauthorized' });
      setFailure(err instanceof ApiError && err.status !== 500 ? err.message : 'บันทึกผลไม่สำเร็จ กรุณากดอีกครั้ง');
    } finally {
      setDeciding(null);
    }
  };

  // The states design declares for this page (screens.json UI-mrr-011).
  if (load.kind === 'unauthorized') return <Navigate to={routeOf(SIGN_IN)} replace />;
  return (
    <>
      <h1>คำขอแก้ไขการจอง</h1>
      <p className="purpose">Room Administrator อนุมัติหรือปฏิเสธคำขอแก้ไขการจองที่ประชุมจบแล้ว ซึ่ง Room Administrator คนอื่นสร้าง</p>
      {/* Not role="status": the shell's notice after a decision is the page's one status message. */}
      {load.kind === 'loading' && <p className="help" aria-live="polite">กำลังโหลดคำขอแก้ไข…</p>}
      {load.kind === 'forbidden' && (
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">{load.message}</span>
        </div>
      )}
      {failure && (
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">{failure}</span>
        </div>
      )}
      {load.kind === 'failed' && (
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">โหลดคำขอแก้ไขไม่สำเร็จ</span>
          <button type="button" className="btn btn-secondary" onClick={fetchPage}>
            โหลดใหม่
          </button>
        </div>
      )}
      {load.kind === 'ready' && load.data.total === 0 && (
        <div className="card">
          <p>ไม่มีคำขอแก้ไข</p>
        </div>
      )}
      {load.kind === 'ready' && load.data.total > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">การทำงาน</span></th>
                  <th scope="col">การจอง</th>
                  <th scope="col">ผู้สร้างคำขอ</th>
                  <th scope="col">ค่าที่ขอเปลี่ยน</th>
                  <th scope="col">เหตุผล</th>
                  <th scope="col">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {load.data.items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {/* UIC-001 — row actions in the first column · UIC-002 — design's action names as text. */}
                      <span className="row-actions">
                        <button
                          type="button"
                          className="more"
                          data-testid="ui-mrr-011-approve"
                          disabled={!r.canDecide || deciding !== null}
                          aria-busy={deciding === r.id || undefined}
                          aria-describedby={r.canDecide ? undefined : `own-${r.id}`}
                          onClick={() => decide('approve', r.id)}
                        >
                          อนุมัติคำขอ
                        </button>
                        <button
                          type="button"
                          className="more more-danger"
                          data-testid="ui-mrr-011-reject"
                          disabled={!r.canDecide || deciding !== null}
                          aria-describedby={r.canDecide ? undefined : `own-${r.id}`}
                          onClick={() => decide('reject', r.id)}
                        >
                          ปฏิเสธคำขอ
                        </button>
                      </span>
                      {!r.canDecide && <p className="help" id={`own-${r.id}`}>{OWN_REQUEST}</p>}
                    </td>
                    <td data-testid="ui-mrr-011-ent-011-booking">
                      {r.booking.roomName} <span className="time">{slotLabel(r.booking.startAt, r.booking.endAt)}</span>
                      <br />
                      <span className="clip" title={r.booking.title}>{r.booking.title}</span>
                    </td>
                    <td data-testid="ui-mrr-011-ent-011-requested-by">{r.requestedBy.fullName}</td>
                    <td data-testid="ui-mrr-011-ent-011-proposed-changes"><ProposedChanges request={r} /></td>
                    <td data-testid="ui-mrr-011-ent-011-reason">{r.reason}</td>
                    <td data-testid="ui-mrr-011-ent-011-status">{STATUS_LABEL[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={load.data.page} pageSize={load.data.pageSize} total={load.data.total} onPage={(n) => setParams({ page: String(n) })} />
        </div>
      )}
    </>
  );
}
