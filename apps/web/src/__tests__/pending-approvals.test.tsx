import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';

const BOOKING = '55555555-5555-5555-5555-555555555555';
const U1 = { id: '11111111-1111-1111-1111-111111111111', fullName: 'U1' };
const RA1 = { id: '22222222-2222-2222-2222-222222222222', fullName: 'RA1' };

type Reply = { status: number; body?: unknown };
type Call = { method: string; url: string };

let replies: Record<string, Reply | (() => Reply | Promise<Reply>)>;
let calls: Call[];

const row = (over: object = {}) => ({
  id: BOOKING, roomId: 'r1', roomName: 'ห้อง B', startAt: '2026-10-18T03:00:00.000Z', endAt: '2026-10-18T04:00:00.000Z',
  title: 'ประชุมลูกค้า', bookedBy: U1, approver: null, canDecide: true, ...over,
});
const pageOf = (items: object[], page = 1, total = items.length): Reply => ({ status: 200, body: { items, page, pageSize: 20, total } });

const LIST = '/bookings?status=PENDING_APPROVAL&page=1';

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
    <MemoryRouter initialEntries={['/UI-mrr-009']}>
      <AppRoutes />
    </MemoryRouter>,
  );

const posts = () => calls.filter((c) => c.method === 'POST');

/** After a decision the api no longer lists the booking. */
const decidedThen = (message: string) => () => {
  replies[LIST] = pageOf([]);
  return { status: 200, body: { message } };
};

describe('FE-mrr-007 pending approvals page (UI-mrr-009)', () => {
  it('lists what waits — room, Bangkok time, title, booker, the room\'s approver — from API-010', async () => {
    replies[LIST] = pageOf([row(), row({ id: 'b2', title: 'ประชุมทีม', approver: RA1, canDecide: true })]);
    open();

    const rooms = await screen.findAllByTestId('ui-mrr-009-ent-007-room');
    expect(rooms.map((r) => r.textContent)).toEqual(['ห้อง B', 'ห้อง B']);
    expect(screen.getAllByTestId('ui-mrr-009-ent-007-start-at')[0]).toHaveTextContent('18/10 10:00–11:00');
    expect(screen.getAllByTestId('ui-mrr-009-ent-007-title').map((t) => t.textContent)).toEqual(['ประชุมลูกค้า', 'ประชุมทีม']);
    expect(screen.getAllByTestId('ui-mrr-009-ent-007-booked-by')[0]).toHaveTextContent('U1');
    expect(screen.getAllByTestId('ui-mrr-009-ent-003-approver').map((a) => a.textContent)).toEqual(['ไม่กำหนด', 'RA1']);
    expect(calls).toEqual([{ method: 'GET', url: LIST }]);
  });

  it('UIC-001 row actions sit in the first column: จัดการการจอง · อนุมัติ · ปฏิเสธ', async () => {
    open();
    const first = (await screen.findAllByRole('row'))[1].querySelector('td')!;

    expect(within(first).getAllByRole('button').map((b) => b.textContent)).toEqual(['จัดการการจอง', 'อนุมัติ', 'ปฏิเสธ']);
  });

  it('AC-mrr-013 · AC-mrr-037 · AC-mrr-039 อนุมัติ posts to API-011, says อนุมัติการจองสำเร็จ and the booking leaves the queue', async () => {
    replies[`POST /bookings/${BOOKING}/approve`] = decidedThen('อนุมัติการจองสำเร็จ');
    open();

    fireEvent.click(await screen.findByTestId('ui-mrr-009-approve'));

    expect(await screen.findByRole('status')).toHaveTextContent('อนุมัติการจองสำเร็จ');
    expect(posts()).toEqual([{ method: 'POST', url: `/bookings/${BOOKING}/approve` }]);
    expect(screen.getByRole('heading', { level: 1, name: 'รายการรออนุมัติ' })).toBeInTheDocument();
    expect(await screen.findByText('ไม่มีรายการรออนุมัติ')).toBeInTheDocument();
  });

  it('AC-mrr-051 a booking whose start has passed but is still listed is approvable like any other', async () => {
    replies[LIST] = pageOf([row({ startAt: '2020-10-18T03:00:00.000Z', endAt: '2020-10-18T04:00:00.000Z' })]);
    replies[`POST /bookings/${BOOKING}/approve`] = decidedThen('อนุมัติการจองสำเร็จ');
    open();

    const approve = await screen.findByTestId('ui-mrr-009-approve');
    expect(approve).toBeEnabled();
    fireEvent.click(approve);
    expect(await screen.findByRole('status')).toHaveTextContent('อนุมัติการจองสำเร็จ');
  });

  it('AC-mrr-052 the page asks the api, which records the trail — nothing more is sent than the decision', async () => {
    replies[`POST /bookings/${BOOKING}/approve`] = decidedThen('อนุมัติการจองสำเร็จ');
    open();

    fireEvent.click(await screen.findByTestId('ui-mrr-009-approve'));

    await screen.findByRole('status');
    expect(posts()).toHaveLength(1);
  });

  it('ปฏิเสธ posts to API-012 and says ปฏิเสธการจองสำเร็จ', async () => {
    replies[`POST /bookings/${BOOKING}/reject`] = decidedThen('ปฏิเสธการจองสำเร็จ');
    open();

    fireEvent.click(await screen.findByTestId('ui-mrr-009-reject'));

    expect(await screen.findByRole('status')).toHaveTextContent('ปฏิเสธการจองสำเร็จ');
    expect(posts()).toEqual([{ method: 'POST', url: `/bookings/${BOOKING}/reject` }]);
  });

  it('AC-mrr-038 unauthorized state — a room whose approver is someone else shows อนุมัติ and ปฏิเสธ disabled', async () => {
    replies[LIST] = pageOf([row({ approver: RA1, canDecide: false })]);
    open();

    expect(await screen.findByTestId('ui-mrr-009-approve')).toBeDisabled();
    expect(screen.getByTestId('ui-mrr-009-reject')).toBeDisabled();
    expect(screen.getByTestId('ui-mrr-009-manage')).toBeEnabled();
  });

  it('AC-mrr-038 if the api refuses anyway, its words show and the booking stays in the queue', async () => {
    replies[`POST /bookings/${BOOKING}/approve`] = { status: 403, body: { message: 'เฉพาะผู้อนุมัติประจำห้องนี้เท่านั้นที่อนุมัติได้' } };
    open();

    fireEvent.click(await screen.findByTestId('ui-mrr-009-approve'));

    expect(await screen.findByRole('alert')).toHaveTextContent('เฉพาะผู้อนุมัติประจำห้องนี้เท่านั้นที่อนุมัติได้');
    expect(screen.getByTestId('ui-mrr-009-ent-007-title')).toHaveTextContent('ประชุมลูกค้า');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('AC-mrr-014 unauthorized state — not a Room Administrator: คุณไม่มีสิทธิ์เข้าหน้านี้ and no list', async () => {
    replies[LIST] = { status: 403, body: { message: 'คุณไม่มีสิทธิ์เข้าหน้านี้' } };
    open();

    expect(await screen.findByRole('alert')).toHaveTextContent('คุณไม่มีสิทธิ์เข้าหน้านี้');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ui-mrr-009-approve')).not.toBeInTheDocument();
  });

  it('AC-mrr-062 error state — the mail did not go: ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง, still listed, press again', async () => {
    replies[`POST /bookings/${BOOKING}/approve`] = { status: 503, body: { message: 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง' } };
    open();
    fireEvent.click(await screen.findByTestId('ui-mrr-009-approve'));

    expect(await screen.findByRole('alert')).toHaveTextContent('ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง');
    expect(screen.getByTestId('ui-mrr-009-approve')).toBeEnabled();

    replies[`POST /bookings/${BOOKING}/approve`] = decidedThen('อนุมัติการจองสำเร็จ');
    fireEvent.click(screen.getByTestId('ui-mrr-009-approve'));
    expect(await screen.findByRole('status')).toHaveTextContent('อนุมัติการจองสำเร็จ');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a decision with no reason from the api still says it did not happen', async () => {
    replies[`POST /bookings/${BOOKING}/reject`] = { status: 500 };
    open();
    fireEvent.click(await screen.findByTestId('ui-mrr-009-reject'));

    expect(await screen.findByRole('alert')).toHaveTextContent('บันทึกผลไม่สำเร็จ กรุณากดอีกครั้ง');
  });

  it('both buttons are disabled while a decision is on its way, so one is sent', async () => {
    let answer!: (r: Reply) => void;
    replies[`POST /bookings/${BOOKING}/approve`] = () => new Promise<Reply>((resolve) => (answer = resolve));
    open();
    fireEvent.click(await screen.findByTestId('ui-mrr-009-approve'));

    await waitFor(() => expect(screen.getByTestId('ui-mrr-009-approve')).toBeDisabled());
    expect(screen.getByTestId('ui-mrr-009-reject')).toBeDisabled();
    fireEvent.click(screen.getByTestId('ui-mrr-009-reject'));
    expect(posts()).toHaveLength(1);

    replies[LIST] = pageOf([]);
    answer({ status: 200, body: { message: 'อนุมัติการจองสำเร็จ' } });
    expect(await screen.findByRole('status')).toHaveTextContent('อนุมัติการจองสำเร็จ');
  });

  it('จัดการการจอง opens the admin page for that booking', async () => {
    open();

    fireEvent.click(await screen.findByTestId('ui-mrr-009-manage'));

    expect(await screen.findByRole('heading', { level: 1, name: 'จัดการการจอง (ผู้ดูแล)' })).toBeInTheDocument();
    await waitFor(() => expect(calls).toContainEqual({ method: 'GET', url: `/bookings/${BOOKING}` }));
  });

  it('empty state — ไม่มีรายการรออนุมัติ', async () => {
    replies[LIST] = pageOf([]);
    open();

    expect(await screen.findByText('ไม่มีรายการรออนุมัติ')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('loading state — shows กำลังโหลดรายการรออนุมัติ… in place of the list', async () => {
    open();

    expect(screen.getByText('กำลังโหลดรายการรออนุมัติ…')).toBeInTheDocument();
    await screen.findByRole('table');
    expect(screen.queryByText('กำลังโหลดรายการรออนุมัติ…')).not.toBeInTheDocument();
  });

  it('error state — a failed load says so and โหลดใหม่ asks again', async () => {
    replies[LIST] = { status: 500 };
    open();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('โหลดรายการรออนุมัติไม่สำเร็จ');
    replies[LIST] = pageOf([row()]);
    fireEvent.click(within(alert).getByRole('button', { name: 'โหลดใหม่' }));

    expect(await screen.findByTestId('ui-mrr-009-ent-007-title')).toHaveTextContent('ประชุมลูกค้า');
  });

  it('someone not signed in is taken to sign-in', async () => {
    replies[LIST] = { status: 401, body: { message: 'Unauthorized' } };
    open();

    expect(await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
  });

  it('overflow state — more than 20 pages through the api', async () => {
    replies[LIST] = pageOf([row({ title: 'หน้าแรก' })], 1, 21);
    replies['/bookings?status=PENDING_APPROVAL&page=2'] = pageOf([row({ id: 'p2', title: 'หน้าสอง' })], 2, 21);
    open();

    expect(await screen.findByText('หน้า 1 จาก 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'หน้าถัดไป' }));

    expect(await screen.findByText('หน้าสอง')).toBeInTheDocument();
    expect(screen.getByText('หน้า 2 จาก 2')).toBeInTheDocument();
  });
});
