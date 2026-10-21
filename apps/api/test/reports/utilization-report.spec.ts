import { Kysely, sql } from 'kysely';
import { Clock } from '../../src/common/clock';
import { Database } from '../../src/common/database/schema';
import { NotRoomAdministrator } from '../../src/modules/booking/room-admin';
import { ReportLocked, ReportNotFound, UtilizationReport, UtilizationReportService } from '../../src/modules/reports/utilization-report.service';
import { seedBooking, seedRoom, seedUser, startDatabase, truncateAll } from '../support/postgres';

jest.setTimeout(120_000);

/** 2026-<mm>-<dd>T<hh:mm> in Bangkok. */
const at = (month: number, day: number, hhmm: string) => new Date(`2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${hhmm}:00+07:00`);
const oct = (day: number, hhmm: string) => at(10, day, hhmm);

/** The 22 weekdays of October 2026 (Mon 5 … Fri 30, with Thu 1 and Fri 2). */
const WEEKDAYS = [1, 2, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 19, 20, 21, 22, 23, 26, 27, 28, 29, 30];
const OCTOBER = { periodType: 'MONTH' as const, periodStart: '2026-10-01' };

describe('FE-mrr-036 a Room Administrator issues and reads the utilization report (UC-mrr-016)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let now: Date;
  let service: UtilizationReportService;
  let u1: string;
  let ra1: string;

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
  });

  afterAll(async () => {
    await stop();
  });

  beforeEach(async () => {
    await truncateAll(db);
    u1 = await seedUser(db, 'U1');
    ra1 = await seedUser(db, 'RA1', 'ROOM_ADMINISTRATOR');
    now = at(11, 1, '09:00');
    const clock: Clock = { now: () => now };
    service = new UtilizationReportService(db, clock);
  });

  const room = (name: string) => seedRoom(db, name, ra1);
  const book = (r: { roomId: string; versionId: string }, day: number, start: string, end: string, status: Database['bookings']['status'] = 'CONFIRMED') =>
    seedBooking(db, { room: r, bookedBy: u1, title: 'ประชุม', startAt: oct(day, start), endAt: oct(day, end), status });
  const closeRoom = (r: { roomId: string }, start: Date, end: Date | null) =>
    db.insertInto('room_maintenance_periods').values({ room_id: r.roomId, start_at: start, end_at: end, set_by: ra1 }).execute();
  const lineOf = (report: UtilizationReport, name: string) => report.lines.find((l) => l.room.name === name)!;

  it('AC-mrr-082 ห้อง B 66.67% ranks 1 and ห้อง A 33.33% ranks 2 — cancelled, pending and rejected bookings do not count', async () => {
    const a = await room('ห้อง A');
    const b = await room('ห้อง B');
    for (const d of WEEKDAYS) {
      await book(a, d, '09:00', '12:20', d % 2 ? 'CONFIRMED' : 'APPROVED');
      await book(b, d, '08:00', '14:40');
    }
    await book(a, 5, '13:00', '15:00', 'CANCELLED');
    await book(a, 6, '13:00', '14:00', 'PENDING_APPROVAL');
    await book(a, 7, '13:00', '14:00', 'REJECTED');

    const { report } = await service.issue({ userId: ra1 }, OCTOBER);

    expect(report.lines.map((l) => [l.rank, l.room.name, l.display])).toEqual([
      [1, 'ห้อง B', '66.67%'],
      [2, 'ห้อง A', '33.33%'],
    ]);
    expect(lineOf(report, 'ห้อง A')).toMatchObject({ bookedMinutes: 4400, operatingMinutes: 13200, utilizationPct: '33.33' });
    expect(lineOf(report, 'ห้อง B')).toMatchObject({ bookedMinutes: 8800, operatingMinutes: 13200, utilizationPct: '66.67' });
  });

  it('AC-mrr-083 ห้อง C shows 0.45% — only Friday 17:00–18:00 counts, not after 18:00 nor Saturday', async () => {
    const c = await room('ห้อง C');
    await book(c, 30, '17:00', '19:00');
    await book(c, 31, '10:00', '12:00');

    const { report } = await service.issue({ userId: ra1 }, OCTOBER);

    expect(lineOf(report, 'ห้อง C')).toMatchObject({ bookedMinutes: 60, operatingMinutes: 13200, utilizationPct: '0.45', display: '0.45%', rank: 1 });
  });

  it('AC-mrr-084 ห้อง D under maintenance 19/10–23/10 shows 50.00% — the divisor is 10,200, the booking kept on 21/10 does not count', async () => {
    const d = await room('ห้อง D');
    await closeRoom(d, oct(19, '00:00'), oct(24, '00:00'));
    await book(d, 21, '10:00', '11:00');
    for (const day of WEEKDAYS.filter((x) => x < 19 || x > 23)) await book(d, day, '08:00', '13:00');

    const { report } = await service.issue({ userId: ra1 }, OCTOBER);

    expect(lineOf(report, 'ห้อง D')).toMatchObject({ bookedMinutes: 5100, operatingMinutes: 10200, utilizationPct: '50.00', display: '50.00%' });
  });

  it('AC-mrr-085 ห้อง E under maintenance all October shows — with no rank, and is left out of the ranking', async () => {
    const e = await room('ห้อง E');
    const a = await room('ห้อง A');
    // Still closed: the open period runs to the end of the report.
    await closeRoom(e, at(9, 30, '12:00'), null);
    await book(e, 5, '10:00', '11:00');
    await book(a, 5, '10:00', '11:00');

    const { report } = await service.issue({ userId: ra1 }, OCTOBER);

    expect(lineOf(report, 'ห้อง E')).toMatchObject({ bookedMinutes: 0, operatingMinutes: 0, utilizationPct: null, display: '—', rank: null });
    expect(report.lines.map((l) => l.room.name)).toEqual(['ห้อง A', 'ห้อง E']);
    expect(lineOf(report, 'ห้อง A').rank).toBe(1);
  });

  it('rooms with the same percentage share a rank, and the next one skips past them', async () => {
    const [a, b, c] = [await room('ห้อง A'), await room('ห้อง B'), await room('ห้อง C')];
    await book(a, 5, '10:00', '12:00');
    await book(b, 6, '10:00', '12:00');
    await book(c, 7, '10:00', '11:00');

    const { report } = await service.issue({ userId: ra1 }, OCTOBER);

    expect(report.lines.map((l) => [l.room.name, l.rank])).toEqual([['ห้อง A', 1], ['ห้อง B', 1], ['ห้อง C', 3]]);
  });

  it('an archived room is not in the report', async () => {
    const a = await room('ห้อง A');
    const old = await room('ห้อง เก่า');
    await book(a, 5, '10:00', '11:00');
    await db.updateTable('meeting_rooms').set({ status: 'ARCHIVED' }).where('id', '=', old.roomId).execute();

    const { report } = await service.issue({ userId: ra1 }, OCTOBER);

    expect(report.lines.map((l) => l.room.name)).toEqual(['ห้อง A']);
  });

  it('a year report runs from 1 January to 31 December', async () => {
    const a = await room('ห้อง A');
    await book(a, 5, '10:00', '11:00');

    const { report } = await service.issue({ userId: ra1 }, { periodType: 'YEAR', periodStart: '2026-01-01' });

    expect(report).toMatchObject({ periodType: 'YEAR', periodStart: '2026-01-01', periodEnd: '2026-12-31', issueNo: 1 });
    // 2026 has 261 weekdays.
    expect(lineOf(report, 'ห้อง A')).toMatchObject({ bookedMinutes: 60, operatingMinutes: 261 * 600 });
  });

  it('a period that does not start on the first of a month (or of a year) is refused', async () => {
    await expect(service.issue({ userId: ra1 }, { periodType: 'MONTH', periodStart: '2026-10-02' })).rejects.toThrow('periodStart ต้องเป็นวันแรกของเดือน');
    await expect(service.issue({ userId: ra1 }, { periodType: 'YEAR', periodStart: '2026-10-01' })).rejects.toThrow('periodStart ต้องเป็นวันแรกของปี');
  });

  it('AC-mrr-045 issuing October again makes issue 2 from the latest bookings, keeps issue 1, and says so', async () => {
    const a = await room('ห้อง A');
    const booking = await book(a, 15, '10:00', '11:00');
    const first = await service.issue({ userId: ra1 }, OCTOBER);
    now = at(11, 3, '09:00');
    await db.updateTable('bookings').set({ start_at: oct(15, '10:00'), end_at: oct(15, '12:00') }).where('id', '=', booking).execute();

    const second = await service.issue({ userId: ra1 }, OCTOBER);

    expect(first.report.issueNo).toBe(1);
    expect(second.message).toBe('ออกรายงานฉบับใหม่แล้ว ฉบับเดิมยังเก็บไว้');
    expect(second.report).toMatchObject({ issueNo: 2, issuedAt: at(11, 3, '09:00').toISOString(), issuedBy: { id: ra1, fullName: 'RA1' } });
    expect(lineOf(second.report, 'ห้อง A').bookedMinutes).toBe(120);
    expect(second.report.issues).toEqual([
      { issueNo: 1, issuedAt: at(11, 1, '09:00').toISOString() },
      { issueNo: 2, issuedAt: at(11, 3, '09:00').toISOString() },
    ]);
  });

  it('AC-mrr-047 issue 1, opened after issue 2, shows every number as it was issued on 1/11', async () => {
    const a = await room('ห้อง A');
    const booking = await book(a, 15, '10:00', '11:00');
    await service.issue({ userId: ra1 }, OCTOBER);
    await db.updateTable('bookings').set({ end_at: oct(15, '12:00') }).where('id', '=', booking).execute();
    await service.issue({ userId: ra1 }, OCTOBER);

    const one = await service.view({ userId: ra1 }, { ...OCTOBER, issueNo: 1 });
    const latest = await service.view({ userId: ra1 }, OCTOBER);

    expect(lineOf(one, 'ห้อง A')).toMatchObject({ bookedMinutes: 60, utilizationPct: '0.45', rank: 1 });
    expect(latest.issueNo).toBe(2);
    expect(lineOf(latest, 'ห้อง A')).toMatchObject({ bookedMinutes: 120, utilizationPct: '0.91' });
  });

  it('AC-mrr-046 an issued report cannot be changed — an edit is refused in its words, and the database will not take one either', async () => {
    const a = await room('ห้อง A');
    await book(a, 15, '10:00', '11:00');
    const { report } = await service.issue({ userId: ra1 }, OCTOBER);

    await expect(service.refuseEdit({ userId: ra1 }, report.id)).rejects.toThrow(new ReportLocked().message);
    expect(new ReportLocked().message).toBe('รายงานที่ออกแล้วแก้ไขไม่ได้ กรุณาออกฉบับใหม่');
    await expect(sql`UPDATE utilization_report_lines SET booked_minutes = 999 WHERE report_id = ${report.id}`.execute(db)).rejects.toThrow(/append-only/);
    await expect(sql`DELETE FROM utilization_reports WHERE id = ${report.id}`.execute(db)).rejects.toThrow(/append-only/);
    expect(lineOf(await service.view({ userId: ra1 }, { ...OCTOBER, issueNo: 1 }), 'ห้อง A').bookedMinutes).toBe(60);
  });

  it('a period never issued, or an issue that does not exist, is not found', async () => {
    await expect(service.view({ userId: ra1 }, OCTOBER)).rejects.toThrow('ยังไม่มีรายงานของช่วงนี้');
    await room('ห้อง A');
    await service.issue({ userId: ra1 }, OCTOBER);
    await expect(service.view({ userId: ra1 }, { ...OCTOBER, issueNo: 5 })).rejects.toBeInstanceOf(ReportNotFound);
  });

  it.each([
    ['AC-mrr-071 a System Administrator', 'SYSTEM_ADMINISTRATOR'],
    ['AC-mrr-072 a General User', 'GENERAL_USER'],
  ] as const)('%s sees no report: เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้', async (_, role) => {
    await room('ห้อง A');
    await service.issue({ userId: ra1 }, OCTOBER);
    const who = await seedUser(db, 'X', role);

    await expect(service.view({ userId: who }, OCTOBER)).rejects.toBeInstanceOf(NotRoomAdministrator);
    await expect(service.view({ userId: who }, OCTOBER)).rejects.toThrow('เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้');
    await expect(service.issue({ userId: who }, OCTOBER)).rejects.toBeInstanceOf(NotRoomAdministrator);
    expect((await db.selectFrom('utilization_reports').select('id').execute())).toHaveLength(1);
  });
});
