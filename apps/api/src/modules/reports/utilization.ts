import { Database } from '../../common/database/schema';

/**
 * CALC-mrr-001@v1 — one room's utilization over a report period.
 *
 *   utilization_pct = booked_minutes ÷ operating_minutes × 100
 *
 * Operating hours are Mon–Fri 08:00–18:00 Bangkok, the same for every room, public holidays
 * included. Minutes are whole numbers and nothing is rounded but the percentage, once, HALF_UP to
 * two places. Maintenance comes off the divisor, and a booking kept during it does not count.
 */

type BookingStatus = Database['bookings']['status'];

export interface UtilizationInput {
  /** The period as instants, [start, end) — a Bangkok midnight to a Bangkok midnight. */
  periodStart: Date;
  periodEnd: Date;
  bookings: { start: Date; end: Date; status: BookingStatus }[];
  /** ENT-006 periods; an open one (no end yet) runs to the end of the report period. */
  maintenance: { start: Date; end: Date | null }[];
}

export interface Utilization {
  bookedMinutes: number;
  operatingMinutes: number;
  /** Two decimals as a string ("66.67"), so no float ever holds it; null when nothing operated. */
  utilizationPct: string | null;
  /** "66.67%", or "—" when there is nothing to divide by. */
  display: string;
  /** False exactly when there is no percentage — such a room takes no rank. */
  ranked: boolean;
}

/** BR-mrr-006 — the bookings that really hold the room: no approval needed, or approved. */
const USABLE: readonly BookingStatus[] = ['CONFIRMED', 'APPROVED'];

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** Bangkok keeps +07:00 all year, so a day there is a fixed shift from UTC. */
const BANGKOK = 7 * 60 * MINUTE;
const OPEN = 8 * 60 * MINUTE;
const CLOSE = 18 * 60 * MINUTE;

type Span = [number, number];

const overlap = ([s1, e1]: Span, [s2, e2]: Span) => Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));

/** Mon–Fri 08:00–18:00 of every Bangkok day in [start, end). */
function operatingWindows(start: number, end: number): Span[] {
  const windows: Span[] = [];
  for (let day = start; day < end; day += DAY) {
    const weekday = new Date(day + BANGKOK).getUTCDay();
    if (weekday >= 1 && weekday <= 5) windows.push([day + OPEN, day + CLOSE]);
  }
  return windows;
}

/** The union of the spans, so time two periods share is taken off once. */
function union(spans: Span[]): Span[] {
  const sorted = spans.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  const out: Span[] = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

/** Milliseconds of `span` inside the windows, less the part that falls in maintenance. */
function countable(span: Span, windows: Span[], closed: Span[]): number {
  let total = 0;
  for (const w of windows) {
    const part = overlap(span, w);
    if (!part) continue;
    const inside: Span = [Math.max(span[0], w[0]), Math.min(span[1], w[1])];
    total += part - closed.reduce((sum, c) => sum + overlap(inside, c), 0);
  }
  return total;
}

/** HALF_UP to hundredths in integers: ⌊(2·booked·10000 + operating) ÷ (2·operating)⌋ hundredths. */
function percent(booked: number, operating: number): string {
  const hundredths = (2n * BigInt(booked) * 10_000n + BigInt(operating)) / (2n * BigInt(operating));
  return `${hundredths / 100n}.${String(hundredths % 100n).padStart(2, '0')}`;
}

export function utilization(input: UtilizationInput): Utilization {
  const start = input.periodStart.getTime();
  const end = input.periodEnd.getTime();
  const windows = operatingWindows(start, end);
  const closed = union(input.maintenance.map((p) => [p.start.getTime(), Math.min(p.end?.getTime() ?? end, end)] as Span));

  const operatingMs = windows.reduce((sum, w) => sum + (w[1] - w[0]) - closed.reduce((s, c) => s + overlap(w, c), 0), 0);
  const bookedMs = input.bookings
    .filter((b) => USABLE.includes(b.status))
    .reduce((sum, b) => sum + countable([b.start.getTime(), b.end.getTime()], windows, closed), 0);

  const bookedMinutes = Math.floor(bookedMs / MINUTE);
  const operatingMinutes = Math.floor(operatingMs / MINUTE);
  if (operatingMinutes === 0) return { bookedMinutes, operatingMinutes, utilizationPct: null, display: '—', ranked: false };
  const utilizationPct = percent(bookedMinutes, operatingMinutes);
  return { bookedMinutes, operatingMinutes, utilizationPct, display: `${utilizationPct}%`, ranked: true };
}
