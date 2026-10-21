import { FormEvent, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, getJson, postJson } from '../../shared/api';
import { routeOf } from '../../shared/sitemap';
import { RoomRow } from './RoomsPage';

interface Option {
  id: string;
  name: string;
}

interface Person {
  id: string;
  fullName: string;
  email?: string;
}

/** API-022 as a Room Administrator reads it — the whole current version an edit starts from. */
interface RoomDetail extends RoomRow {
  photos: string[];
  facilityIds: string[];
}

type Field = 'code' | 'name' | 'capacity' | 'photos' | 'facilities' | 'approver';
type Errors = Partial<Record<Field, string>>;

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; room: RoomDetail | null }
  | { kind: 'failed' }
  | { kind: 'missing' }
  | { kind: 'forbidden' }
  | { kind: 'unauthorized' };

const SIGN_IN = 'UI-mrr-001';
/** save's and back's destinationRef in screens.json. */
const ROOMS = 'UI-mrr-012';
/** The unauthorized state's words (screens.json UI-mrr-013). */
const FORBIDDEN = 'คุณไม่มีสิทธิ์เข้าหน้านี้';
const NAME_MAX = 100;

/** The api's field names (RoomInvalid · request body) mapped to the form's fields. */
const FIELD_OF: Record<string, Field> = {
  code: 'code', name: 'name', capacity: 'capacity', photos: 'photos', facilityIds: 'facilities', approverId: 'approver',
};

/** The same checks the api makes first, with its words. */
function checkForm(creating: boolean, code: string, name: string, capacity: string): Errors {
  const errors: Errors = {};
  if (creating && !code.trim()) errors.code = 'กรุณาระบุรหัสห้อง';
  if (!name.trim()) errors.name = 'กรุณาระบุชื่อห้อง';
  else if (name.trim().length > NAME_MAX) errors.name = `ชื่อห้องต้องไม่เกิน ${NAME_MAX} ตัวอักษร`;
  if (!/^\d+$/.test(capacity.trim()) || Number(capacity) < 1) errors.capacity = 'ความจุต้องเป็นจำนวนเต็มตั้งแต่ 1';
  return errors;
}

/**
 * UI-mrr-013 — a Room Administrator adds a room (API-021) or saves its next version (API-023).
 * Opened from the rooms with ?room=<id> to edit; without it the form is a new room, every field
 * empty and approval off. A version is whole, so an edit sends back what it did not change.
 */
export function RoomFormPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const roomId = params.get('room');

  const [load, setLoad] = useState<Load>(roomId ? { kind: 'loading' } : { kind: 'ready', room: null });
  const [facilities, setFacilities] = useState<Option[]>([]);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [approver, setApprover] = useState<Person | null>(null);

  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getJson<Option[]>('/facilities?active=true').then(setFacilities).catch(() => undefined);
    if (!roomId) return;
    getJson<RoomDetail | { code?: undefined }>(`/rooms/${roomId}`)
      .then((r) => {
        // Anyone else is answered with the booking form's few fields, and no code among them.
        if (r.code === undefined) return setLoad({ kind: 'forbidden' });
        const room = r as RoomDetail;
        setCode(room.code);
        setName(room.name);
        setCapacity(String(room.capacity));
        setPhotos(room.photos);
        setChosen(room.facilityIds);
        setRequiresApproval(room.requiresApproval);
        setApprover(room.approver);
        setLoad({ kind: 'ready', room });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) return setLoad({ kind: 'unauthorized' });
        setLoad(err instanceof ApiError && err.status === 404 ? { kind: 'missing' } : { kind: 'failed' });
      });
  }, [roomId]);

  // A facility since taken out of use cannot be chosen for a new version, so saving leaves it out.
  const offered = chosen.filter((id) => facilities.some((f) => f.id === id));
  const retired = chosen.length - offered.length;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const found = checkForm(!roomId, code, name, capacity);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) return;
    setSaving(true);
    const version = {
      name: name.trim(),
      capacity: Number(capacity),
      photos,
      facilityIds: offered,
      requiresApproval,
      approverId: approver?.id ?? null,
    };
    try {
      const saved = roomId
        ? await postJson<{ message: string }>(`/rooms/${roomId}/versions`, version)
        : await postJson<{ id: string; message: string }>('/rooms', { code: code.trim(), ...version });
      navigate(routeOf(ROOMS), { state: { notice: saved.message } });
    } catch (err) {
      // No new version is made and the form keeps what was typed (UI-mrr-013 error state).
      if (err instanceof ApiError && err.status === 401) return setLoad({ kind: 'unauthorized' });
      const field = err instanceof ApiError && err.status === 400 && err.field ? FIELD_OF[err.field] : undefined;
      if (field) setErrors({ [field]: (err as ApiError).message });
      // 403 says เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้ (AC-mrr-017 · AC-mrr-018).
      else setFailure(err instanceof ApiError && err.status !== 500 ? err.message : 'บันทึกไม่สำเร็จ กรุณากดบันทึกอีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  const back = (
    <button type="button" className="btn btn-secondary" data-testid="ui-mrr-013-back" onClick={() => navigate(routeOf(ROOMS))}>
      กลับ
    </button>
  );

  // The states design declares for this page (screens.json UI-mrr-013).
  if (load.kind === 'unauthorized') return <Navigate to={routeOf(SIGN_IN)} replace />;
  const heading = (
    <>
      <h1>ข้อมูลห้อง</h1>
      <p className="purpose">Room Administrator กรอกหรือแก้ข้อมูลห้อง — ทุกการบันทึกสร้างเวอร์ชันใหม่</p>
    </>
  );
  if (load.kind !== 'ready') {
    return (
      <>
        {heading}
        {load.kind === 'loading' && <p role="status">กำลังโหลดข้อมูลห้อง…</p>}
        {load.kind !== 'loading' && (
          <div role="alert" className="alert alert-danger">
            <span className="alert-title">
              {load.kind === 'forbidden' ? FORBIDDEN : load.kind === 'missing' ? 'ไม่พบห้อง' : 'โหลดข้อมูลห้องไม่สำเร็จ ลองเปิดหน้านี้ใหม่อีกครั้ง'}
            </span>
          </div>
        )}
        <div className="actions">{back}</div>
      </>
    );
  }

  const { room } = load;
  const fieldClass = (f: Field) => (errors[f] ? 'field err' : 'field');
  const describe = (f: Field, id: string) => (errors[f] ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {});
  const errorOf = (f: Field, id: string) => errors[f] && <span className="errtext" id={`${id}-error`}>{errors[f]}</span>;

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
          <div className="grid">
            <div className={fieldClass('code')}>
              <label htmlFor="ui-mrr-013-ent-002-code">
                รหัสห้อง<span className="req" aria-hidden="true">*</span>
              </label>
              {/* Typed once when the room is made, fixed from then on (ENT-002). */}
              <input
                className="input"
                id="ui-mrr-013-ent-002-code"
                type="text"
                name="รหัสห้อง"
                data-testid="ui-mrr-013-ent-002-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                readOnly={room !== null}
                required
                {...describe('code', 'ui-mrr-013-ent-002-code')}
              />
              {errorOf('code', 'ui-mrr-013-ent-002-code')}
            </div>
            <div className={fieldClass('name')}>
              <label htmlFor="ui-mrr-013-ent-003-name">
                ชื่อห้อง<span className="req" aria-hidden="true">*</span>
              </label>
              <input
                className="input"
                id="ui-mrr-013-ent-003-name"
                type="text"
                name="ชื่อห้อง"
                data-testid="ui-mrr-013-ent-003-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                {...describe('name', 'ui-mrr-013-ent-003-name')}
              />
              {errorOf('name', 'ui-mrr-013-ent-003-name')}
            </div>
            <div className={fieldClass('capacity')}>
              <label htmlFor="ui-mrr-013-ent-003-capacity">
                ความจุ<span className="req" aria-hidden="true">*</span>
              </label>
              <input
                className="input"
                id="ui-mrr-013-ent-003-capacity"
                type="number"
                min={1}
                step={1}
                name="ความจุ"
                data-testid="ui-mrr-013-ent-003-capacity"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                required
                {...describe('capacity', 'ui-mrr-013-ent-003-capacity')}
              />
              {errorOf('capacity', 'ui-mrr-013-ent-003-capacity')}
            </div>
          </div>
          <div className={fieldClass('photos')} data-testid="ui-mrr-013-ent-003-photos">
            <span className="label">รูปภาพ</span>
            {/* No upload is declared yet; a room's photos are kept as they are on every save. */}
            <span className="value">{photos.length ? `${photos.length} รูป` : 'ไม่มีรูปภาพ'}</span>
            <span className="help">ยังเพิ่มหรือเปลี่ยนรูปภาพจากหน้านี้ไม่ได้</span>
            {errorOf('photos', 'ui-mrr-013-ent-003-photos')}
          </div>
          <fieldset className="checks" data-testid="ui-mrr-013-ent-005-facility">
            <legend>สิ่งอำนวยความสะดวก</legend>
            {facilities.length === 0 && <span className="help">ไม่มีสิ่งอำนวยความสะดวกให้เลือก</span>}
            {facilities.map((f) => (
              <label key={f.id}>
                <input
                  type="checkbox"
                  name="สิ่งอำนวยความสะดวก"
                  value={f.id}
                  checked={chosen.includes(f.id)}
                  onChange={(e) => setChosen(e.target.checked ? [...chosen, f.id] : chosen.filter((x) => x !== f.id))}
                />
                {f.name}
              </label>
            ))}
            {retired > 0 && <span className="help">สิ่งอำนวยความสะดวกที่ปิดใช้แล้ว {retired} รายการจะไม่อยู่ในเวอร์ชันใหม่</span>}
            {errors.facilities && <span className="errtext">{errors.facilities}</span>}
          </fieldset>
          <div className="field">
            <span className="label">เวอร์ชัน</span>
            <span className="value" data-testid="ui-mrr-013-ent-003-version-no">{room ? room.versionNo : 'ห้องใหม่'}</span>
          </div>
        </div>
        <div className="card">
          <label className="check">
            <input
              type="checkbox"
              name="ต้องอนุมัติ"
              data-testid="ui-mrr-013-ent-003-requires-approval"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
            />
            ต้องอนุมัติ
          </label>
          <span className="help">มีผลกับการจองที่ยังไม่ถึงเวลาเริ่มด้วย</span>
          <ApproverPicker
            id="ui-mrr-013-ent-003-approver"
            value={approver}
            onChange={(p) => {
              setApprover(p);
              setErrors(({ approver: _, ...rest }) => rest);
            }}
            onUnauthorized={() => setLoad({ kind: 'unauthorized' })}
            error={errors.approver}
          />
        </div>
        <div className="actions">
          <button type="submit" className="btn btn-primary" data-testid="ui-mrr-013-save" disabled={saving} aria-busy={saving || undefined}>
            บันทึก
          </button>
          {back}
          {saving && <span role="status" className="help">กำลังบันทึก…</span>}
        </div>
      </form>
    </>
  );
}

/** One person found through API-005, or none — the api accepts only a Room Administrator (BR-mrr-013). */
function ApproverPicker(props: {
  id: string;
  value: Person | null;
  onChange: (p: Person | null) => void;
  onUnauthorized: () => void;
  error?: string;
}) {
  const { id, value, onChange, onUnauthorized, error } = props;
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Person[]>([]);
  const latest = useRef('');

  const search = (text: string) => {
    setQuery(text);
    latest.current = text;
    if (!text.trim()) return setMatches([]);
    getJson<Person[]>(`/users?query=${encodeURIComponent(text.trim())}`)
      .then((people) => {
        // An answer to an older keystroke never replaces a newer one.
        if (latest.current === text) setMatches(people);
      })
      .catch((err) => err instanceof ApiError && err.status === 401 && onUnauthorized());
  };

  const pick = (p: Person) => {
    onChange(p);
    setQuery('');
    setMatches([]);
    latest.current = '';
  };

  return (
    <div className={error ? 'field err' : 'field'}>
      <label htmlFor={id}>ผู้อนุมัติประจำห้อง</label>
      {value && (
        <ul className="picked" aria-label="ผู้อนุมัติประจำห้องที่เลือก">
          <li>
            {value.fullName}
            <button type="button" aria-label={`เอา ${value.fullName} ออก`} onClick={() => onChange(null)}>
              ✕
            </button>
          </li>
        </ul>
      )}
      <input
        className="input"
        id={id}
        type="search"
        name="ผู้อนุมัติประจำห้อง"
        data-testid={id}
        placeholder="พิมพ์ชื่อหรือ Email เพื่อค้นหา"
        autoComplete="off"
        value={query}
        onChange={(e) => search(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : `${id}-help`}
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
      {error ? (
        <span className="errtext" id={`${id}-error`}>{error}</span>
      ) : (
        <span className="help" id={`${id}-help`}>ว่างไว้ได้ — ผู้ดูแลห้องทุกคนอนุมัติได้ และกำหนดทีหลังได้</span>
      )}
    </div>
  );
}
