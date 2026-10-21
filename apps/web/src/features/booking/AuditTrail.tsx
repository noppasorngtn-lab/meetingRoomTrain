import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getJson } from '../../shared/api';
import { Pager } from '../../shared/Pager';
import { instantLabel } from '../../shared/time';

type AuditAction =
  | 'APPROVE' | 'REJECT' | 'CHANGE_DECISION' | 'EDIT_ON_BEHALF' | 'CANCEL_ON_BEHALF'
  | 'CREATE_ADJUSTMENT' | 'APPROVE_ADJUSTMENT' | 'REJECT_ADJUSTMENT';

interface AuditEntry {
  id: string;
  actor: { id: string; fullName: string };
  action: AuditAction;
  reason: string | null;
  at: string;
}

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; entries: AuditEntry[] }
  | { kind: 'refused'; message: string }
  | { kind: 'missing' }
  | { kind: 'failed' }
  | { kind: 'unauthorized' };

/**
 * ENT-010's actions in the words of the buttons that do them — UI-mrr-009 approve · reject,
 * UI-mrr-010's actions, UI-mrr-011 approve · reject. CREATE_ADJUSTMENT has no button of its own:
 * it is แก้แทนผู้จอง once the meeting has ended, kept as a request.
 */
const ACTION_LABEL: Record<AuditAction, string> = {
  APPROVE: 'อนุมัติ',
  REJECT: 'ปฏิเสธ',
  CHANGE_DECISION: 'เปลี่ยนผลการอนุมัติ',
  EDIT_ON_BEHALF: 'แก้แทนผู้จอง',
  CANCEL_ON_BEHALF: 'ยกเลิกแทนผู้จอง',
  CREATE_ADJUSTMENT: 'สร้างคำขอแก้ไข',
  APPROVE_ADJUSTMENT: 'อนุมัติคำขอ',
  REJECT_ADJUSTMENT: 'ปฏิเสธคำขอ',
};

/** UI-mrr-010 overflow — past this many entries the trail pages, the latest first. */
const PAGE_SIZE = 50;
/** UI-mrr-010 overflow — a reason longer than this folds behind its opening words. */
const SHORT_REASON = 60;

function Reason({ text }: { text: string | null }) {
  if (!text) return <>—</>;
  if (text.length <= SHORT_REASON) return <>{text}</>;
  return (
    <details>
      <summary>{text.slice(0, SHORT_REASON)}…</summary>
      {text}
    </details>
  );
}

/**
 * UI-mrr-010's trail — who · when · what · why on one booking (API-016 · UC-mrr-012), for a Room or
 * System Administrator. It is read on its own, so the api's refusal to a General User shows even
 * when the booking itself is not theirs to see (BR-mrr-018). It is first read once the booking has
 * answered (`start`), and again each time `version` changes after the page records an action.
 */
export function AuditTrail({
  bookingId, version, start, bookingMissing, onUnauthorized,
}: { bookingId: string; version: number; start: boolean; bookingMissing: boolean; onUnauthorized: () => void }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [page, setPage] = useState(1);
  // Started stays started: the booking is read again after each action, and that is not a reason to.
  const started = useRef(false);
  if (start) started.current = true;

  const fetchTrail = useCallback(() => {
    if (!bookingId) return;
    setLoad({ kind: 'loading' });
    getJson<AuditEntry[]>(`/bookings/${bookingId}/audit`)
      // The api lists the oldest first; the screen reads the latest first.
      .then((entries) => setLoad({ kind: 'ready', entries: [...entries].reverse() }))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) return setLoad({ kind: 'unauthorized' });
        if (err instanceof ApiError && err.status === 403) return setLoad({ kind: 'refused', message: err.message });
        if (err instanceof ApiError && err.status === 404) return setLoad({ kind: 'missing' });
        setLoad({ kind: 'failed' });
      });
  }, [bookingId]);

  useEffect(() => {
    if (!started.current) return;
    setPage(1);
    fetchTrail();
  }, [fetchTrail, version, started.current]);

  useEffect(() => {
    if (load.kind === 'unauthorized') onUnauthorized();
  }, [load.kind, onUnauthorized]);

  // The page already says the booking is not found; the trail adds nothing to that.
  if (!bookingId || load.kind === 'unauthorized' || (load.kind === 'missing' && bookingMissing)) return null;
  const shown = load.kind === 'ready' ? load.entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : [];
  return (
    <section className="card" aria-labelledby="audit-trail-heading">
      <h2 id="audit-trail-heading">ร่องรอย</h2>
      {load.kind === 'loading' && <p className="help" aria-live="polite">กำลังโหลดร่องรอย…</p>}
      {load.kind === 'refused' && (
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">{load.message}</span>
        </div>
      )}
      {load.kind === 'missing' && <p>ไม่พบการจอง</p>}
      {load.kind === 'failed' && (
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">โหลดร่องรอยไม่สำเร็จ</span>
          <button type="button" className="btn btn-secondary" onClick={fetchTrail}>
            โหลดใหม่
          </button>
        </div>
      )}
      {load.kind === 'ready' && load.entries.length === 0 && <p>ยังไม่มีการกระทำของผู้ดูแล</p>}
      {load.kind === 'ready' && load.entries.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">เวลา</th>
                  <th scope="col">ผู้กระทำ</th>
                  <th scope="col">การกระทำ</th>
                  <th scope="col">เหตุผล</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => (
                  <tr key={e.id}>
                    <td className="time" data-testid="ui-mrr-010-ent-010-at">{instantLabel(e.at)}</td>
                    <td data-testid="ui-mrr-010-ent-010-actor">{e.actor.fullName}</td>
                    <td data-testid="ui-mrr-010-ent-010-action">{ACTION_LABEL[e.action] ?? e.action}</td>
                    <td><Reason text={e.reason} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={load.entries.length} onPage={setPage} />
        </>
      )}
    </section>
  );
}
