import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, getJson, postJson } from '../../shared/api';
import { routeOf } from '../../shared/sitemap';
import { bangkokInstant } from '../../shared/time';
import {
  AttendeePicker, checkForm, EquipmentChecks, Errors, FIELD_OF, Option, Person, TimeField, TitleField,
} from './fields';

interface Room {
  id: string;
  name: string;
  capacity: number;
  requiresApproval: boolean;
  status: 'ACTIVE' | 'UNDER_MAINTENANCE';
}

interface Created {
  id: string;
  status: 'CONFIRMED' | 'PENDING_APPROVAL';
  message: string;
}

const SIGN_IN = 'UI-mrr-001';
/** confirm's destinationRef in screens.json. */
const MY_BOOKINGS = 'UI-mrr-007';
/** cancel-form's destinationRef. */
const SEARCH = 'UI-mrr-004';

const MAINTENANCE = 'ห้องนี้ปิดปรับปรุง ไม่สามารถจองได้';

/** `?date=2026-10-17&start=10:00` → `2026-10-17T10:00`, the value a datetime-local input takes. */
const localOf = (date: string | null, time: string | null) =>
  date && time && /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) ? `${date}T${time}` : '';

/**
 * UI-mrr-006 — create a booking (API-004). The room and the time chosen on the previous page arrive
 * in the URL (?room=&date=&start=&end=); the booker is whoever is signed in.
 */
export function BookingPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const roomId = params.get('room') ?? '';

  const [room, setRoom] = useState<Room | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [facilities, setFacilities] = useState<Option[]>([]);
  const [unauthorized, setUnauthorized] = useState(false);

  const [start, setStart] = useState(localOf(params.get('date'), params.get('start')));
  const [end, setEnd] = useState(localOf(params.get('date'), params.get('end')));
  const [title, setTitle] = useState('');
  const [attendees, setAttendees] = useState<Person[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);

  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onFail = (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) setUnauthorized(true);
    };
    getJson<Room>(`/rooms/${roomId}`)
      .then(setRoom)
      .catch((err) => {
        onFail(err);
        setRoomError(err instanceof ApiError && err.status === 404 ? 'ไม่พบห้อง' : 'โหลดข้อมูลห้องไม่สำเร็จ ลองเปิดหน้านี้ใหม่อีกครั้ง');
      });
    getJson<Option[]>('/facilities?active=true').then(setFacilities).catch(onFail);
  }, [roomId]);

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    const found = checkForm(start, end, title, attendees);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const created = await postJson<Created>('/bookings', {
        roomId,
        startAt: bangkokInstant(start),
        endAt: bangkokInstant(end),
        title: title.trim(),
        attendeeIds: attendees.map((a) => a.id),
        equipmentIds: equipment,
      });
      navigate(routeOf(MY_BOOKINGS), { state: { notice: created.message } });
    } catch (err) {
      // Whatever went wrong, what the user typed stays on the form (UI-mrr-006 error state).
      if (err instanceof ApiError && err.status === 401) return setUnauthorized(true);
      const field = err instanceof ApiError && err.status === 400 && err.field ? FIELD_OF[err.field] : undefined;
      if (field) setErrors({ [field]: (err as ApiError).message });
      else setFailure(err instanceof ApiError && err.status !== 500 ? err.message : 'จองไม่สำเร็จ กรุณากดยืนยันอีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  // The states design declares for this page (screens.json UI-mrr-006).
  if (unauthorized) return <Navigate to={routeOf(SIGN_IN)} replace />;
  const closed = room?.status === 'UNDER_MAINTENANCE';
  const overCapacity = room !== null && attendees.length > room.capacity;

  return (
    <>
      <h1>จองห้องประชุม</h1>
      <p className="purpose">สร้างการจองห้องพร้อมหัวข้อ ผู้เข้าร่วม และอุปกรณ์เสริม</p>
      {roomError && (
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">{roomError}</span>
        </div>
      )}
      {closed && (
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">{MAINTENANCE}</span>
        </div>
      )}
      {failure && (
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">{failure}</span>
        </div>
      )}
      {overCapacity && (
        <div role="status" className="alert alert-warning">
          <span className="alert-title">ผู้เข้าร่วมเกินความจุห้อง</span>
          <span>ห้องนี้รองรับ {room!.capacity} คน ยังยืนยันการจองได้</span>
        </div>
      )}
      <form noValidate onSubmit={confirm}>
        <div className="card">
          <h2>ห้องและเวลา</h2>
          <div className="grid">
            <div className="field">
              <span className="label">ห้อง</span>
              <span className="value" data-testid="ui-mrr-006-ent-007-room">
                {room ? room.name : roomError ? '—' : 'กำลังโหลด…'}
              </span>
              {room?.requiresApproval && <span className="help">ห้องนี้ต้องรออนุมัติก่อนใช้งาน</span>}
            </div>
            <TimeField id="ui-mrr-006-ent-007-start-at" label="เวลาเริ่ม" value={start} onChange={setStart} error={errors.start} />
            <TimeField id="ui-mrr-006-ent-007-end-at" label="เวลาสิ้นสุด" value={end} onChange={setEnd} error={errors.end} />
          </div>
        </div>
        <div className="card">
          <h2>รายละเอียด</h2>
          <TitleField id="ui-mrr-006-ent-007-title" value={title} onChange={setTitle} error={errors.title} />
          <AttendeePicker
            id="ui-mrr-006-ent-008-user"
            value={attendees}
            onChange={(people) => {
              setAttendees(people);
              setErrors(({ attendees: _, ...rest }) => rest);
            }}
            onUnauthorized={() => setUnauthorized(true)}
            error={errors.attendees}
          />
          <EquipmentChecks
            id="ui-mrr-006-ent-009-facility"
            options={facilities}
            value={equipment}
            onChange={setEquipment}
            error={errors.equipment}
          />
        </div>
        <div className="actions">
          <button
            type="submit"
            className="btn btn-primary"
            data-testid="ui-mrr-006-confirm"
            disabled={saving || closed || !room}
            aria-busy={saving || undefined}
          >
            ยืนยันการจอง
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="ui-mrr-006-cancel-form"
            onClick={() => navigate(routeOf(SEARCH))}
          >
            ยกเลิก
          </button>
          {saving && <span role="status" className="help">กำลังบันทึกและส่ง Email…</span>}
        </div>
      </form>
    </>
  );
}
