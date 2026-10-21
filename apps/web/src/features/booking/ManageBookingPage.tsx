import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, getJson, postJson } from '../../shared/api';
import { routeOf } from '../../shared/sitemap';
import { slotLabel } from '../../shared/time';
import { AuditTrail } from './AuditTrail';
import { checkTitle, TitleField } from './fields';
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

const holdsRoom = (b: Booking): boolean => b.status === 'CONFIRMED' || b.status === 'APPROVED';

/** ACL-011 condition — a booking that held its room, whose meeting has ended (the end itself counts). */
const meetingEnded = (b: Booking): boolean => holdsRoom(b) && new Date(b.endAt).getTime() <= Date.now();

/** ACL-010 condition — a booking that holds its room, from its start (10:00 counts) until its end. */
const meetingUnderWay = (b: Booking): boolean =>
  holdsRoom(b) && new Date(b.startAt).getTime() <= Date.now() && Date.now() < new Date(b.endAt).getTime();

/**
 * UI-mrr-010 — a Room Administrator's page for one booking, opened with ?booking=<id> from the
 * pending queue. The booking is read through API-007, which shows any booking to an administrator.
 * It carries the change of decision (API-013 · UC-mrr-008); while the meeting is under way, the edit
 * (API-014) and the cancellation (API-015) on behalf of the booker (UC-mrr-009); once it has ended,
 * the adjustment request (API-014 · UC-mrr-010) — the title only, both ways — and the booking's
 * trail (API-016 · UC-mrr-012), read again after each action here.
 */
export function ManageBookingPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const bookingId = params.get('booking') ?? '';

  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [trailVersion, setTrailVersion] = useState(0);

  const fetchBooking = useCallback(() => {
    setLoad({ kind: 'loading' });
    getJson<Booking>(`/bookings/${bookingId}`)
      .then((booking) => {
        setTitle(booking.title);
        setLoad({ kind: 'ready', booking });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) return setLoad({ kind: 'unauthorized' });
        if (err instanceof ApiError && err.status === 404) return setLoad({ kind: 'missing', message: err.message });
        setLoad({ kind: 'failed' });
      });
  }, [bookingId]);

  useEffect(fetchBooking, [fetchBooking]);

  const signedOut = useCallback(() => setLoad({ kind: 'unauthorized' }), []);
  // One place on the page whichever state it is in, so the trail keeps what it read.
  const withTrail = (page: JSX.Element) => (
    <>
      {page}
      <AuditTrail
        bookingId={bookingId}
        version={trailVersion}
        start={load.kind !== 'loading'}
        bookingMissing={load.kind === 'missing'}
        onUnauthorized={signedOut}
      />
    </>
  );

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
      setTrailVersion((v) => v + 1);
    } catch (err) {
      // The status stays as it was (UI-mrr-010 error state) and the reason stays typed.
      if (err instanceof ApiError && err.status === 401) return setLoad({ kind: 'unauthorized' });
      if (err instanceof ApiError && err.status === 400 && err.field === 'reason') return setReasonError(err.message);
      setFailure(err instanceof ApiError && err.status !== 500 ? err.message : 'เปลี่ยนผลการอนุมัติไม่สำเร็จ กรุณากดอีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  /**
   * UC-mrr-009 — while the meeting is under way the title changes at once (AC-mrr-042).
   * UC-mrr-010 — after the end the edit is kept as a request and the booking keeps its values until
   * another Room Administrator approves (BR-mrr-014). Either way the page reads the booking again.
   */
  const editOnBehalf = async (e: FormEvent, request: boolean) => {
    e.preventDefault();
    setFailure(null);
    const titleProblem = checkTitle(title);
    const reasonProblem = reason.trim() ? null : 'กรุณาระบุเหตุผล';
    setTitleError(titleProblem);
    setReasonError(reasonProblem);
    if (titleProblem || reasonProblem) return;
    setSaving(true);
    try {
      const done = await postJson<{ message: string }>(`/bookings/${bookingId}/admin-edit`, { title: title.trim(), reason: reason.trim() });
      setReason('');
      navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: { notice: done.message } });
      fetchBooking();
      setTrailVersion((v) => v + 1);
    } catch (err) {
      // Nothing is changed or requested; what was typed stays (UI-mrr-010 error state).
      if (err instanceof ApiError && err.status === 401) return setLoad({ kind: 'unauthorized' });
      if (err instanceof ApiError && err.status === 400 && err.field === 'reason') return setReasonError(err.message);
      if (err instanceof ApiError && err.status === 400 && err.field === 'title') return setTitleError(err.message);
      const fallback = request ? 'ส่งคำขอแก้ไขไม่สำเร็จ กรุณากดอีกครั้ง' : 'บันทึกการแก้ไขไม่สำเร็จ กรุณากดอีกครั้ง';
      setFailure(err instanceof ApiError && err.status !== 500 ? err.message : fallback);
    } finally {
      setSaving(false);
    }
  };

  /**
   * UC-mrr-009 — cancelled with a reason while the meeting is under way. The api mails the booker and
   * every attendee inside its transaction, so a mail that does not go cancels nothing (BR-mrr-019).
   */
  const cancelOnBehalf = async () => {
    setFailure(null);
    setTitleError(null);
    // AC-mrr-029 · AC-mrr-055 — no reason, nothing is sent and the trail gets no entry.
    if (!reason.trim()) return setReasonError('กรุณาระบุเหตุผล');
    setReasonError(null);
    setSaving(true);
    try {
      const done = await postJson<{ message: string }>(`/bookings/${bookingId}/admin-cancel`, { reason: reason.trim() });
      setReason('');
      navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: { notice: done.message } });
      fetchBooking();
      setTrailVersion((v) => v + 1);
    } catch (err) {
      // The booking stays as it was (UI-mrr-010 error state) — the meeting ended, or the mail did not go.
      if (err instanceof ApiError && err.status === 401) return setLoad({ kind: 'unauthorized' });
      if (err instanceof ApiError && err.status === 400 && err.field === 'reason') return setReasonError(err.message);
      setFailure(err instanceof ApiError && err.status !== 500 ? err.message : 'ยกเลิกการจองไม่สำเร็จ กรุณากดอีกครั้ง');
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
    return withTrail(
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
      </>,
    );
  }

  const { booking } = load;
  const target = changeTo(booking);
  // ACL-010 · ACL-011 enforced at the ui too: the title opens once the meeting has started — for a
  // direct edit while it is under way, for a request once it has ended.
  const underWay = meetingUnderWay(booking);
  const adjustable = meetingEnded(booking);
  const editable = underWay || adjustable;
  const onSubmit = (e: FormEvent) => {
    if (target) return changeDecision(e, target);
    if (editable) return editOnBehalf(e, adjustable);
    e.preventDefault();
  };
  return withTrail(
    <>
      {heading}
      <div className="card">
        <div className="grid">
          {editable ? (
            <TitleField id="ui-mrr-010-ent-007-title" value={title} onChange={setTitle} error={titleError ?? undefined} />
          ) : (
            <div className="field">
              <span className="label">หัวข้อ</span>
              <span className="value" data-testid="ui-mrr-010-ent-007-title">{booking.title}</span>
            </div>
          )}
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
      <form className="card" noValidate onSubmit={onSubmit}>
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
          {/* The admin-actions zone's order: edit-on-behalf · change-decision · cancel-on-behalf · back. */}
          {editable && (
            <button
              type="submit"
              className="btn btn-primary"
              data-testid="ui-mrr-010-edit-on-behalf"
              disabled={saving}
              aria-busy={saving || undefined}
            >
              แก้แทนผู้จอง
            </button>
          )}
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
          {/* ACL-010 enforced at the ui too: only while the meeting is under way. */}
          {underWay && (
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="ui-mrr-010-cancel-on-behalf"
              disabled={saving}
              onClick={cancelOnBehalf}
            >
              ยกเลิกแทนผู้จอง
            </button>
          )}
          {back}
          {underWay && <span className="help">ยกเลิกแล้ว ระบบจะส่ง Email แจ้งผู้จองและผู้เข้าร่วมทุกคน</span>}
          {adjustable && <span className="help">การประชุมจบแล้ว — การแก้ไขจะเป็นคำขอให้ผู้ดูแลห้องคนอื่นอนุมัติ</span>}
          {target && <span className="help">ผลใหม่จะเป็น '{STATUS_LABEL[target]}'</span>}
        </div>
      </form>
    </>,
  );
}
