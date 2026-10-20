import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, getJson, postJson } from '../../shared/api';
import { Pager } from '../../shared/Pager';
import { routeOf } from '../../shared/sitemap';
import { slotLabel } from '../../shared/time';

interface Person {
  id: string;
  fullName: string;
}

interface PendingBooking {
  id: string;
  roomId: string;
  roomName: string;
  startAt: string;
  endAt: string;
  title: string;
  bookedBy: Person;
  approver: Person | null;
  /** The api's answer to "may I decide this one" — the room names someone else as its approver when not. */
  canDecide: boolean;
}

interface PendingPage {
  items: PendingBooking[];
  page: number;
  pageSize: number;
  total: number;
}

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; data: PendingPage }
  | { kind: 'failed' }
  | { kind: 'forbidden'; message: string }
  | { kind: 'unauthorized' };

type Verb = 'approve' | 'reject';

const SIGN_IN = 'UI-mrr-001';
/** approve's and reject's destination in screens.json — they stay here. */
const PENDING = 'UI-mrr-009';
/** manage's destination in screens.json. */
const MANAGE = 'UI-mrr-010';

/**
 * UI-mrr-009 — a Room Administrator's queue of bookings waiting for approval (API-010), approved
 * or rejected right here (API-011 · API-012). 20 to a page, the nearest start first; ?page=<n>
 * picks the page. A room whose approver is someone else shows its buttons disabled, and the api
 * refuses it anyway (ACL-008 · BR-mrr-013).
 */
export function PendingApprovalsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const page = Number(params.get('page')) || 1;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [deciding, setDeciding] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const fetchPage = useCallback(() => {
    setLoad({ kind: 'loading' });
    getJson<PendingPage>(`/bookings?status=PENDING_APPROVAL&page=${page}`)
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
      const done = await postJson<{ message: string }>(`/bookings/${id}/${verb}`, {});
      // Said through the shell's notice; the decided booking leaves the queue on the next read.
      navigate({ pathname: routeOf(PENDING), search: params.toString() }, { replace: true, state: { notice: done.message } });
      fetchPage();
    } catch (err) {
      // The booking stays pending (UI-mrr-009 error state) — the api says why: not this room's
      // approver, already decided, or the mail did not go and the person should press again.
      if (err instanceof ApiError && err.status === 401) return setLoad({ kind: 'unauthorized' });
      setFailure(err instanceof ApiError && err.status !== 500 ? err.message : 'บันทึกผลไม่สำเร็จ กรุณากดอีกครั้ง');
    } finally {
      setDeciding(null);
    }
  };

  // The states design declares for this page (screens.json UI-mrr-009).
  if (load.kind === 'unauthorized') return <Navigate to={routeOf(SIGN_IN)} replace />;
  return (
    <>
      <h1>รายการรออนุมัติ</h1>
      <p className="purpose">Room Administrator ดูการจองที่รออนุมัติแล้วอนุมัติหรือปฏิเสธ</p>
      {/* Not role="status": the shell's notice after a decision is the page's one status message. */}
      {load.kind === 'loading' && <p className="help" aria-live="polite">กำลังโหลดรายการรออนุมัติ…</p>}
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
          <span className="alert-title">โหลดรายการรออนุมัติไม่สำเร็จ</span>
          <button type="button" className="btn btn-secondary" onClick={fetchPage}>
            โหลดใหม่
          </button>
        </div>
      )}
      {load.kind === 'ready' && load.data.total === 0 && (
        <div className="card">
          <p>ไม่มีรายการรออนุมัติ</p>
        </div>
      )}
      {load.kind === 'ready' && load.data.total > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">การทำงาน</span></th>
                  <th scope="col">ห้อง</th>
                  <th scope="col">ช่วงเวลา</th>
                  <th scope="col">หัวข้อ</th>
                  <th scope="col">ผู้จอง</th>
                  <th scope="col">ผู้อนุมัติประจำห้อง</th>
                </tr>
              </thead>
              <tbody>
                {load.data.items.map((b) => (
                  <tr key={b.id}>
                    <td>
                      {/* UIC-001 — row actions in the first column: manage before command. */}
                      <span className="row-actions">
                        <button
                          type="button"
                          className="more"
                          data-testid="ui-mrr-009-manage"
                          onClick={() => navigate(`${routeOf(MANAGE)}?booking=${b.id}`)}
                        >
                          จัดการการจอง
                        </button>
                        <button
                          type="button"
                          className="more"
                          data-testid="ui-mrr-009-approve"
                          disabled={!b.canDecide || deciding !== null}
                          aria-busy={deciding === b.id || undefined}
                          onClick={() => decide('approve', b.id)}
                        >
                          อนุมัติ
                        </button>
                        <button
                          type="button"
                          className="more more-danger"
                          data-testid="ui-mrr-009-reject"
                          disabled={!b.canDecide || deciding !== null}
                          onClick={() => decide('reject', b.id)}
                        >
                          ปฏิเสธ
                        </button>
                      </span>
                    </td>
                    <td data-testid="ui-mrr-009-ent-007-room">{b.roomName}</td>
                    <td className="time" data-testid="ui-mrr-009-ent-007-start-at">{slotLabel(b.startAt, b.endAt)}</td>
                    <td className="clip" title={b.title} data-testid="ui-mrr-009-ent-007-title">{b.title}</td>
                    <td data-testid="ui-mrr-009-ent-007-booked-by">{b.bookedBy.fullName}</td>
                    {/* Empty means any Room Administrator may decide (BR-mrr-013). */}
                    <td data-testid="ui-mrr-009-ent-003-approver">{b.approver ? b.approver.fullName : 'ไม่กำหนด'}</td>
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
