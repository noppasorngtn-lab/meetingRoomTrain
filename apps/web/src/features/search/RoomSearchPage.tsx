import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiError, getJson } from '../../shared/api';
import { Pager } from '../../shared/Pager';
import { routeOf } from '../../shared/sitemap';
import { bangkokDate } from '../../shared/time';

interface AvailableRoom {
  id: string;
  name: string;
  capacity: number;
  requiresApproval: boolean;
}

interface Facility {
  id: string;
  name: string;
}

type Result =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; rooms: AvailableRoom[] }
  | { kind: 'failed' }
  | { kind: 'unauthorized' };

type Field = 'date' | 'start' | 'end' | 'attendees';
type Errors = Partial<Record<Field, string>>;

const SIGN_IN = 'UI-mrr-001';
/** view-calendar and book — their destinationRef in screens.json. */
const CALENDAR = 'UI-mrr-005';
const BOOKING_FORM = 'UI-mrr-006';

/** The overflow state: the api answers every free room, the page shows this many at a time. */
const PAGE_SIZE = 20;

/** What was searched for — the booking form and the calendar start from it. */
interface Asked {
  date: string;
  start: string;
  end: string;
}

/** The checks the api makes first, with its words (UC-mrr-001 · screens.json field validation). */
function check(v: { date: string; start: string; end: string; attendees: string }, today: string): Errors {
  const errors: Errors = {};
  if (!v.date || v.date < today) errors.date = 'วันที่ต้องเป็นวันนี้หรืออนาคต';
  if (!v.start) errors.start = 'กรุณาระบุเวลาเริ่ม';
  if (!v.end) errors.end = 'กรุณาระบุเวลาสิ้นสุด';
  else if (v.start && v.end <= v.start) errors.end = 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม';
  if (!/^[1-9]\d*$/.test(v.attendees)) errors.attendees = 'จำนวนผู้เข้าร่วมต้องเป็นจำนวนเต็มตั้งแต่ 1';
  return errors;
}

/** UI-mrr-004 — the rooms free for a day and time (API-001), then on to the booking form or the room's calendar. */
export function RoomSearchPage() {
  const navigate = useNavigate();
  const today = bangkokDate(new Date());
  const [date, setDate] = useState(today);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [attendees, setAttendees] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [result, setResult] = useState<Result>({ kind: 'idle' });
  const [asked, setAsked] = useState<Asked | null>(null);
  const [page, setPage] = useState(1);

  // The facilities a person may ask for are the ones still offered (API-002).
  useEffect(() => {
    getJson<Facility[]>('/facilities?active=true')
      .then(setFacilities)
      .catch((err) => err instanceof ApiError && err.status === 401 && setResult({ kind: 'unauthorized' }));
  }, []);

  if (result.kind === 'unauthorized') return <Navigate to={routeOf(SIGN_IN)} replace />;

  const search = (e: FormEvent) => {
    e.preventDefault();
    const found = check({ date, start, end, attendees }, today);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const query = `date=${date}&start=${start}&end=${end}&attendees=${attendees}${chosen.length ? `&facilities=${chosen.join(',')}` : ''}`;
    setAsked({ date, start, end });
    setPage(1);
    setResult({ kind: 'loading' });
    getJson<AvailableRoom[]>(`/rooms/available?${query}`)
      .then((rooms) => setResult({ kind: 'ready', rooms }))
      .catch((err) => setResult(err instanceof ApiError && err.status === 401 ? { kind: 'unauthorized' } : { kind: 'failed' }));
  };

  const rooms = result.kind === 'ready' ? result.rooms : [];
  const shown = rooms.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <h1>ค้นหาห้องว่าง</h1>
      <p className="purpose">หาห้องที่ว่างและรองรับจำนวนคนในช่วงเวลาที่ต้องการ แล้วเลือกไปจอง</p>
      <form className="card" role="search" onSubmit={search} noValidate>
        <h2>เงื่อนไขค้นหา</h2>
        <div className="grid">
          <TextField id="ui-mrr-004-search-date" label="วันที่" type="date" value={date} min={today} onChange={setDate} error={errors.date} />
          <TextField id="ui-mrr-004-search-start-time" label="เวลาเริ่ม" type="time" value={start} onChange={setStart} error={errors.start} />
          <TextField id="ui-mrr-004-search-end-time" label="เวลาสิ้นสุด" type="time" value={end} onChange={setEnd} error={errors.end} />
          <TextField id="ui-mrr-004-attendee-count" label="จำนวนผู้เข้าร่วม" type="number" value={attendees} min="1" step="1" onChange={setAttendees} error={errors.attendees} />
        </div>
        <fieldset className="checks" data-testid="ui-mrr-004-ent-004-name">
          <legend>สิ่งอำนวยความสะดวก</legend>
          {facilities.map((f) => (
            <label key={f.id}>
              <input
                type="checkbox"
                checked={chosen.includes(f.id)}
                onChange={(e) => setChosen(e.target.checked ? [...chosen, f.id] : chosen.filter((x) => x !== f.id))}
              />
              {f.name}
            </label>
          ))}
        </fieldset>
        <div className="actions">
          <button type="submit" className="btn btn-primary" data-testid="ui-mrr-004-search">
            ค้นหา
          </button>
        </div>
      </form>

      {result.kind !== 'idle' && <h2>ผลการค้นหา</h2>}
      {result.kind === 'loading' && <p role="status">กำลังค้นหาห้องว่าง…</p>}
      {result.kind === 'failed' && (
        <div role="alert" className="alert alert-danger">
          <p>ค้นหาไม่สำเร็จ กดค้นหาอีกครั้ง</p>
        </div>
      )}
      {result.kind === 'ready' && rooms.length === 0 && (
        <div className="card">
          <p>ไม่พบห้องว่าง</p>
          <p className="help">ลองเปลี่ยนเวลา จำนวนคน หรือตัวกรอง</p>
        </div>
      )}
      {result.kind === 'ready' && rooms.length > 0 && asked && (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">การทำงาน</span></th>
                  <th scope="col">ชื่อห้อง</th>
                  <th scope="col">ความจุ</th>
                  <th scope="col">ต้องอนุมัติ</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} data-row-key={r.name}>
                    <td>
                      {/* UIC-001 — row actions in the first column. */}
                      <span className="row-actions">
                        <button
                          type="button"
                          className="more"
                          data-testid="ui-mrr-004-view-calendar"
                          onClick={() => navigate(`${routeOf(CALENDAR)}?${new URLSearchParams({ room: r.id, date: asked.date })}`)}
                        >
                          ดูปฏิทินห้อง
                        </button>
                        <button
                          type="button"
                          className="more"
                          data-testid="ui-mrr-004-book"
                          onClick={() =>
                            navigate(`${routeOf(BOOKING_FORM)}?${new URLSearchParams({ room: r.id, date: asked.date, start: asked.start, end: asked.end })}`)
                          }
                        >
                          ไปหน้าจอง
                        </button>
                      </span>
                    </td>
                    <td className="clip" title={r.name} data-testid="ui-mrr-004-ent-003-name">{r.name}</td>
                    <td data-testid="ui-mrr-004-ent-003-capacity">{r.capacity} คน</td>
                    <td data-testid="ui-mrr-004-ent-003-requires-approval">{r.requiresApproval ? 'ต้องอนุมัติ' : 'ไม่ต้องอนุมัติ'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={rooms.length} onPage={setPage} />
        </div>
      )}
    </>
  );
}

function TextField(props: {
  id: string;
  label: string;
  type: 'date' | 'time' | 'number';
  value: string;
  onChange: (v: string) => void;
  error?: string;
  min?: string;
  step?: string;
}) {
  const { id, label, type, value, onChange, error, min, step } = props;
  return (
    <div className={error ? 'field err' : 'field'}>
      <label htmlFor={id}>
        {label}<span className="req" aria-hidden="true">*</span>
      </label>
      <input
        className="input"
        id={id}
        type={type}
        name={label}
        data-testid={id}
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && <span className="errtext" id={`${id}-error`}>{error}</span>}
    </div>
  );
}
