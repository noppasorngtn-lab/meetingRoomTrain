import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';

type Reply = { status: number; body?: unknown };
type Call = { method: string; url: string; body?: unknown };

let replies: Record<string, Reply | (() => Reply | Promise<Reply>)>;
let calls: Call[];

const OCT = '/reports/utilization?periodType=MONTH&periodStart=2026-10-01';
const ISSUE = 'POST /reports/utilization';

const line = (name: string, booked: number, operating: number, pct: string | null, rank: number | null) => ({
  room: { id: `r-${name}`, name }, bookedMinutes: booked, operatingMinutes: operating, utilizationPct: pct, display: pct === null ? '—' : `${pct}%`, rank,
});
/** AC-mrr-082 · AC-mrr-085 — October's issue as the api answers it. */
const report = (over: object = {}) => ({
  id: 'rep-1', periodType: 'MONTH', periodStart: '2026-10-01', periodEnd: '2026-10-31', issueNo: 1, issuedAt: '2026-11-01T02:00:00.000Z',
  issuedBy: { id: 'ra1', fullName: 'RA1' }, issues: [{ issueNo: 1, issuedAt: '2026-11-01T02:00:00.000Z' }],
  lines: [line('ห้อง B', 8800, 13200, '66.67', 1), line('ห้อง A', 4400, 13200, '33.33', 2), line('ห้อง E', 0, 0, null, null)],
  ...over,
});

beforeEach(() => {
  // It is 20/10/2026 in Bangkok, so the page opens on October.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-20T09:00:00+07:00'));
  calls = [];
  replies = { [OCT]: { status: 200, body: report() } };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r = replies[`${method === 'GET' ? '' : `${method} `}${url}`] ?? { status: 500 };
    const reply = typeof r === 'function' ? await r() : r;
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const open = () =>
  render(
    <MemoryRouter initialEntries={['/RPT-mrr-001']}>
      <AppRoutes />
    </MemoryRouter>,
  );

const cells = (testid: string) => screen.getAllByTestId(testid).map((c) => c.textContent);
const loaded = () => screen.findAllByTestId('rpt-mrr-001-ent-013-room');

describe('FE-mrr-016 utilization report page (RPT-mrr-001)', () => {
  it('AC-mrr-070 · AC-mrr-082 opens on this month and shows October\'s report from API-029, ranked: ห้อง B 66.67% first, ห้อง A 33.33% second', async () => {
    open();
    await loaded();

    expect(cells('rpt-mrr-001-ent-013-room')).toEqual(['ห้อง B', 'ห้อง A', 'ห้อง E']);
    expect(cells('rpt-mrr-001-ent-013-utilization-pct')).toEqual(['66.67%', '33.33%', '—']);
    expect(cells('rpt-mrr-001-ent-013-rank')).toEqual(['1', '2', '']);
    expect(cells('rpt-mrr-001-ent-013-booked-minutes')).toEqual(['8,800', '4,400', '0']);
    expect(cells('rpt-mrr-001-ent-013-operating-minutes')).toEqual(['13,200', '13,200', '0']);
    expect(screen.getByTestId('rpt-mrr-001-ent-012-period-type')).toHaveValue('MONTH');
    expect(screen.getByTestId('rpt-mrr-001-ent-012-period-start')).toHaveValue('2026-10');
    expect(calls).toEqual([{ method: 'GET', url: OCT, body: undefined }]);
  });

  it('the columns read in the wireframe\'s order: ห้อง · นาทีที่ใช้จริง · นาทีทำการ · อัตราการใช้งาน · อันดับ', async () => {
    open();
    await loaded();

    expect(within(screen.getByRole('table')).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'ห้อง', 'นาทีที่ใช้จริง', 'นาทีทำการ', 'อัตราการใช้งาน', 'อันดับ',
    ]);
  });

  it('AC-mrr-085 a room with no operating minutes shows — and no rank', async () => {
    open();
    await loaded();

    const row = screen.getByText('ห้อง E').closest('tr')!;
    expect(within(row).getByTestId('rpt-mrr-001-ent-013-utilization-pct')).toHaveTextContent('—');
    expect(within(row).getByTestId('rpt-mrr-001-ent-013-rank')).toBeEmptyDOMElement();
  });

  it('AC-mrr-045 ออกรายงานฉบับใหม่ posts API-028, says ออกรายงานฉบับใหม่แล้ว ฉบับเดิมยังเก็บไว้ and shows issue 2', async () => {
    replies[ISSUE] = {
      status: 201,
      body: {
        message: 'ออกรายงานฉบับใหม่แล้ว ฉบับเดิมยังเก็บไว้',
        report: report({
          id: 'rep-2', issueNo: 2, issuedAt: '2026-11-03T02:00:00.000Z',
          issues: [{ issueNo: 1, issuedAt: '2026-11-01T02:00:00.000Z' }, { issueNo: 2, issuedAt: '2026-11-03T02:00:00.000Z' }],
          lines: [line('ห้อง B', 8800, 13200, '66.67', 1), line('ห้อง A', 4460, 13200, '33.79', 2)],
        }),
      },
    };
    open();
    await loaded();

    fireEvent.click(screen.getByTestId('rpt-mrr-001-issue'));

    expect(await screen.findByRole('status')).toHaveTextContent('ออกรายงานฉบับใหม่แล้ว ฉบับเดิมยังเก็บไว้');
    expect(calls.filter((c) => c.method === 'POST')).toEqual([{ method: 'POST', url: '/reports/utilization', body: { periodType: 'MONTH', periodStart: '2026-10-01' } }]);
    expect(screen.getByTestId('rpt-mrr-001-ent-012-issue-no')).toHaveValue('2');
    expect(cells('rpt-mrr-001-ent-013-utilization-pct')).toEqual(['66.67%', '33.79%']);
    expect(within(screen.getByTestId('rpt-mrr-001-ent-012-issue-no')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'ฉบับที่ 1 · ออกเมื่อ 01/11 09:00', 'ฉบับที่ 2 · ออกเมื่อ 03/11 09:00',
    ]);
  });

  it('AC-mrr-047 เปิดฉบับที่ออกแล้ว opens issue 1 through API-029 &issueNo=1, its numbers as issued', async () => {
    replies[OCT] = {
      status: 200,
      body: report({ id: 'rep-2', issueNo: 2, issues: [{ issueNo: 1, issuedAt: '2026-11-01T02:00:00.000Z' }, { issueNo: 2, issuedAt: '2026-11-03T02:00:00.000Z' }], lines: [line('ห้อง A', 120, 13200, '0.91', 1)] }),
    };
    replies[`${OCT}&issueNo=1`] = { status: 200, body: report({ issues: [{ issueNo: 1, issuedAt: '2026-11-01T02:00:00.000Z' }, { issueNo: 2, issuedAt: '2026-11-03T02:00:00.000Z' }], lines: [line('ห้อง A', 60, 13200, '0.45', 1)] }) };
    open();
    await loaded();
    expect(screen.getByTestId('rpt-mrr-001-open-issue')).toBeDisabled();

    fireEvent.change(screen.getByTestId('rpt-mrr-001-ent-012-issue-no'), { target: { value: '1' } });
    fireEvent.click(screen.getByTestId('rpt-mrr-001-open-issue'));

    await waitFor(() => expect(cells('rpt-mrr-001-ent-013-utilization-pct')).toEqual(['0.45%']));
    expect(cells('rpt-mrr-001-ent-013-booked-minutes')).toEqual(['60']);
    expect(calls).toContainEqual({ method: 'GET', url: `${OCT}&issueNo=1`, body: undefined });
  });

  it('ส่งออก downloads the issue on screen from API-030', async () => {
    open();
    await loaded();

    const link = screen.getByTestId('rpt-mrr-001-export');
    expect(link).toHaveAttribute('href', '/reports/utilization/rep-1/export');
    expect(link).toHaveAttribute('download');
  });

  it('a year asks for 1 January of that year', async () => {
    replies['/reports/utilization?periodType=YEAR&periodStart=2026-01-01'] = { status: 200, body: report({ id: 'y', periodType: 'YEAR', periodStart: '2026-01-01', periodEnd: '2026-12-31' }) };
    open();
    await loaded();

    fireEvent.change(screen.getByTestId('rpt-mrr-001-ent-012-period-type'), { target: { value: 'YEAR' } });

    expect(screen.getByTestId('rpt-mrr-001-ent-012-period-start')).toHaveValue(2026);
    await waitFor(() => expect(calls).toContainEqual({ method: 'GET', url: '/reports/utilization?periodType=YEAR&periodStart=2026-01-01', body: undefined }));
  });

  it('empty state — ยังไม่มีรายงานของช่วงนี้ with ออกรายงานฉบับใหม่ ready, and the first issue says ออกรายงานแล้ว', async () => {
    replies[OCT] = { status: 404, body: { message: 'ยังไม่มีรายงานของช่วงนี้' } };
    replies[ISSUE] = { status: 201, body: { message: 'ออกรายงานแล้ว', report: report() } };
    open();

    expect(await screen.findByText('ยังไม่มีรายงานของช่วงนี้')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByTestId('rpt-mrr-001-export')).toBeDisabled();
    const press = screen.getByTestId('rpt-mrr-001-issue');
    expect(press).toBeEnabled();

    fireEvent.click(press);

    expect(await screen.findByRole('status')).toHaveTextContent('ออกรายงานแล้ว');
    expect(cells('rpt-mrr-001-ent-013-room')).toEqual(['ห้อง B', 'ห้อง A', 'ห้อง E']);
  });

  it('loading state — กำลังคำนวณรายงาน… while issuing, and ออกรายงานฉบับใหม่ is disabled so one issue is made', async () => {
    let answer!: (r: Reply) => void;
    replies[ISSUE] = () => new Promise<Reply>((resolve) => (answer = resolve));
    open();
    await loaded();

    fireEvent.click(screen.getByTestId('rpt-mrr-001-issue'));

    expect(await screen.findByText('กำลังคำนวณรายงาน…')).toBeInTheDocument();
    expect(screen.getByTestId('rpt-mrr-001-issue')).toBeDisabled();
    fireEvent.click(screen.getByTestId('rpt-mrr-001-issue'));
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    answer({ status: 201, body: { message: 'ออกรายงานฉบับใหม่แล้ว ฉบับเดิมยังเก็บไว้', report: report({ issueNo: 2 }) } });
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('กำลังคำนวณรายงาน…')).not.toBeInTheDocument();
  });

  it('loading state — กำลังโหลดรายงาน… until the report arrives', async () => {
    open();

    expect(screen.getByText('กำลังโหลดรายงาน…')).toBeInTheDocument();
    await loaded();
    expect(screen.queryByText('กำลังโหลดรายงาน…')).not.toBeInTheDocument();
  });

  it('error state — an issue that fails says so, makes nothing new, and leaves the report on screen', async () => {
    replies[ISSUE] = { status: 500 };
    open();
    await loaded();

    fireEvent.click(screen.getByTestId('rpt-mrr-001-issue'));

    expect(await screen.findByRole('alert')).toHaveTextContent('ออกรายงานไม่สำเร็จ กรุณากดอีกครั้ง');
    expect(screen.getByTestId('rpt-mrr-001-ent-012-issue-no')).toHaveValue('1');
    expect(cells('rpt-mrr-001-ent-013-room')).toEqual(['ห้อง B', 'ห้อง A', 'ห้อง E']);
  });

  it('error state — a failed load says so and โหลดใหม่ asks again', async () => {
    replies[OCT] = { status: 500 };
    open();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('โหลดรายงานไม่สำเร็จ');
    replies[OCT] = { status: 200, body: report() };
    fireEvent.click(within(alert).getByRole('button', { name: 'โหลดใหม่' }));

    expect(await loaded()).toHaveLength(3);
  });

  it.each([['AC-mrr-071 a System Administrator'], ['AC-mrr-072 U1, a General User']])('%s sees no report or figures: เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้', async () => {
    replies[OCT] = { status: 403, body: { message: 'เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้' } };
    open();

    expect(await screen.findByRole('alert')).toHaveTextContent('เฉพาะผู้ดูแลห้องเท่านั้นที่ดูรายงานได้');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rpt-mrr-001-issue')).not.toBeInTheDocument();
  });

  it('someone not signed in is taken to sign-in', async () => {
    replies[OCT] = { status: 401, body: { message: 'Unauthorized' } };
    open();

    expect(await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
  });

  it('overflow state — more than 50 rooms page on screen', async () => {
    const many = Array.from({ length: 51 }, (_, i) => line(`ห้อง ${String(i + 1).padStart(2, '0')}`, 51 - i, 13200, '0.01', i + 1));
    replies[OCT] = { status: 200, body: report({ lines: many }) };
    open();
    await loaded();

    expect(cells('rpt-mrr-001-ent-013-room')).toHaveLength(50);
    expect(screen.getByText('หน้า 1 จาก 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'หน้าถัดไป' }));

    expect(cells('rpt-mrr-001-ent-013-room')).toEqual(['ห้อง 51']);
    // The export is still the whole issue.
    expect(screen.getByTestId('rpt-mrr-001-export')).toHaveAttribute('href', '/reports/utilization/rep-1/export');
  });
});
