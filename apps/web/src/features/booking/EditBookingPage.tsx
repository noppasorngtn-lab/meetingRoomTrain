import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, getJson, patchJson } from '../../shared/api';
import { routeOf } from '../../shared/sitemap';
import { bangkokInstant, bangkokLocal } from '../../shared/time';
import {
  AttendeePicker, checkForm, EquipmentChecks, Errors, FIELD_OF, Option, Person, TimeField, TitleField,
} from './fields';
import { BookingStatus, canEdit, STATUS_LABEL } from './status';

interface Booking {
  id: string;
  roomName: string;
  startAt: string;
  endAt: string;
  title: string;
  status: BookingStatus;
  attendees: Person[];
  equipment: Option[];
}

const SIGN_IN = 'UI-mrr-001';
/** save's and back's destinationRef in screens.json. */
const MY_BOOKINGS = 'UI-mrr-007';
/** The unauthorized state's words (screens.json UI-mrr-008). */
const LOCKED = 'แก้ไขการจองนี้ไม่ได้';

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; booking: Booking }
  | { kind: 'failed' }
  | { kind: 'locked' }
  | { kind: 'unauthorized' };

/**
 * UI-mrr-008 — the booker edits their booking before it starts (API-007 · API-008). Opened from
 * my bookings with ?booking=<id>. Someone who is not the booker, or a booking already started,
 * gets no form at all.
 */
export function EditBookingPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = params.get('booking') ?? '';

  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [facilities, setFacilities] = useState<Option[]>([]);

  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [title, setTitle] = useState('');
  const [attendees, setAttendees] = useState<Person[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);

  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getJson<Booking>(`/bookings/${bookingId}`)
      .then((b) => {
        if (!canEdit(b)) return setLoad({ kind: 'locked' });
        setStart(bangkokLocal(b.startAt));
        setEnd(bangkokLocal(b.endAt));
        setTitle(b.title);
        setAttendees(b.attendees);
        setEquipment(b.equipment.map((e) => e.id));
        setLoad({ kind: 'ready', booking: b });
      })
      .catch((err) => {
        // The api answers 404 to anyone who is not the booker, so it reads as "cannot edit".
        if (err instanceof ApiError && err.status === 401) return setLoad({ kind: 'unauthorized' });
        setLoad(err instanceof ApiError && err.status === 404 ? { kind: 'locked' } : { kind: 'failed' });
      });
    getJson<Option[]>('/facilities?active=true').then(setFacilities).catch(() => undefined);
  }, [bookingId]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const found = checkForm(start, end, title, attendees);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const before = load.kind === 'ready' ? load.booking.equipment.map((e) => e.id).sort().join() : '';
      const saved = await patchJson<{ message: string }>(`/bookings/${bookingId}`, {
        startAt: bangkokInstant(start),
        endAt: bangkokInstant(end),
        title: title.trim(),
        attendeeIds: attendees.map((a) => a.id),
        // Sent only when changed: equipment no longer offered stays on the booking untouched (ENT-004 active).
        ...([...equipment].sort().join() === before ? {} : { equipmentIds: equipment }),
      });
      navigate(routeOf(MY_BOOKINGS), { state: { notice: saved.message } });
    } catch (err) {
      // The booking keeps its old values and the form keeps what was typed (UI-mrr-008 error state).
      if (err instanceof ApiError && err.status === 401) return setLoad({ kind: 'unauthorized' });
      if (err instanceof ApiError && err.status === 403) return setLoad({ kind: 'locked' });
      const field = err instanceof ApiError && err.status === 400 && err.field ? FIELD_OF[err.field] : undefined;
      if (field) setErrors({ [field]: (err as ApiError).message });
      else setFailure(err instanceof ApiError && err.status !== 500 ? err.message : 'บันทึกไม่สำเร็จ กรุณากดบันทึกอีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  const back = (
    <button type="button" className="btn btn-secondary" data-testid="ui-mrr-008-back" onClick={() => navigate(routeOf(MY_BOOKINGS))}>
      กลับ
    </button>
  );

  // The states design declares for this page (screens.json UI-mrr-008).
  if (load.kind === 'unauthorized') return <Navigate to={routeOf(SIGN_IN)} replace />;
  const heading = (
    <>
      <h1>แก้ไขการจอง</h1>
      <p className="purpose">ผู้จองแก้เวลา หัวข้อ ผู้เข้าร่วม หรืออุปกรณ์เสริมของการจองตนเองก่อนเวลาเริ่ม</p>
    </>
  );
  if (load.kind !== 'ready') {
    return (
      <>
        {heading}
        {load.kind === 'loading' && <p role="status">กำลังโหลดการจอง…</p>}
        {load.kind === 'locked' && (
          <div role="alert" className="alert alert-danger">
            <span className="alert-title">{LOCKED}</span>
          </div>
        )}
        {load.kind === 'failed' && (
          <div role="alert" className="alert alert-danger">
            <span className="alert-title">โหลดการจองไม่สำเร็จ ลองเปิดหน้านี้ใหม่อีกครั้ง</span>
          </div>
        )}
        <div className="actions">{back}</div>
      </>
    );
  }

  const { booking } = load;
  return (
    <>
      {heading}
      {failure && (
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">{failure}</span>
        </div>
      )}
      <form noValidate onSubmit={save}>
        <div className="card">
          <h2>{booking.roomName}</h2>
          <div className="grid">
            <TimeField id="ui-mrr-008-ent-007-start-at" label="เวลาเริ่ม" value={start} onChange={setStart} error={errors.start} />
            <TimeField id="ui-mrr-008-ent-007-end-at" label="เวลาสิ้นสุด" value={end} onChange={setEnd} error={errors.end} />
          </div>
          <span className="help">เปลี่ยนเวลาแล้ว ระบบจะส่ง Email แจ้งผู้จองและผู้เข้าร่วมทุกคน</span>
        </div>
        <div className="card">
          <TitleField id="ui-mrr-008-ent-007-title" value={title} onChange={setTitle} error={errors.title} />
          <AttendeePicker
            id="ui-mrr-008-ent-008-user"
            value={attendees}
            onChange={(people) => {
              setAttendees(people);
              setErrors(({ attendees: _, ...rest }) => rest);
            }}
            onUnauthorized={() => setLoad({ kind: 'unauthorized' })}
            error={errors.attendees}
          />
          <EquipmentChecks
            id="ui-mrr-008-ent-009-facility"
            options={[...facilities, ...booking.equipment.filter((e) => !facilities.some((f) => f.id === e.id))]}
            value={equipment}
            onChange={setEquipment}
            error={errors.equipment}
          />
          <div className="field">
            <span className="label">สถานะ</span>
            <span className="value" data-testid="ui-mrr-008-ent-007-status">{STATUS_LABEL[booking.status]}</span>
          </div>
        </div>
        <div className="actions">
          <button type="submit" className="btn btn-primary" data-testid="ui-mrr-008-save" disabled={saving} aria-busy={saving || undefined}>
            บันทึก
          </button>
          {back}
          {saving && <span role="status" className="help">กำลังบันทึกและส่ง Email…</span>}
        </div>
      </form>
    </>
  );
}
