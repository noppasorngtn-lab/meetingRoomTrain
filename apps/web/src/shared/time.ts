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
