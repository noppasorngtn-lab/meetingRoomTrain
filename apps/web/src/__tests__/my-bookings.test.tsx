import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';

const ROOM_A = '11111111-1111-1111-1111-111111111111';

type Reply = { status: number; body?: unknown };

let replies: Record<string, Reply>;
let urls: string[];

/** Far enough ahead that "before the start" holds whatever day the test runs. */
const row = (over: object = {}) => ({
  id: '55555555-5555-5555-5555-555555555555', roomId: ROOM_A, roomName: 'ห้อง A',
  startAt: '2099-10-17T03:00:00.000Z', endAt: '2099-10-17T04:00:00.000Z', title: 'ประชุมทีม', status: 'CONFIRMED', ...over,
});

const pageOf = (items: object[], page = 1, total = items.length) => ({ status: 200, body: { items, page, pageSize: 20, total } });

beforeEach(() => {
  replies = {};
  urls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(url);
    const r = replies[url] ?? { status: 500 };
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const open = (path = '/UI-mrr-007') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );

const rows = () => screen.getAllByRole('row').slice(1);

describe('FE-mrr-006 my bookings page (UI-mrr-007)', () => {
  it('AC-mrr-011 lists the booking U1 made — room, Bangkok time, title, status — from GET /me/bookings', async () => {
    // The api answers only the caller's own bookings (FE-mrr-027); the page shows exactly what it gets.
    replies['/me/bookings?page=1'] = pageOf([row()]);
    open();

    expect(await screen.findByTestId('ui-mrr-007-ent-007-room')).toHaveTextContent('ห้อง A');
    expect(rows()).toHaveLength(1);
    expect(screen.getByTestId('ui-mrr-007-ent-007-start-at')).toHaveTextContent('17/10 10:00–11:00');
    expect(screen.getByTestId('ui-mrr-007-ent-007-title')).toHaveTextContent('ประชุมทีม');
    expect(screen.getByTestId('ui-mrr-007-ent-007-status')).toHaveTextContent('จองสำเร็จ (ห้องไม่ต้องอนุมัติ)');
    expect(screen.queryByText('ห้อง B')).not.toBeInTheDocument();
    expect(urls).toEqual(['/me/bookings?page=1']);
  });

  it('shows history with its STM-mrr-001 labels, and offers แก้ไข only where the booking can still be edited', async () => {
    replies['/me/bookings?page=1'] = pageOf([
      row({ id: 'b1', status: 'PENDING_APPROVAL' }),
      row({ id: 'b2', status: 'CANCELLED' }),
      row({ id: 'b3', status: 'APPROVED', startAt: '2020-01-01T03:00:00.000Z', endAt: '2020-01-01T04:00:00.000Z' }),
      row({ id: 'b4', status: 'REJECTED' }),
    ]);
    open();
    await screen.findAllByTestId('ui-mrr-007-ent-007-room');

    expect(screen.getAllByTestId('ui-mrr-007-ent-007-status').map((s) => s.textContent)).toEqual([
      'รออนุมัติ', 'ยกเลิกแล้ว', 'อนุมัติแล้ว', 'ปฏิเสธแล้ว',
    ]);
    expect(rows().map((r) => within(r).queryByTestId('ui-mrr-007-open') !== null)).toEqual([true, false, false, false]);
  });

  it('แก้ไข opens the edit page for that booking', async () => {
    replies['/me/bookings?page=1'] = pageOf([row()]);
    open();

    fireEvent.click(await screen.findByTestId('ui-mrr-007-open'));

    expect(await screen.findByRole('heading', { level: 1, name: 'แก้ไขการจอง' })).toBeInTheDocument();
    await waitFor(() => expect(urls).toContain('/bookings/55555555-5555-5555-5555-555555555555'));
  });

  it('cuts a long title with … and keeps the whole of it as the cell title', async () => {
    const long = 'ประชุมทบทวนแผนงานประจำไตรมาสสี่ของฝ่ายเทคโนโลยีสารสนเทศและฝ่ายปฏิบัติการร่วมกัน';
    replies['/me/bookings?page=1'] = pageOf([row({ title: long })]);
    open();

    const cell = await screen.findByTestId('ui-mrr-007-ent-007-title');
    expect(cell).toHaveClass('clip');
    expect(cell).toHaveAttribute('title', long);
  });

  it('empty state — คุณยังไม่มีการจอง with a way to search for a free room', async () => {
    replies['/me/bookings?page=1'] = pageOf([]);
    open();

    expect(await screen.findByText('คุณยังไม่มีการจอง')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('main')).getByRole('link', { name: 'ค้นหาห้องว่าง' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'ค้นหาห้องว่าง' })).toBeInTheDocument();
  });

  it('loading state — shows กำลังโหลดการจอง… in place of the list', async () => {
    replies['/me/bookings?page=1'] = pageOf([row()]);
    open();

    expect(screen.getByText('กำลังโหลดการจอง…')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await screen.findByRole('table');
    expect(screen.queryByText('กำลังโหลดการจอง…')).not.toBeInTheDocument();
  });

  it('error state — says the load failed and โหลดใหม่ asks again', async () => {
    open();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('โหลดการจองไม่สำเร็จ');

    replies['/me/bookings?page=1'] = pageOf([row()]);
    fireEvent.click(within(alert).getByRole('button', { name: 'โหลดใหม่' }));

    expect(await screen.findByTestId('ui-mrr-007-ent-007-room')).toHaveTextContent('ห้อง A');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(urls).toEqual(['/me/bookings?page=1', '/me/bookings?page=1']);
  });

  it('unauthorized state — someone not signed in is taken to sign-in', async () => {
    replies['/me/bookings?page=1'] = { status: 401, body: { message: 'Unauthorized' } };
    open();

    expect(await screen.findByRole('heading', { level: 1, name: 'ขอรหัสเข้าสู่ระบบ' })).toBeInTheDocument();
  });

  it('overflow state — more than 20 pages through the api, 20 to a page', async () => {
    replies['/me/bookings?page=1'] = pageOf([row({ id: 'p1', title: 'หน้าแรก' })], 1, 21);
    replies['/me/bookings?page=2'] = pageOf([row({ id: 'p2', title: 'หน้าสอง' })], 2, 21);
    open();

    expect(await screen.findByText('หน้า 1 จาก 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'หน้าก่อน' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'หน้าถัดไป' }));

    expect(await screen.findByText('หน้าสอง')).toBeInTheDocument();
    expect(screen.getByText('หน้า 2 จาก 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'หน้าถัดไป' })).toBeDisabled();
    expect(urls).toEqual(['/me/bookings?page=1', '/me/bookings?page=2']);
  });

  it('20 or fewer — no paging at all', async () => {
    replies['/me/bookings?page=1'] = pageOf([row()], 1, 20);
    open();
    await screen.findByRole('table');

    expect(screen.queryByRole('navigation', { name: 'แบ่งหน้า' })).not.toBeInTheDocument();
  });

  it('a notice carried from a save shows as the one status message', async () => {
    replies['/me/bookings?page=1'] = pageOf([row()]);
    render(
      <MemoryRouter initialEntries={[{ pathname: '/UI-mrr-007', state: { notice: 'บันทึกการแก้ไขสำเร็จ' } }]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('บันทึกการแก้ไขสำเร็จ');
    await screen.findByRole('table');
    expect(screen.getByRole('status')).toHaveTextContent('บันทึกการแก้ไขสำเร็จ');
  });
});
