import { FormEvent, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, getJson, postJson } from '../../shared/api';
import { routeOf } from '../../shared/sitemap';
import { bangkokInstant } from '../../shared/time';

interface Room {
  id: string;
  name: string;
  capacity: number;
  requiresApproval: boolean;
  status: 'ACTIVE' | 'UNDER_MAINTENANCE';
}

interface Option {
  id: string;
  name: string;
}

interface Person {
  id: string;
  fullName: string;
  email: string;
}

interface Created {
  id: string;
  status: 'CONFIRMED' | 'PENDING_APPROVAL';
  message: string;
}

type Field = 'start' | 'end' | 'title' | 'attendees' | 'equipment';
type Errors = Partial<Record<Field, string>>;

const SIGN_IN = 'UI-mrr-001';
/** confirm's destinationRef in screens.json. */
const MY_BOOKINGS = 'UI-mrr-007';
/** cancel-form's destinationRef. */
const SEARCH = 'UI-mrr-004';

const TITLE_MAX = 200;
const MAINTENANCE = 'ห้องนี้ปิดปรับปรุง ไม่สามารถจองได้';

/** The api's field names (FE-mrr-024 BookingInvalid · request body) mapped to this form's fields. */
const FIELD_OF: Record<string, Field> = {
  title: 'title', attendees: 'attendees', attendeeIds: 'attendees', start: 'start', startAt: 'start',
  end: 'end', endAt: 'end', equipment: 'equipment', equipmentIds: 'equipment',
};

/** The same checks the api makes first (BR-mrr-002 · UI-mrr-006 validation), with its words. */
function check(start: string, end: string, title: string, attendees: Person[]): Errors {
  const errors: Errors = {};
  if (!start) errors.start = 'กรุณาระบุเวลาเริ่ม';
  if (!end) errors.end = 'กรุณาระบุเวลาสิ้นสุด';
  else if (start && end <= start) errors.end = 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม';
  if (!title.trim()) errors.title = 'กรุณาระบุหัวข้อการประชุม';
  else if (title.trim().length > TITLE_MAX) errors.title = `หัวข้อการประชุมต้องไม่เกิน ${TITLE_MAX} ตัวอักษร`;
  if (attendees.length === 0) errors.attendees = 'กรุณาระบุผู้เข้าร่วมอย่างน้อย 1 คน';
  return errors;
}

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

  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Person[]>([]);
  const latestQuery = useRef('');

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

  const search = (text: string) => {
    setQuery(text);
    latestQuery.current = text;
    if (!text.trim()) return setMatches([]);
    getJson<Person[]>(`/users?query=${encodeURIComponent(text.trim())}`)
      .then((people) => {
        // An answer to an older keystroke never replaces a newer one.
        if (latestQuery.current === text) setMatches(people.filter((p) => !attendees.some((a) => a.id === p.id)));
      })
      .catch((err) => err instanceof ApiError && err.status === 401 && setUnauthorized(true));
  };

  const pick = (p: Person) => {
    setAttendees((list) => [...list, p]);
    setErrors(({ attendees: _, ...rest }) => rest);
    setQuery('');
    setMatches([]);
    latestQuery.current = '';
  };

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    const found = check(start, end, title, attendees);
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
          <div className={errors.title ? 'field err' : 'field'}>
            <label htmlFor="ui-mrr-006-ent-007-title">
              หัวข้อการประชุม<span className="req" aria-hidden="true">*</span>
            </label>
            <input
              className="input"
              id="ui-mrr-006-ent-007-title"
              type="text"
              name="หัวข้อการประชุม"
              data-testid="ui-mrr-006-ent-007-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? 'title-error' : undefined}
            />
            {errors.title && <span className="errtext" id="title-error">{errors.title}</span>}
          </div>
          <div className={errors.attendees ? 'field err' : 'field'}>
            <label htmlFor="ui-mrr-006-ent-008-user">
              ผู้เข้าร่วม<span className="req" aria-hidden="true">*</span>
            </label>
            {attendees.length > 0 && (
              <ul className="picked" aria-label="ผู้เข้าร่วมที่เลือก">
                {attendees.map((a) => (
                  <li key={a.id}>
                    {a.fullName}
                    <button
                      type="button"
                      aria-label={`เอา ${a.fullName} ออก`}
                      onClick={() => setAttendees((list) => list.filter((x) => x.id !== a.id))}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              className="input"
              id="ui-mrr-006-ent-008-user"
              type="search"
              name="ผู้เข้าร่วม"
              data-testid="ui-mrr-006-ent-008-user"
              placeholder="พิมพ์ชื่อหรือ Email เพื่อค้นหา"
              autoComplete="off"
              value={query}
              onChange={(e) => search(e.target.value)}
              aria-invalid={errors.attendees ? true : undefined}
              aria-describedby={errors.attendees ? 'attendees-error' : 'attendees-help'}
            />
            {matches.length > 0 && (
              <ul className="options" aria-label="ผลการค้นหาผู้ใช้">
                {matches.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => pick(p)}>
                      {p.fullName} ({p.email})
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {errors.attendees ? (
              <span className="errtext" id="attendees-error">{errors.attendees}</span>
            ) : (
              <span className="help" id="attendees-help">ผู้จองไม่ถูกนับเป็นผู้เข้าร่วม ถ้าจะเข้าร่วมด้วยให้เลือกชื่อตัวเอง</span>
            )}
          </div>
          <fieldset className="checks" data-testid="ui-mrr-006-ent-009-facility">
            <legend>อุปกรณ์เสริม</legend>
            {facilities.length === 0 && <span className="help">ไม่มีอุปกรณ์เสริมให้เลือก</span>}
            {facilities.map((f) => (
              <label key={f.id}>
                <input
                  type="checkbox"
                  name="อุปกรณ์เสริม"
                  value={f.id}
                  checked={equipment.includes(f.id)}
                  onChange={(e) =>
                    setEquipment((list) => (e.target.checked ? [...list, f.id] : list.filter((x) => x !== f.id)))
                  }
                />
                {f.name}
              </label>
            ))}
            {errors.equipment && <span className="errtext">{errors.equipment}</span>}
          </fieldset>
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

function TimeField(props: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string }) {
  const { id, label, value, onChange, error } = props;
  return (
    <div className={error ? 'field err' : 'field'}>
      <label htmlFor={id}>
        {label}<span className="req" aria-hidden="true">*</span>
      </label>
      <input
        className="input"
        id={id}
        type="datetime-local"
        name={label}
        data-testid={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && <span className="errtext" id={`${id}-error`}>{error}</span>}
    </div>
  );
}
