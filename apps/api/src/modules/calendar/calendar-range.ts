export type CalendarView = 'day' | 'week' | 'month';

export const VIEWS: readonly CalendarView[] = ['day', 'week', 'month'];

/** Asia/Bangkok has no daylight saving: a local midnight is always 7 hours before UTC midnight. */
const OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Bangkok midnight of a calendar day; month and day overflow roll over the way Date.UTC does. */
const midnight = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d) - OFFSET_MS);

/**
 * The half-open window [from, to) a view of `date` (YYYY-MM-DD, Bangkok) covers. A week runs
 * Monday to Sunday.
 */
export function rangeOf(view: CalendarView, date: string): { from: Date; to: Date } {
  const [y, m, d] = date.split('-').map(Number);
  if (view === 'month') return { from: midnight(y, m, 1), to: midnight(y, m + 1, 1) };
  if (view === 'week') {
    const sinceMonday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
    const from = midnight(y, m, d - sinceMonday);
    return { from, to: new Date(from.getTime() + 7 * DAY_MS) };
  }
  return { from: midnight(y, m, d), to: midnight(y, m, d + 1) };
}

/** A real YYYY-MM-DD date — 2026-02-30 is not one. */
export function isCalendarDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
