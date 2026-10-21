import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { Caller } from '../../common/auth/current-user';
import { CLOCK, Clock } from '../../common/clock';
import { KYSELY } from '../../common/database/database.module';
import { Database } from '../../common/database/schema';
import { assertRoomAdministrator } from '../booking/room-admin';
import { utilization } from './utilization';

export type PeriodType = 'MONTH' | 'YEAR';

/** A period that is not a whole calendar month or year. */
export class ReportPeriodInvalid extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportPeriodInvalid';
  }
}

/** No issue of that period, or no such issue number. */
export class ReportNotFound extends Error {
  constructor(message = 'ไม่พบรายงานฉบับนี้') {
    super(message);
    this.name = 'ReportNotFound';
  }
}

/** BR-mrr-015 — an issued report is never changed; a new issue is made instead (AC-mrr-046). */
export class ReportLocked extends Error {
  constructor() {
    super('รายงานที่ออกแล้วแก้ไขไม่ได้ กรุณาออกฉบับใหม่');
    this.name = 'ReportLocked';
  }
}

export interface ReportLine {
  room: { id: string; name: string };
  bookedMinutes: number;
  operatingMinutes: number;
  utilizationPct: string | null;
  display: string;
  rank: number | null;
}

export interface UtilizationReport {
  id: string;
  periodType: PeriodType;
  periodStart: string;
  periodEnd: string;
  issueNo: number;
  issuedAt: string;
  issuedBy: { id: string; fullName: string };
  /** Every issue of this period, the first first — the older ones are kept as they were. */
  issues: { issueNo: number; issuedAt: string }[];
  /** By rank, then the unranked ones, each group by room name. */
  lines: ReportLine[];
}

/** AC-mrr-071 · AC-mrr-072 — ACL-017 is ROLE-002's alone, a System Administrator included. */
const REFUSAL = 'เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้';

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The period as calendar dates and as Bangkok instants, [start, end). */
function periodOf(periodType: PeriodType, periodStart: string) {
  const m = DATE.exec(periodStart);
  if (!m) throw new ReportPeriodInvalid('periodStart ต้องเป็นวันที่ YYYY-MM-DD');
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (periodType === 'MONTH' && day !== 1) throw new ReportPeriodInvalid('periodStart ต้องเป็นวันแรกของเดือน');
  if (periodType === 'YEAR' && (day !== 1 || month !== 1)) throw new ReportPeriodInvalid('periodStart ต้องเป็นวันแรกของปี');
  const [ny, nm] = periodType === 'YEAR' ? [year + 1, 1] : month === 12 ? [year + 1, 1] : [year, month + 1];
  const next = `${ny}-${String(nm).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(ny, nm - 1, 1) - 86_400_000).toISOString().slice(0, 10);
  return {
    periodStart,
    periodEnd: last,
    start: new Date(`${periodStart}T00:00:00+07:00`),
    end: new Date(`${next}T00:00:00+07:00`),
  };
}

/** Hundredths as an integer, so ranks compare exactly. */
const hundredths = (pct: string) => Number(pct.replace('.', ''));

/** Highest first; equal percentages share a rank and the next one skips past them (1, 1, 3). */
function rank<T extends { utilizationPct: string | null }>(lines: T[]): (T & { rank: number | null })[] {
  const ranked = lines.filter((l) => l.utilizationPct !== null).sort((a, b) => hundredths(b.utilizationPct!) - hundredths(a.utilizationPct!));
  return lines.map((l) => {
    if (l.utilizationPct === null) return { ...l, rank: null };
    return { ...l, rank: ranked.findIndex((r) => r.utilizationPct === l.utilizationPct) + 1 };
  });
}

/**
 * API-028 · API-029 · API-030 — a Room Administrator issues a month's or a year's utilization
 * report from the bookings as they are now (CALC-mrr-001@v1), and reads or exports any issue
 * exactly as it was issued (UC-mrr-016 · ACL-017 · BR-mrr-015).
 */
@Injectable()
export class UtilizationReportService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** API-028 — computed from the latest data, stored as the period's next issue. */
  async issue(caller: Caller, input: { periodType: PeriodType; periodStart: string }): Promise<{ message: string; report: UtilizationReport }> {
    const now = this.clock.now();
    const id = await this.db.transaction().execute(async (tx) => {
      await assertRoomAdministrator(tx, caller, REFUSAL);
      const period = periodOf(input.periodType, input.periodStart);
      // Two issues of one period at once would both read the same last number.
      await sql`SELECT pg_advisory_xact_lock(hashtext(${`utilization:${input.periodType}:${period.periodStart}`}))`.execute(tx);
      const { last } = await tx
        .selectFrom('utilization_reports')
        .select((eb) => eb.fn.max('issue_no').as('last'))
        .where('period_type', '=', input.periodType)
        .where('period_start', '=', period.periodStart as never)
        .executeTakeFirstOrThrow();

      // Every room still in use; an archived one is gone from search and booking (STM-mrr-003).
      const rooms = await tx.selectFrom('meeting_rooms').select('id').where('status', '!=', 'ARCHIVED').execute();
      const bookings = await tx
        .selectFrom('bookings')
        .select(['room_id', 'start_at', 'end_at', 'status'])
        .where('start_at', '<', period.end)
        .where('end_at', '>', period.start)
        .execute();
      const closed = await tx
        .selectFrom('room_maintenance_periods')
        .select(['room_id', 'start_at', 'end_at'])
        .where('start_at', '<', period.end)
        .where((eb) => eb.or([eb('end_at', 'is', null), eb('end_at', '>', period.start)]))
        .execute();

      const lines = rank(
        rooms.map((r) => ({
          roomId: r.id,
          ...utilization({
            periodStart: period.start,
            periodEnd: period.end,
            bookings: bookings.filter((b) => b.room_id === r.id).map((b) => ({ start: b.start_at, end: b.end_at, status: b.status })),
            maintenance: closed.filter((c) => c.room_id === r.id).map((c) => ({ start: c.start_at, end: c.end_at })),
          }),
        })),
      );

      const report = await tx
        .insertInto('utilization_reports')
        .values({
          period_type: input.periodType, period_start: period.periodStart, period_end: period.periodEnd,
          issue_no: (last ?? 0) + 1, issued_by: caller.userId, issued_at: now,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      if (lines.length) {
        await tx
          .insertInto('utilization_report_lines')
          .values(lines.map((l) => ({
            report_id: report.id, room_id: l.roomId, booked_minutes: l.bookedMinutes, operating_minutes: l.operatingMinutes,
            utilization_pct: l.utilizationPct, rank: l.rank,
          })))
          .execute();
      }
      return report.id;
    });
    const report = await this.read(id);
    // AC-mrr-045's words where an earlier issue is kept; the first issue has none to keep.
    return { message: report.issueNo > 1 ? 'ออกรายงานฉบับใหม่แล้ว ฉบับเดิมยังเก็บไว้' : 'ออกรายงานแล้ว', report };
  }

  /** API-029 — the issue asked for, or the latest one, exactly as it was issued. */
  async view(caller: Caller, input: { periodType: PeriodType; periodStart: string; issueNo?: number }): Promise<UtilizationReport> {
    await assertRoomAdministrator(this.db, caller, REFUSAL);
    const period = periodOf(input.periodType, input.periodStart);
    let q = this.db
      .selectFrom('utilization_reports')
      .select('id')
      .where('period_type', '=', input.periodType)
      .where('period_start', '=', period.periodStart as never);
    q = input.issueNo === undefined ? q.orderBy('issue_no', 'desc').limit(1) : q.where('issue_no', '=', input.issueNo);
    const found = await q.executeTakeFirst();
    if (!found) throw new ReportNotFound(input.issueNo === undefined ? 'ยังไม่มีรายงานของช่วงนี้' : undefined);
    return this.read(found.id);
  }

  /** API-030 — every room of the issue as CSV, UTF-8 with a BOM so a spreadsheet reads the Thai. */
  async export(caller: Caller, id: string): Promise<{ filename: string; csv: string }> {
    await assertRoomAdministrator(this.db, caller, REFUSAL);
    const report = await this.read(id);
    const cell = (v: string | number | null) => {
      const s = v === null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [
      ['อันดับ', 'ห้อง', 'นาทีที่ใช้จริง', 'นาทีทำการ', 'อัตราการใช้งาน'],
      ...report.lines.map((l) => [l.rank, l.room.name, l.bookedMinutes, l.operatingMinutes, l.display]),
    ];
    return {
      filename: `utilization-${report.periodType.toLowerCase()}-${report.periodStart}-issue-${report.issueNo}.csv`,
      csv: `﻿${rows.map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`,
    };
  }

  /** AC-mrr-046 — whatever is asked of an issued report's numbers, the answer is the same. */
  async refuseEdit(caller: Caller, id: string): Promise<never> {
    await assertRoomAdministrator(this.db, caller, REFUSAL);
    await this.read(id);
    throw new ReportLocked();
  }

  private async read(id: string): Promise<UtilizationReport> {
    const head = await this.db
      .selectFrom('utilization_reports as r')
      .innerJoin('users as u', 'u.id', 'r.issued_by')
      .select([
        'r.id', 'r.period_type', 'r.issue_no', 'r.issued_at', 'u.id as issuer_id', 'u.full_name as issuer_name',
        sql<string>`to_char(r.period_start, 'YYYY-MM-DD')`.as('period_start'),
        sql<string>`to_char(r.period_end, 'YYYY-MM-DD')`.as('period_end'),
      ])
      .where('r.id', '=', id)
      .executeTakeFirst();
    if (!head) throw new ReportNotFound();
    const issues = await this.db
      .selectFrom('utilization_reports')
      .select(['issue_no', 'issued_at'])
      .where('period_type', '=', head.period_type)
      .where('period_start', '=', head.period_start as never)
      .orderBy('issue_no')
      .execute();
    const lines = await this.db
      .selectFrom('utilization_report_lines as l')
      .innerJoin('meeting_rooms as m', 'm.id', 'l.room_id')
      .innerJoin('meeting_room_versions as v', 'v.id', 'm.current_version_id')
      .select(['l.room_id', 'v.name', 'l.booked_minutes', 'l.operating_minutes', 'l.utilization_pct', 'l.rank'])
      .where('l.report_id', '=', id)
      .orderBy(sql`l.rank IS NULL`)
      .orderBy('l.rank')
      .orderBy('v.name')
      .execute();
    return {
      id: head.id,
      periodType: head.period_type,
      periodStart: head.period_start,
      periodEnd: head.period_end,
      issueNo: head.issue_no,
      issuedAt: head.issued_at.toISOString(),
      issuedBy: { id: head.issuer_id, fullName: head.issuer_name },
      issues: issues.map((i) => ({ issueNo: i.issue_no, issuedAt: i.issued_at.toISOString() })),
      lines: lines.map((l) => ({
        room: { id: l.room_id, name: l.name },
        bookedMinutes: l.booked_minutes,
        operatingMinutes: l.operating_minutes,
        utilizationPct: l.utilization_pct,
        display: l.utilization_pct === null ? '—' : `${l.utilization_pct}%`,
        rank: l.rank,
      })),
    };
  }
}
