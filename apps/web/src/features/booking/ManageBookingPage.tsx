import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, getJson, postJson } from '../../shared/api';
import { routeOf } from '../../shared/sitemap';
import { slotLabel } from '../../shared/time';
import { BookingStatus, STATUS_LABEL } from './status';

interface Booking {
  id: string;
  startAt: string;
  endAt: string;
  title: string;
  status: BookingStatus;
}

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; booking: Booking }
  | { kind: 'missing'; message: string }
  | { kind: 'failed' }
  | { kind: 'unauthorized' };

type Decision = 'APPROVED' | 'REJECTED';

const SIGN_IN = 'UI-mrr-001';
/** back's destination in screens.json. */
const PENDING = 'UI-mrr-009';

/** ACL-009 condition — a decision already made, changed before the meeting starts. */
const changeTo = (b: Booking): Decision | null => {
  if (new Date(b.startAt).getTime() <= Date.now()) return null;
  return b.status === 'APPROVED' ? 'REJECTED' : b.status === 'REJECTED' ? 'APPROVED' : null;
};

/**
 * UI-mrr-010 — a Room Administrator's page for one booking, opened with ?booking=<id> from the
 * pending queue. The booking is read through API-007, which shows any booking to an administrator.
 * This unit carries the change of decision (API-013 · UC-mrr-008); acting on behalf of the booker
 * and the trail arrive with their own units.
 */
export function ManageBookingPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const bookingId = params.get('booking') ?? '';

  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchBooking = useCallback(() => {
    setLoad({ kind: 'loading' });
    getJson<Booking>(`/bookings/${bookingId}`)
      .then((booking) => setLoad({ kind: 'ready', booking }))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) return setLoad({ kind: 'unauthorized' });
        if (err instanceof ApiError && err.status === 404) return setLoad({ kind: 'missing', message: err.message });
        setLoad({ kind: 'failed' });
      });
  }, [bookingId]);

  useEffect(fetchBooking, [fetchBooking]);

  const changeDecision = async (e: FormEvent, decision: Decision) => {
    e.preventDefault();
    setFailure(null);
    if (!reason.trim()) return setReasonError('กรุณาระบุเหตุผล');
    setReasonError(null);
    setSaving(true);
    try {
      const done = await postJson<{ message: string }>(`/bookings/${bookingId}/decision`, { decision, reason: reason.trim() });
      setReason('');
      // Said through the shell's notice, the same way every other page reports here.
      navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: { notice: done.message } });
      fetchBooking();
    } catch (err) {
      // The status stays as it was (UI-mrr-010 error state) and the reason stays typed.
      if (err instanceof ApiError && err.status === 401) return setLoad({ kind: 'unauthorized' });
      if (err instanceof ApiError && err.status === 400 && err.field === 'reason') return setReasonError(err.message);
      setFailure(err instanceof ApiError && err.status !== 500 ? err.message : 'เปลี่ยนผลการอนุมัติไม่สำเร็จ กรุณากดอีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  const back = (
    <button type="button" className="btn btn-secondary" data-testid="ui-mrr-010-back" onClick={() => navigate(routeOf(PENDING))}>
      กลับ
    </button>
  );

  // The states design declares for this page (screens.json UI-mrr-010).
  if (load.kind === 'unauthorized') return <Navigate to={routeOf(SIGN_IN)} replace />;
  const heading = (
    <>
      <h1>จัดการการจอง (ผู้ดูแล)</h1>
      <p className="purpose">Room Administrator เปลี่ยนผลการอนุมัติ แก้หรือยกเลิกแทนผู้จอง และดูร่องรอยของการจองหนึ่ง</p>
    </>
  );
  if (load.kind !== 'ready') {
    return (
      <>
        {heading}
        {/* Not role="status": the shell's notice after a change is the page's one status message. */}
        {load.kind === 'loading' && <p className="help" aria-live="polite">กำลังโหลดการจอง…</p>}
        {load.kind === 'missing' && (
          <div role="alert" className="alert alert-danger">
            <span className="alert-title">{load.message}</span>
          </div>
        )}
        {load.kind === 'failed' && (
          <div role="alert" className="alert alert-danger">
            <span className="alert-title">โหลดการจองไม่สำเร็จ</span>
            <button type="button" className="btn btn-secondary" onClick={fetchBooking}>
              โหลดใหม่
            </button>
          </div>
        )}
        <div className="actions">{back}</div>
      </>
    );
  }

  const { booking } = load;
  const target = changeTo(booking);
  return (
    <>
      {heading}
      <div className="card">
        <div className="grid">
          <div className="field">
            <span className="label">หัวข้อ</span>
            <span className="value" data-testid="ui-mrr-010-ent-007-title">{booking.title}</span>
          </div>
          <div className="field">
            <span className="label">ช่วงเวลา</span>
            <span className="value time" data-testid="ui-mrr-010-ent-007-start-at">{slotLabel(booking.startAt, booking.endAt)}</span>
          </div>
          <div className="field">
            <span className="label">สถานะ</span>
            <span className="value" data-testid="ui-mrr-010-ent-007-status">{STATUS_LABEL[booking.status]}</span>
          </div>
        </div>
      </div>
      {failure && (
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">{failure}</span>
        </div>
      )}
      <form className="card" noValidate onSubmit={(e) => target && changeDecision(e, target)}>
        <div className={reasonError ? 'field err' : 'field'}>
          <label htmlFor="ui-mrr-010-ent-010-reason">
            เหตุผล<span className="req" aria-hidden="true">*</span>
          </label>
          <textarea
            className="input"
            id="ui-mrr-010-ent-010-reason"
            name="เหตุผล"
            data-testid="ui-mrr-010-ent-010-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={reasonError ? 'ui-mrr-010-ent-010-reason-error' : undefined}
          />
          {reasonError && <span className="errtext" id="ui-mrr-010-ent-010-reason-error">{reasonError}</span>}
        </div>
        <div className="actions">
          {/* ACL-009 enforced at the ui too: offered only for a decision made and a meeting not started. */}
          {target && (
            <button
              type="submit"
              className="btn btn-primary"
              data-testid="ui-mrr-010-change-decision"
              disabled={saving}
              aria-busy={saving || undefined}
            >
              เปลี่ยนผลการอนุมัติ
            </button>
          )}
          {back}
          {target && <span className="help">ผลใหม่จะเป็น '{STATUS_LABEL[target]}'</span>}
        </div>
      </form>
    </>
  );
}
