/** Every time a person reads is Bangkok time, the way the booking mails write it. */
const TIME_ZONE = 'Asia/Bangkok';

const part = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, ...opts }).format(d);

const dayMonth = (d: Date) => part(d, { day: '2-digit', month: '2-digit' });
const hourMinute = (d: Date) => part(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** `17/10 10:00–11:00` — the end's date is added only when the booking crosses midnight. */
export function slotLabel(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const end = dayMonth(e) === dayMonth(s) ? hourMinute(e) : `${dayMonth(e)} ${hourMinute(e)}`;
  return `${dayMonth(s)} ${hourMinute(s)}–${end}`;
}

/** The Bangkok calendar day an instant falls on, as YYYY-MM-DD. */
export function bangkokDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** A `datetime-local` value (YYYY-MM-DDTHH:MM, read as Bangkok) as an instant the api accepts. */
export function bangkokInstant(local: string): string {
  return `${local}:00+07:00`;
}

/** An instant as a `datetime-local` value (YYYY-MM-DDTHH:MM) in Bangkok time. */
export function bangkokLocal(iso: string): string {
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  return `${bangkokDate(d)}T${time}`;
}

// ADR-016 · screens.json UI-mrr-004/005/006/008: a person reads and types dates as วว/ดด/ปปปป (Gregorian year) and
// times as 24-hour HH:MM on every machine, whatever the browser's language. Inside the app the values stay
// YYYY-MM-DD · HH:MM · YYYY-MM-DDTHH:MM, so comparisons, URLs and the api do not change — only these
// functions translate between the two. Strict on purpose: a 4-digit year, a real calendar day, 00:00-23:59;
// one-digit day/month/hour is accepted and shown padded (5/3/2031 -> 05/03/2031).

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` as `DD/MM/YYYY`; anything else as ''. */
export function displayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** `D/M/YYYY` or `DD/MM/YYYY` as `YYYY-MM-DD`, or null when it is not a real calendar day. */
export function parseDate(text: string): string | null {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(text);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return null;
  if (d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) return null;
  return `${m[3]}-${pad(mo)}-${pad(d)}`;
}

/** `H:MM` or `HH:MM` (24-hour) as `HH:MM`, or null outside 00:00-23:59. */
export function parseTime(text: string): string | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(text);
  if (!m) return null;
  const [h, mi] = [Number(m[1]), Number(m[2])];
  return h > 23 || mi > 59 ? null : `${pad(h)}:${pad(mi)}`;
}

/** `HH:MM` as itself; anything else as ''. */
export function displayTime(hhmm: string): string {
  return /^\d{2}:\d{2}$/.test(hhmm) ? hhmm : '';
}

/** `YYYY-MM-DDTHH:MM` as `DD/MM/YYYY HH:MM`; anything else as ''. */
export function displayDateTime(local: string): string {
  const [date, time] = local.split('T');
  const d = displayDate(date ?? '');
  const t = displayTime(time ?? '');
  return d && t ? `${d} ${t}` : '';
}

/** `DD/MM/YYYY HH:MM` as `YYYY-MM-DDTHH:MM`, or null when either half is not valid. */
export function parseDateTime(text: string): string | null {
  const parts = text.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  const d = parseDate(parts[0]);
  const t = parseTime(parts[1]);
  return d && t ? `${d}T${t}` : null;
}

/** `16/10 14:05` — one instant, the way a trail entry is read. */
export function instantLabel(iso: string): string {
  const d = new Date(iso);
  return `${dayMonth(d)} ${hourMinute(d)}`;
}
