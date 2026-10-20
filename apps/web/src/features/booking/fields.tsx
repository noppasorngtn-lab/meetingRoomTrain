import { useRef, useState } from 'react';
import { ApiError, getJson } from '../../shared/api';

/** The fields a booking form captures — shared by create (UI-mrr-006) and edit (UI-mrr-008). */

export interface Option {
  id: string;
  name: string;
}

export interface Person {
  id: string;
  fullName: string;
  email?: string;
}

export type Field = 'start' | 'end' | 'title' | 'attendees' | 'equipment';
export type Errors = Partial<Record<Field, string>>;

const TITLE_MAX = 200;

/** The api's field names (BookingInvalid · request body) mapped to the form's fields. */
export const FIELD_OF: Record<string, Field> = {
  title: 'title', attendees: 'attendees', attendeeIds: 'attendees', start: 'start', startAt: 'start',
  end: 'end', endAt: 'end', equipment: 'equipment', equipmentIds: 'equipment',
};

/** The api's title check, with its words — null when the title is fine. */
export function checkTitle(title: string): string | null {
  if (!title.trim()) return 'กรุณาระบุหัวข้อการประชุม';
  if (title.trim().length > TITLE_MAX) return `หัวข้อการประชุมต้องไม่เกิน ${TITLE_MAX} ตัวอักษร`;
  return null;
}

/** The same checks the api makes first (BR-mrr-002 · field validation), with its words. */
export function checkForm(start: string, end: string, title: string, attendees: Person[]): Errors {
  const errors: Errors = {};
  if (!start) errors.start = 'กรุณาระบุเวลาเริ่ม';
  if (!end) errors.end = 'กรุณาระบุเวลาสิ้นสุด';
  else if (start && end <= start) errors.end = 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม';
  const titleError = checkTitle(title);
  if (titleError) errors.title = titleError;
  if (attendees.length === 0) errors.attendees = 'กรุณาระบุผู้เข้าร่วมอย่างน้อย 1 คน';
  return errors;
}

export function TimeField(props: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string }) {
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

export function TitleField(props: { id: string; value: string; onChange: (v: string) => void; error?: string }) {
  const { id, value, onChange, error } = props;
  return (
    <div className={error ? 'field err' : 'field'}>
      <label htmlFor={id}>
        หัวข้อการประชุม<span className="req" aria-hidden="true">*</span>
      </label>
      <input
        className="input"
        id={id}
        type="text"
        name="หัวข้อการประชุม"
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

/** Attendees are picked from the users the api finds (API-005); the booker is never added for them. */
export function AttendeePicker(props: {
  id: string;
  value: Person[];
  onChange: (people: Person[]) => void;
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
        if (latest.current === text) setMatches(people.filter((p) => !value.some((a) => a.id === p.id)));
      })
      .catch((err) => err instanceof ApiError && err.status === 401 && onUnauthorized());
  };

  const pick = (p: Person) => {
    onChange([...value, p]);
    setQuery('');
    setMatches([]);
    latest.current = '';
  };

  return (
    <div className={error ? 'field err' : 'field'}>
      <label htmlFor={id}>
        ผู้เข้าร่วม<span className="req" aria-hidden="true">*</span>
      </label>
      {value.length > 0 && (
        <ul className="picked" aria-label="ผู้เข้าร่วมที่เลือก">
          {value.map((a) => (
            <li key={a.id}>
              {a.fullName}
              <button type="button" aria-label={`เอา ${a.fullName} ออก`} onClick={() => onChange(value.filter((x) => x.id !== a.id))}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        className="input"
        id={id}
        type="search"
        name="ผู้เข้าร่วม"
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
        <span className="help" id={`${id}-help`}>ผู้จองไม่ถูกนับเป็นผู้เข้าร่วม ถ้าจะเข้าร่วมด้วยให้เลือกชื่อตัวเอง</span>
      )}
    </div>
  );
}

/** Optional equipment, ticked from the active facilities (API-002). */
export function EquipmentChecks(props: {
  id: string;
  options: Option[];
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  const { id, options, value, onChange, error } = props;
  return (
    <fieldset className="checks" data-testid={id}>
      <legend>อุปกรณ์เสริม</legend>
      {options.length === 0 && <span className="help">ไม่มีอุปกรณ์เสริมให้เลือก</span>}
      {options.map((f) => (
        <label key={f.id}>
          <input
            type="checkbox"
            name="อุปกรณ์เสริม"
            value={f.id}
            checked={value.includes(f.id)}
            onChange={(e) => onChange(e.target.checked ? [...value, f.id] : value.filter((x) => x !== f.id))}
          />
          {f.name}
        </label>
      ))}
      {error && <span className="errtext">{error}</span>}
    </fieldset>
  );
}
