import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, getJson } from '../../shared/api';
import { FormattedInput } from '../../shared/FormattedInput';
import { routeOf } from '../../shared/sitemap';
import { bangkokDate, slotLabel } from '../../shared/time';

type View = 'day' | 'week' | 'month';

interface Slot {
  startAt: string;
  endAt: string;
  busy: true;
  details?: { bookedBy: string; title: string; attendees: string[] };
}

interface RoomCalendar {
  roomId: string;
  view: View;
  from: string;
  to: string;
  slots: Slot[];
}

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; data: RoomCalendar }
  | { kind: 'failed'; message: string; retry: boolean }
  | { kind: 'unauthorized' };

const SIGN_IN = 'UI-mrr-001';
/** book-slot's destinationRef in screens.json. */
const BOOKING_FORM = 'UI-mrr-006';

const VIEWS: [View, string][] = [
  ['day', 'รายวัน'],
  ['week', 'รายสัปดาห์'],
  ['month', 'รายเดือน'],
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The date one step away in the shown view: a day, a week, or a calendar month (clamped to the month's last day). */
export function shiftDate(date: string, view: View, direction: 1 | -1): string {
  const [y, m, d] = date.split('-').map(Number);
  if (view === 'month') {
    const target = new Date(Date.UTC(y, m - 1 + direction, 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(d, last));
    return target.toISOString().slice(0, 10);
  }
  return new Date(Date.UTC(y, m - 1, d + direction * (view === 'week' ? 7 : 1))).toISOString().slice(0, 10);
}

/** 401 sends the viewer to sign in · 404 is final · anything else can be tried again. */
const failureOf = (err: unknown): Load => {
  if (err instanceof ApiError && err.status === 401) return { kind: 'unauthorized' };
  if (err instanceof ApiError && err.status === 404) return { kind: 'failed', message: 'ไม่พบห้อง', retry: false };
  return { kind: 'failed', message: 'โหลดปฏิทินไม่สำเร็จ ลองโหลดใหม่อีกครั้ง', retry: true };
};

/** UI-mrr-005 — the booked slots of one room (API-003). Details only on the viewer's own bookings. */
export function CalendarPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const room = params.get('room') ?? '';
  const requested = params.get('date');
  // A date that is not a date is what "no date" means: today.
  const date = requested && DATE.test(requested) ? requested : bangkokDate(new Date());
  const view = (params.get('view') as View) ?? 'week';
  // The select is the filter's input; the view only changes when switch-view applies it.
  const [chosen, setChosen] = useState<View>(view);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });

  const fetchCalendar = useCallback(() => {
    setLoad({ kind: 'loading' });
    getJson<RoomCalendar>(`/rooms/${room}/calendar?view=${view}&date=${date}`)
      .then((data) => setLoad({ kind: 'ready', data }))
      .catch((err) => setLoad(failureOf(err)));
  }, [room, view, date]);

  useEffect(fetchCalendar, [fetchCalendar]);

  // The states design declares for this page (screens.json UI-mrr-005).
  if (load.kind === 'unauthorized') return <Navigate to={routeOf(SIGN_IN)} replace />;
  const data = load.kind === 'ready' ? load.data : null;

  return (
    <>
      <h1>ปฏิทินห้อง</h1>
      <p className="purpose">ดูตารางการใช้ห้องรายวัน รายสัปดาห์ หรือรายเดือน เพื่อหาช่วงที่ว่าง</p>
      <div className="card">
        <div className="grid">
          <div className="field">
            <label htmlFor="ui-mrr-005-calendar-view">
              มุมมอง<span className="req" aria-hidden="true">*</span>
            </label>
            <select
              className="input"
              id="ui-mrr-005-calendar-view"
              name="มุมมอง"
              data-testid="ui-mrr-005-calendar-view"
              value={chosen}
              onChange={(e) => setChosen(e.target.value as View)}
            >
              {VIEWS.map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            {/* design binds this field to no entity; mock named it calendar-date (conventions fieldMap, 9a71161). */}
            <label htmlFor="ui-mrr-005-calendar-date">
              วันที่<span className="req" aria-hidden="true">*</span>
            </label>
            <FormattedInput
              id="ui-mrr-005-calendar-date"
              name="วันที่"
              kind="date"
              value={date}
              placeholder="วว/ดด/ปปปป (ไม่ระบุ = วันนี้)"
              onChange={(v) => v && setParams({ room, date: v, view })}
              // screens.json UI-mrr-005 date: "ไม่ระบุ = วันนี้" — a box left empty shows today.
              onLeftEmpty={() => setParams({ room, date: bangkokDate(new Date()), view })}
            />
          </div>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="ui-mrr-005-switch-view"
            onClick={() => setParams({ room, date, view: chosen })}
          >
            เปลี่ยนมุมมอง
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="ui-mrr-005-previous"
            onClick={() => setParams({ room, date: shiftDate(date, view, -1), view })}
          >
            ก่อนหน้า
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="ui-mrr-005-today"
            onClick={() => setParams({ room, date: bangkokDate(new Date()), view })}
          >
            วันนี้
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="ui-mrr-005-next"
            onClick={() => setParams({ room, date: shiftDate(date, view, 1), view })}
          >
            ถัดไป
          </button>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="ui-mrr-005-book-slot"
            onClick={() => navigate(`${routeOf(BOOKING_FORM)}?${new URLSearchParams({ room, date })}`)}
          >
            ไปหน้าจองห้อง
          </button>
        </div>
      </div>
      <div className="card">
        <h2>ปฏิทิน</h2>
        {load.kind === 'loading' && <p role="status">กำลังโหลดปฏิทิน…</p>}
        {load.kind === 'failed' && (
          <div role="alert" className="alert alert-danger">
            <p>{load.message}</p>
            {load.retry && (
              <button type="button" className="btn btn-secondary" onClick={fetchCalendar}>
                โหลดใหม่
              </button>
            )}
          </div>
        )}
        {data && data.slots.length === 0 && <p className="help">ช่วงนี้ยังไม่มีการจอง เลือกช่วงเวลาเพื่อจองได้</p>}
        {data &&
          groupByDay(data.slots).map(([day, slots]) => (
            <DaySlots key={day} slots={slots} fold={data.view === 'month'} />
          ))}
      </div>
    </>
  );
}

/** A month cell shows its first three bookings; the rest wait behind +N (the overflow state). */
const MONTH_CELL = 3;

function DaySlots({ slots, fold }: { slots: Slot[]; fold: boolean }) {
  const [open, setOpen] = useState(false);
  const hidden = fold && !open ? Math.max(0, slots.length - MONTH_CELL) : 0;
  return (
    <div className="slots">
      {slots.slice(0, slots.length - hidden).map((s) => (
        <SlotCard key={s.startAt} slot={s} />
      ))}
      {hidden > 0 && (
        <button type="button" className="more" aria-label={`ดูอีก ${hidden} รายการ`} onClick={() => setOpen(true)}>
          +{hidden}
        </button>
      )}
    </div>
  );
}

function SlotCard({ slot: s }: { slot: Slot }) {
  return (
    <div className={s.details ? 'slot slot-mine' : 'slot slot-other'}>
      <span>
        <span className="k">ช่วงเวลาที่ถูกจอง: </span>
        <span className="time" data-testid="ui-mrr-005-ent-007-start-at">{slotLabel(s.startAt, s.endAt)}</span>
      </span>
      <span>
        <span className="k">หัวข้อ: </span>
        <span data-testid="ui-mrr-005-ent-007-title">{s.details ? s.details.title : 'ไม่ว่าง'}</span>
      </span>
      {s.details && (
        <>
          <span>
            <span className="k">ผู้จอง: </span>
            <span data-testid="ui-mrr-005-ent-007-booked-by">{s.details.bookedBy}</span>
          </span>
          <span>
            <span className="k">ผู้เข้าร่วม: </span>
            <span data-testid="ui-mrr-005-ent-008-user">{s.details.attendees.join(', ')}</span>
          </span>
        </>
      )}
    </div>
  );
}

/** Slots in start order, grouped by the Bangkok day they start on. */
function groupByDay(slots: Slot[]): [string, Slot[]][] {
  const days = new Map<string, Slot[]>();
  for (const s of slots) {
    const day = bangkokDate(new Date(s.startAt));
    days.set(day, [...(days.get(day) ?? []), s]);
  }
  return [...days.entries()];
}
