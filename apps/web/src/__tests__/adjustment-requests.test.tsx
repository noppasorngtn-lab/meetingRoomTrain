import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';

const REQUEST = '66666666-6666-6666-6666-666666666666';
const BOOKING = '55555555-5555-5555-5555-555555555555';
const RA1 = { id: '22222222-2222-2222-2222-222222222222', fullName: 'RA1' };

type Reply = { status: number; body?: unknown };
type Call = { method: string; url: string };

let replies: Record<string, Reply | (() => Reply | Promise<Reply>)>;
let calls: Call[];

/** AC-mrr-043's given — ห้อง A 18/10 10:00–11:00 'ประชุมทีม', RA1 asks for 'ประชุมวางแผน'. */
const row = (over: object = {}) => ({
  id: REQUEST,
  booking: { id: BOOKING, roomName: 'ห้อง A', title: 'ประชุมทีม', startAt: '2026-10-18T03:00:00.000Z', endAt: '2026-10-18T04:00:00.000Z' },
  requestedBy: RA1,
  proposedChanges: { title: 'ประชุมวางแผน' },
  reason: 'หัวข้อพิมพ์ผิด',
  status: 'PENDING',
  createdAt: '2026-10-18T05:00:00.000Z',
  canDecide: true,
  ...over,
});
const pageOf = (items: object[], page = 1, total = items.length): Reply => ({ status: 200, body: { items, page, pageSize: 20, total } });

const LIST = '/adjustment-requests?status=PENDING&page=1';
const OWN = 'ผู้แก้ไขอนุมัติคำขอของตัวเองไม่ได้ ต้องให้ผู้ดูแลห้องคนอื่นอนุมัติ';

beforeEach(() => {
  calls = [];
  replies = { [LIST]: pageOf([row()]) };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url });
    const r = replies[`${method === 'GET' ? '' : `${method} `}${url}`] ?? { status: 500 };
    const reply = typeof r === 'function' ? await r() : r;
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const open = () =>
  render(
    <MemoryRouter initialEntries={['/UI-mrr-011']}>
      <AppRoutes />
    </MemoryRouter>,
  );

const posts = () => calls.filter((c) => c.method === 'POST');

/** After a decision the api no longer lists the request. */
const decidedThen = (message: string) => () => {
  replies[LIST] = pageOf([]);
  return { status: 200, body: { message } };
};

describe('FE-mrr-011 adjustment requests page (UI-mrr-011)', () => {
  it('lists what waits — the booking, who asked, the asked-for values, the reason, รออนุมัติ — from API-017', async () => {
    open();

    const booking = await screen.findByTestId('ui-mrr-011-ent-011-booking');
    expect(booking).toHaveTextContent('ห้อง A');
    expect(booking).toHaveTextContent('18/10 10:00–11:00');
    expect(booking).toHaveTextContent('ประชุมทีม');
    expect(screen.getByTestId('ui-mrr-011-ent-011-requested-by')).toHaveTextContent('RA1');
    expect(screen.getByTestId('ui-mrr-011-ent-011-proposed-changes')).toHaveTextContent('หัวข้อ: ประชุมวางแผน');
    expect(screen.getByTestId('ui-mrr-011-ent-011-reason')).toHaveTextContent('หัวข้อพิมพ์ผิด');
    expect(screen.getByTestId('ui-mrr-011-ent-011-status')).toHaveTextContent('รออนุมัติ');
    expect(calls).toEqual([{ method: 'GET', url: LIST }]);
  });

  it('UIC-001 · UIC-002 row actions sit in the first column, named as design names them: อนุมัติคำขอ · ปฏิเสธคำขอ', async () => {
    open();
    const first = (await screen.findAllByRole('row'))[1].querySelector('td')!;

    expect(within(first).getAllByRole('button').map((b) => b.textContent)).toEqual(['อนุมัติคำขอ', 'ปฏิเสธคำขอ']);
  });

  it('a new time reads as one Bangkok slot, the end that did not move taken from the booking', async () => {
    replies[LIST] = pageOf([row({ proposedChanges: { endAt: '2026-10-18T04:30:00.000Z' } })]);
    open();

    expect(await screen.findByTestId('ui-mrr-011-ent-011-proposed-changes')).toHaveTextContent('ช่วงเวลา: 18/10 10:00–11:30');
  });

  it('overflow state — many asked-for values fold, and แสดงทั้งหมด opens the rest', async () => {
    replies[LIST] = pageOf([row({
      proposedChanges: {
        title: 'ประชุมวางแผน', startAt: '2026-10-18T02:00:00.000Z', endAt: '2026-10-18T04:00:00.000Z',
        attendeeIds: ['a', 'b', 'c'], equipmentIds: [],
      },
    })]);
    open();

    const cell = await screen.findByTestId('ui-mrr-011-ent-011-proposed-changes');
    const more = within(cell).getByText('แสดงทั้งหมด (4)');
    const details = more.closest('details')!;
    expect(details).not.toHaveAttribute('open');
    expect(within(details).getByText('ผู้เข้าร่วม: 3 คน')).toBeInTheDocument();
    expect(within(details).getByText('อุปกรณ์: ไม่ขออุปกรณ์')).toBeInTheDocument();
    fireEvent.click(more);
    expect(details).toHaveAttribute('open');
  });

  it('AC-mrr-043 อนุมัติคำขอ posts to API-018, says อนุมัติคำขอแก้ไขสำเร็จ and the request leaves the queue', async () => {
    replies[`POST /adjustment-requests/${REQUEST}/approve`] = decidedThen('อนุมัติคำขอแก้ไขสำเร็จ');
    open();

    fireEvent.click(await screen.findByTestId('ui-mrr-011-approve'));

    expect(await screen.findByRole('status')).toHaveTextContent('อนุมัติคำขอแก้ไขสำเร็จ');
    expect(posts()).toEqual([{ method: 'POST', url: `/adjustment-requests/${REQUEST}/approve` }]);
    expect(screen.getByRole('heading', { level: 1, name: 'คำขอแก้ไขการจอง' })).toBeInTheDocument();
    expect(await screen.findByText('ไม่มีคำขอแก้ไข')).toBeInTheDocument();
  });

  it('ปฏิเสธคำขอ posts to API-019 and says ปฏิเสธคำขอแก้ไขสำเร็จ', async () => {
    replies[`POST /adjustment-requests/${REQUEST}/reject`] = decidedThen('ปฏิเสธคำขอแก้ไขสำเร็จ');
    open();

    fireEvent.click(await screen.findByTestId('ui-mrr-011-reject'));

    expect(await screen.findByRole('status')).toHaveTextContent('ปฏิเสธคำขอแก้ไขสำเร็จ');
    expect(posts()).toEqual([{ method: 'POST', url: `/adjustment-requests/${REQUEST}/reject` }]);
  });

  it('AC-mrr-044 unauthorized state — on one\'s own request both buttons are disabled and the row says why', async () => {
    replies[LIST] = pageOf([row({ canDecide: false })]);
    open();

    const approve = await screen.findByTestId('ui-mrr-011-approve');
    expect(approve).toBeDisabled();
    expect(screen.getByTestId('ui-mrr-011-reject')).toBeDisabled();
    expect(approve).toHaveAccessibleDescription(OWN);
    fireEvent.click(approve);
    expect(posts()).toEqual([]);
    expect(screen.getByTestId('ui-mrr-011-ent-011-status')).toHaveTextContent('รออนุมัติ');
  });

  it('AC-mrr-044 if the api refuses anyway, its words show and the request stays waiting', async () => {
    replies[`POST /adjustment-requests/${REQUEST}/approve`] = { status: 403, body: { message: OWN } };
    open();

    fireEvent.click(await screen.findByTestId('ui-mrr-011-approve'));

    expect(await screen.findByRole('alert')).toHaveTextContent(OWN);
    expect(screen.getByTestId('ui-mrr-011-ent-011-status')).toHaveTextContent('รออนุมัติ');
    expect(screen.getByTestId('ui-mrr-011-ent-011-booking')).toHaveTextContent('ประชุมทีม');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('error state — a new time another booking now holds: the api\'s words, still listed, press again', async () => {
    replies[`POST /adjustment-requests/${REQUEST}/approve`] = { status: 409, body: { message: 'ช่วงเวลานี้มีการจองแล้ว' } };
    open();
    fireEvent.click(await screen.findByTestId('ui-mrr-011-approve'));

    expect(await screen.findByRole('alert')).toHaveTextContent('ช่วงเวลานี้มีการจองแล้ว');
    expect(screen.getByTestId('ui-mrr-011-approve')).toBeEnabled();

    replies[`POST /adjustment-requests/${REQUEST}/reject`] = decidedThen('ปฏิเสธคำขอแก้ไขสำเร็จ');
    fireEvent.click(screen.getByTestId('ui-mrr-011-reject'));
    expect(await screen.findByRole('status')).toHaveTextContent('ปฏิเสธคำขอแก้ไขสำเร็จ');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a decision with no reason from the api still says it did not happen', async () => {
    replies[`POST /adjustment-requests/${REQUEST}/reject`] = { status: 500 };
    open();
    fireEvent.click(await screen.findByTestId('ui-mrr-011-reject'));

    expect(await screen.findByRole('alert')).toHaveTextContent('บันทึกผลไม่สำเร็จ กรุณากดอีกครั้ง');
  });

  it('both buttons are disabled while a decision is on its way, so one is sent', async () => {
    let answer!: (r: Reply) => void;
    replies[`POST /adjustment-requests/${REQUEST}/approve`] = () => new Promise<Reply>((resolve) => (answer = resolve));
    open();
    fireEvent.click(await screen.findByTestId('ui-mrr-011-approve'));

    await waitFor(() => expect(screen.getByTestId('ui-mrr-011-approve')).toBeDisabled());
    expect(screen.getByTestId('ui-mrr-011-reject')).toBeDisabled();
    fireEvent.click(screen.getByTestId('ui-mrr-011-reject'));
    expect(posts()).toHaveLength(1);

    replies[LIST] = pageOf([]);
    answer({ status: 200, body: { message: 'อนุมัติคำขอแก้ไขสำเร็จ' } });
    expect(await screen.findByRole('status')).toHaveTextContent('อนุมัติคำขอแก้ไขสำเร็จ');
  });

  it('unauthorized state — not a Room Administrator: คุณไม่มีสิทธิ์เข้าหน้านี้ and no list', async () => {
    replies[LIST] = { status: 403, body: { message: 'คุณไม่มีสิทธิ์เข้าหน้านี้' } };
    open();

    expect(await screen.findByRole('alert')).toHaveTextContent('คุณไม่มีสิทธิ์เข้าหน้านี้');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ui-mrr-011-approve')).not.toBeInTheDocument();
  });

  it('empty state — ไม่มีคำขอแก้ไข', async () => {
    replies[LIST] = pageOf([]);
    open();

    expect(await screen.findByText('ไม่มีคำขอแก้ไข')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('loading state — shows กำลังโหลดคำขอแก้ไข… in place of the list', async () => {
    open();

    expect(screen.getByText('กำลังโหลดคำขอแก้ไข…')).toBeInTheDocument();
    await screen.findByRole('table');
    expect(screen.queryByText('กำลังโหลดคำขอแก้ไข…')).not.toBeInTheDocument();
  });

  it('error state — a failed load says so and โหลดใหม่ asks again', async () => {
    replies[LIST] = { status: 500 };
    open();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('โหลดคำขอแก้ไขไม่สำเร็จ');
    replies[LIST] = pageOf([row()]);
    fireEvent.click(within(alert).getByRole('button', { name: 'โหลดใหม่' }));

    expect(await screen.findByTestId('ui-mrr-011-ent-011-reason')).toHaveTextContent('หัวข้อพิมพ์ผิด');
  });

  it('someone not signed in is taken to sign-in', async () => {
    replies[LIST] = { status: 401, body: { message: 'Unauthorized' } };
    open();

    expect(await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
  });

  it('overflow state — more than 20 pages through the api', async () => {
    replies[LIST] = pageOf([row({ reason: 'หน้าแรก' })], 1, 21);
    replies['/adjustment-requests?status=PENDING&page=2'] = pageOf([row({ id: 'p2', reason: 'หน้าสอง' })], 2, 21);
    open();

    expect(await screen.findByText('หน้า 1 จาก 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'หน้าถัดไป' }));

    expect(await screen.findByText('หน้าสอง')).toBeInTheDocument();
    expect(screen.getByText('หน้า 2 จาก 2')).toBeInTheDocument();
  });
});
