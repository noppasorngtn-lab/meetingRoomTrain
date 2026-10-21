import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kysely } from 'kysely';
import request from 'supertest';
import { CLOCK } from '../../src/common/clock';
import { KYSELY } from '../../src/common/database/database.module';
import { Database } from '../../src/common/database/schema';
import { ReportsModule } from '../../src/modules/reports/reports.module';
import { seedBooking, seedRoom, seedUser, startDatabase, truncateAll } from '../support/postgres';

jest.setTimeout(120_000);

const oct = (day: number, hhmm: string) => new Date(`2026-10-${String(day).padStart(2, '0')}T${hhmm}:00+07:00`);
const REFUSAL = 'เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้';
const OCTOBER = { periodType: 'MONTH', periodStart: '2026-10-01' };

describe('FE-mrr-036 /reports/utilization (API-028 · API-029 · API-030)', () => {
  let db: Kysely<Database>;
  let stop: () => Promise<void>;
  let app: INestApplication;
  let u1: string;
  let ra1: string;

  beforeAll(async () => {
    ({ db, stop } = await startDatabase());
    const moduleRef = await Test.createTestingModule({ imports: [ReportsModule] })
      .overrideProvider(KYSELY).useValue(db)
      .overrideProvider(CLOCK).useValue({ now: () => new Date('2026-11-01T09:00:00+07:00') })
      .compile();
    app = moduleRef.createNestApplication();
    // Stands in for the sign-in guard that does not exist yet (GAP-mrr-003): x-test-user → request.user.
    app.use((req: any, _res: unknown, next: () => void) => {
      const id = req.headers['x-test-user'];
      if (id) req.user = { userId: id };
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await stop();
  });

  beforeEach(async () => {
    await truncateAll(db);
    u1 = await seedUser(db, 'U1');
    ra1 = await seedUser(db, 'RA1', 'ROOM_ADMINISTRATOR');
    const a = await seedRoom(db, 'ห้อง A', ra1);
    const b = await seedRoom(db, 'ห้อง B', ra1);
    await seedBooking(db, { room: a, bookedBy: u1, title: 'ประชุม', startAt: oct(5, '10:00'), endAt: oct(5, '11:00') });
    await seedBooking(db, { room: b, bookedBy: u1, title: 'ประชุม', startAt: oct(6, '10:00'), endAt: oct(6, '12:00') });
  });

  const issue = (user: string, body: object = OCTOBER) =>
    request(app.getHttpServer()).post('/reports/utilization').set('x-test-user', user).send(body);
  const view = (user: string, query = '?periodType=MONTH&periodStart=2026-10-01') =>
    request(app.getHttpServer()).get(`/reports/utilization${query}`).set('x-test-user', user);

  it('API-028 201 with the new issue and its message, the first one saying ออกรายงานแล้ว', async () => {
    const res = await issue(ra1);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('ออกรายงานแล้ว');
    expect(res.body.report).toMatchObject({ periodType: 'MONTH', periodStart: '2026-10-01', periodEnd: '2026-10-31', issueNo: 1 });
  });

  it('AC-mrr-045 issued again: 201 ออกรายงานฉบับใหม่แล้ว ฉบับเดิมยังเก็บไว้, issue 2, issue 1 still listed', async () => {
    await issue(ra1);

    const res = await issue(ra1);

    expect([res.status, res.body.message, res.body.report.issueNo]).toEqual([201, 'ออกรายงานฉบับใหม่แล้ว ฉบับเดิมยังเก็บไว้', 2]);
    expect(res.body.report.issues.map((i: { issueNo: number }) => i.issueNo)).toEqual([1, 2]);
  });

  it('AC-mrr-070 API-029 the October report, with the rooms ranked by utilization', async () => {
    await issue(ra1);

    const res = await view(ra1);

    expect(res.status).toBe(200);
    expect(res.body.lines.map((l: any) => [l.rank, l.room.name, l.display])).toEqual([
      [1, 'ห้อง B', '0.91%'],
      [2, 'ห้อง A', '0.45%'],
    ]);
  });

  it('API-029 &issueNo=1 opens that issue; one that does not exist is 404', async () => {
    await issue(ra1);
    await issue(ra1);

    expect((await view(ra1, '?periodType=MONTH&periodStart=2026-10-01&issueNo=1')).body.issueNo).toBe(1);
    expect((await view(ra1)).body.issueNo).toBe(2);
    expect((await view(ra1, '?periodType=MONTH&periodStart=2026-10-01&issueNo=9')).status).toBe(404);
  });

  it('empty state — a period never issued is 404 ยังไม่มีรายงานของช่วงนี้', async () => {
    const res = await view(ra1);

    expect([res.status, res.body.message]).toEqual([404, 'ยังไม่มีรายงานของช่วงนี้']);
  });

  it('400 for a period type that is not MONTH or YEAR, a date that is not one, an issue number that is not whole, or a month not started on the 1st', async () => {
    expect((await issue(ra1, { periodType: 'WEEK', periodStart: '2026-10-01' })).status).toBe(400);
    expect((await issue(ra1, { periodType: 'MONTH', periodStart: 'October' })).status).toBe(400);
    expect((await issue(ra1, { periodType: 'MONTH', periodStart: '2026-10-02' })).body).toMatchObject({ statusCode: 400, message: 'periodStart ต้องเป็นวันแรกของเดือน' });
    expect((await view(ra1, '?periodType=MONTH&periodStart=2026-10-01&issueNo=x')).status).toBe(400);
  });

  it('AC-mrr-046 PATCH on an issued report is 409 รายงานที่ออกแล้วแก้ไขไม่ได้ กรุณาออกฉบับใหม่ and the numbers stay', async () => {
    const { body } = await issue(ra1);

    const res = await request(app.getHttpServer())
      .patch(`/reports/utilization/${body.report.id}`)
      .set('x-test-user', ra1)
      .send({ lines: [{ roomId: body.report.lines[0].room.id, bookedMinutes: 999 }] });

    expect([res.status, res.body.message]).toEqual([409, 'รายงานที่ออกแล้วแก้ไขไม่ได้ กรุณาออกฉบับใหม่']);
    expect((await view(ra1)).body.lines.map((l: any) => l.bookedMinutes)).toEqual([120, 60]);
  });

  it('API-030 the issue as a CSV file with every room, Thai intact', async () => {
    const { body } = await issue(ra1);

    const res = await request(app.getHttpServer()).get(`/reports/utilization/${body.report.id}/export`).set('x-test-user', ra1).buffer(true);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
    expect(res.headers['content-disposition']).toBe('attachment; filename="utilization-month-2026-10-01-issue-1.csv"');
    expect(res.text).toBe('﻿อันดับ,ห้อง,นาทีที่ใช้จริง,นาทีทำการ,อัตราการใช้งาน\r\n1,ห้อง B,120,13200,0.91%\r\n2,ห้อง A,60,13200,0.45%\r\n');
  });

  it.each([
    ['AC-mrr-071 a System Administrator', 'SYSTEM_ADMINISTRATOR'],
    ['AC-mrr-072 a General User', 'GENERAL_USER'],
  ] as const)('%s gets 403 เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้ — to read, to issue, to export', async (_, role) => {
    const { body } = await issue(ra1);
    const who = await seedUser(db, 'X', role);

    const read = await view(who);
    expect([read.status, read.body.message]).toEqual([403, REFUSAL]);
    expect(read.body).not.toHaveProperty('lines');
    expect((await issue(who)).status).toBe(403);
    expect((await request(app.getHttpServer()).get(`/reports/utilization/${body.report.id}/export`).set('x-test-user', who)).status).toBe(403);
  });

  it('404 ไม่พบรายงานฉบับนี้ for an unknown or malformed report id', async () => {
    const unknown = await request(app.getHttpServer()).get('/reports/utilization/00000000-0000-0000-0000-000000000000/export').set('x-test-user', ra1);
    expect([unknown.status, unknown.body.message]).toEqual([404, 'ไม่พบรายงานฉบับนี้']);
    expect((await request(app.getHttpServer()).get('/reports/utilization/nope/export').set('x-test-user', ra1)).status).toBe(404);
  });
});
