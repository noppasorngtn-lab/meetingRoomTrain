import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Database } from '../../src/common/database/schema';
import { utilization } from '../../src/modules/reports/utilization';

/**
 * CALC-mrr-001@v1 against its signed answer key, GD-mrr-001 — read from req's contract file at run
 * time, so the expected values are the golden rows word for word and never a copy that can drift.
 */
const CONTRACT = join(__dirname, '../../../../.aeon/req/requirements.json');

interface GoldenRow {
  input: {
    year: number;
    month: number;
    bookings?: { day: number; start: string; end: string; status: string }[];
    maintenance?: { day: number; start: string; end: string }[];
  };
  expected: { booked_minutes: number; operating_minutes: number; utilization_pct: string | null; display: string; ranked: boolean };
}

const golden = (JSON.parse(readFileSync(CONTRACT, 'utf8')).goldenDatasets as { id: string; rows: GoldenRow[] }[]).find((g) => g.id === 'GD-mrr-001');

/** The answer key's words for a booking's state, in ENT-007's. */
const STATUS: Record<string, Database['bookings']['status']> = {
  approved: 'APPROVED',
  no_approval: 'CONFIRMED',
  cancelled: 'CANCELLED',
  rejected: 'REJECTED',
  pending: 'PENDING_APPROVAL',
};

const pad = (n: number) => String(n).padStart(2, '0');
/** A day and a clock time of the row's month, read in Bangkok. */
const instant = (y: number, m: number, d: number, hhmm: string) => new Date(`${y}-${pad(m)}-${pad(d)}T${hhmm}:00+07:00`);

/** The row's input as the function takes it — this adapter only translates, it never computes. */
const inputOf = ({ input: i }: GoldenRow) => ({
  periodStart: instant(i.year, i.month, 1, '00:00'),
  periodEnd: i.month === 12 ? instant(i.year + 1, 1, 1, '00:00') : instant(i.year, i.month + 1, 1, '00:00'),
  bookings: (i.bookings ?? []).map((b) => ({ start: instant(i.year, i.month, b.day, b.start), end: instant(i.year, i.month, b.day, b.end), status: STATUS[b.status] })),
  maintenance: (i.maintenance ?? []).map((p) => ({ start: instant(i.year, i.month, p.day, p.start), end: instant(i.year, i.month, p.day, p.end) })),
});

describe('FE-mrr-036 CALC-mrr-001@v1 utilization against GD-mrr-001', () => {
  it('the answer key is there, all 14 rows of it', () => {
    expect(golden).toBeDefined();
    expect(golden!.rows).toHaveLength(14);
    expect(Object.values(STATUS)).toHaveLength(5);
    for (const row of golden!.rows) for (const b of row.input.bookings ?? []) expect(STATUS[b.status]).toBeDefined();
  });

  it.each((golden?.rows ?? []).map((row, i) => [i, row] as const))('GD-mrr-001 row %i', (_, row) => {
    const got = utilization(inputOf(row));

    expect({
      booked_minutes: got.bookedMinutes,
      operating_minutes: got.operatingMinutes,
      utilization_pct: got.utilizationPct,
      display: got.display,
      ranked: got.ranked,
    }).toEqual(row.expected);
  });
});
