import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';

const BOOKING = '55555555-5555-5555-5555-555555555555';
const GET = `/bookings/${BOOKING}`;
const DECIDE = `/bookings/${BOOKING}/decision`;

type Reply = { status: number; body?: unknown };
type Call = { method: string; url: string; body?: unknown };

let booking: Record<string, unknown>;
let decideReply: Reply | (() => Reply | Promise<Reply>);
let getReply: Reply | null;
let calls: Call[];
/** Who is signed in, as API-035 answers (FE-mrr-038); a Room Administrator unless a test says otherwise. */
let me: Reply;

/** Far enough ahead that "before the start" holds whatever day the test runs. */
const FUTURE = { startAt: '2099-10-18T03:00:00.000Z', endAt: '2099-10-18T04:00:00.000Z' };

beforeEach(() => {
  booking = {
    id: BOOKING, roomId: 'r1', roomName: 'ห้อง B', ...FUTURE, title: 'ประชุมลูกค้า', status: 'APPROVED',
    bookedBy: { id: 'u1', fullName: 'U1' }, attendees: [], equipment: [],
  };
  getReply = null;
  decideReply = { status: 200, body: { message: 'เปลี่ยนผลการอนุมัติสำเร็จ' } };
  calls = [];
  me = { status: 200, body: { fullName: 'RA1', role: 'ROOM_ADMINISTRATOR' } };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    let r: Reply = { status: 500 };
    if (url === GET && method === 'GET') r = getReply ?? { status: 200, body: booking };
    // The page reads the booking's trail too (FE-mrr-012); nothing has been done to it yet.
    if (url === `${GET}/audit` && method === 'GET') r = { status: 200, body: [] };
    if (url === '/auth/me' && method === 'GET') r = me;
    if (url === DECIDE && method === 'POST') {
      r = typeof decideReply === 'function' ? await decideReply() : decideReply;
      // The api has changed it; the next read says so.
      if (r.status === 200) booking = { ...booking, status: booking.status === 'APPROVED' ? 'REJECTED' : 'APPROVED' };
    }
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const open = () =>
  render(
    <MemoryRouter initialEntries={[`/UI-mrr-010?booking=${BOOKING}`]}>
      <AppRoutes />
    </MemoryRouter>,
  );

const loaded = () => screen.findByTestId('ui-mrr-010-ent-007-title');
const type = (value: string) => fireEvent.change(screen.getByTestId('ui-mrr-010-ent-010-reason'), { target: { value } });
const change = () => fireEvent.click(screen.getByTestId('ui-mrr-010-change-decision'));
const posts = () => calls.filter((c) => c.method === 'POST');

describe('FE-mrr-008 change an approval decision page (UI-mrr-010)', () => {
  it('shows the booking — title, Bangkok time, status — read through API-007', async () => {
    open();

    expect(await loaded()).toHaveTextContent('ประชุมลูกค้า');
    expect(screen.getByTestId('ui-mrr-010-ent-007-start-at')).toHaveTextContent('18/10 10:00–11:00');
    expect(screen.getByTestId('ui-mrr-010-ent-007-status')).toHaveTextContent('อนุมัติแล้ว');
    expect(calls[0]).toEqual({ method: 'GET', url: GET, body: undefined });
  });

  it('AC-mrr-033 approved → rejected with อนุมัติผิดห้อง: posts API-013, says เปลี่ยนผลการอนุมัติสำเร็จ and shows ปฏิเสธแล้ว', async () => {
    open();
    await loaded();
    expect(screen.getByText("ผลใหม่จะเป็น 'ปฏิเสธแล้ว'")).toBeInTheDocument();
    type('อนุมัติผิดห้อง');

    change();

    expect(await screen.findByRole('status')).toHaveTextContent('เปลี่ยนผลการอนุมัติสำเร็จ');
    expect(posts()).toEqual([{ method: 'POST', url: DECIDE, body: { decision: 'REJECTED', reason: 'อนุมัติผิดห้อง' } }]);
    await waitFor(() => expect(screen.getByTestId('ui-mrr-010-ent-007-status')).toHaveTextContent('ปฏิเสธแล้ว'));
    expect(screen.getByTestId('ui-mrr-010-ent-010-reason')).toHaveValue('');
    expect(screen.getByRole('heading', { level: 1, name: 'จัดการการจอง (ผู้ดูแล)' })).toBeInTheDocument();
  });

  it('AC-mrr-034 no reason — กรุณาระบุเหตุผล at the field, nothing sent, still อนุมัติแล้ว', async () => {
    open();
    await loaded();
    type('   ');

    change();

    expect(await screen.findByText('กรุณาระบุเหตุผล')).toBeInTheDocument();
    expect(screen.getByTestId('ui-mrr-010-ent-010-reason')).toHaveAttribute('aria-invalid', 'true');
    expect(posts()).toEqual([]);
    expect(screen.getByTestId('ui-mrr-010-ent-007-status')).toHaveTextContent('อนุมัติแล้ว');
  });

  it('AC-mrr-034 the api\'s own กรุณาระบุเหตุผล lands at the field too', async () => {
    decideReply = { status: 400, body: { statusCode: 400, field: 'reason', message: 'กรุณาระบุเหตุผล' } };
    open();
    await loaded();
    type('x');

    change();

    expect(await screen.findByText('กรุณาระบุเหตุผล')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('AC-mrr-035 rejected → approved with ปฏิเสธผิดคน a minute before the start goes through', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-18T09:59:00+07:00'));
    booking = { ...booking, status: 'REJECTED', startAt: '2026-10-18T03:00:00.000Z', endAt: '2026-10-18T04:00:00.000Z' };
    open();
    await loaded();
    expect(screen.getByText("ผลใหม่จะเป็น 'อนุมัติแล้ว'")).toBeInTheDocument();
    type('ปฏิเสธผิดคน');

    change();

    expect(await screen.findByRole('status')).toHaveTextContent('เปลี่ยนผลการอนุมัติสำเร็จ');
    expect(posts()[0].body).toEqual({ decision: 'APPROVED', reason: 'ปฏิเสธผิดคน' });
  });

  it('AC-mrr-036 pressed at 10:00 — the api refuses and the page says the meeting has started, status unchanged', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-18T09:59:00+07:00'));
    booking = { ...booking, startAt: '2026-10-18T03:00:00.000Z', endAt: '2026-10-18T04:00:00.000Z' };
    decideReply = { status: 409, body: { message: 'การประชุมเริ่มแล้ว ไม่สามารถเปลี่ยนผลการอนุมัติได้' } };
    open();
    await loaded();
    type('อนุมัติผิดห้อง');
    vi.setSystemTime(new Date('2026-10-18T10:00:00+07:00'));

    change();

    expect(await screen.findByRole('alert')).toHaveTextContent('การประชุมเริ่มแล้ว ไม่สามารถเปลี่ยนผลการอนุมัติได้');
    expect(screen.getByTestId('ui-mrr-010-ent-007-status')).toHaveTextContent('อนุมัติแล้ว');
    expect(screen.getByTestId('ui-mrr-010-ent-010-reason')).toHaveValue('อนุมัติผิดห้อง');
  });

  it('AC-mrr-036 a booking whose meeting has started offers no change at all', async () => {
    booking = { ...booking, startAt: '2020-10-18T03:00:00.000Z', endAt: '2020-10-18T04:00:00.000Z' };
    open();
    await loaded();

    expect(screen.queryByTestId('ui-mrr-010-change-decision')).not.toBeInTheDocument();
  });

  it.each(['PENDING_APPROVAL', 'CONFIRMED', 'CANCELLED'])('a booking that is %s has no decision to change — no button', async (state) => {
    booking = { ...booking, status: state };
    open();
    await loaded();

    expect(screen.queryByTestId('ui-mrr-010-change-decision')).not.toBeInTheDocument();
  });

  it('error state — the mail did not go: the api\'s words, status unchanged, the reason kept to press again', async () => {
    booking = { ...booking, status: 'REJECTED' };
    decideReply = { status: 503, body: { message: 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง' } };
    open();
    await loaded();
    type('ปฏิเสธผิดคน');

    change();

    expect(await screen.findByRole('alert')).toHaveTextContent('ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง');
    expect(screen.getByTestId('ui-mrr-010-ent-007-status')).toHaveTextContent('ปฏิเสธแล้ว');
    expect(screen.getByTestId('ui-mrr-010-ent-010-reason')).toHaveValue('ปฏิเสธผิดคน');
    expect(screen.getByTestId('ui-mrr-010-change-decision')).toBeEnabled();
  });

  it('room not free when approving again — the api\'s words', async () => {
    booking = { ...booking, status: 'REJECTED' };
    decideReply = { status: 409, body: { message: 'ห้องนี้ไม่ว่างในช่วงเวลาที่เลือก กรุณาเลือกเวลาอื่น' } };
    open();
    await loaded();
    type('ปฏิเสธผิดคน');

    change();

    expect(await screen.findByRole('alert')).toHaveTextContent('ห้องนี้ไม่ว่างในช่วงเวลาที่เลือก กรุณาเลือกเวลาอื่น');
  });

  it('unauthorized state — the api refuses someone who is not a Room Administrator, in its words', async () => {
    decideReply = { status: 403, body: { message: 'เฉพาะผู้ดูแลห้องเท่านั้นที่เปลี่ยนผลการอนุมัติได้' } };
    open();
    await loaded();
    type('อนุมัติผิดห้อง');

    change();

    expect(await screen.findByRole('alert')).toHaveTextContent('เฉพาะผู้ดูแลห้องเท่านั้นที่เปลี่ยนผลการอนุมัติได้');
  });

  it('loading state — the button is disabled while saving, so one change is sent', async () => {
    let answer!: (r: Reply) => void;
    decideReply = () => new Promise<Reply>((resolve) => (answer = resolve));
    open();
    await loaded();
    type('อนุมัติผิดห้อง');

    change();

    await waitFor(() => expect(screen.getByTestId('ui-mrr-010-change-decision')).toBeDisabled());
    change();
    expect(posts()).toHaveLength(1);
    answer({ status: 200, body: { message: 'เปลี่ยนผลการอนุมัติสำเร็จ' } });
    expect(await screen.findByRole('status')).toHaveTextContent('เปลี่ยนผลการอนุมัติสำเร็จ');
  });

  it('loading state — กำลังโหลดการจอง… until the booking arrives', async () => {
    open();

    expect(screen.getByText('กำลังโหลดการจอง…')).toBeInTheDocument();
    await loaded();
    expect(screen.queryByText('กำลังโหลดการจอง…')).not.toBeInTheDocument();
  });

  it('a booking that is not found says so, with กลับ to the queue', async () => {
    getReply = { status: 404, body: { message: 'ไม่พบการจอง' } };
    open();

    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่พบการจอง');
    fireEvent.click(screen.getByTestId('ui-mrr-010-back'));
    expect(await screen.findByRole('heading', { level: 1, name: 'รายการรออนุมัติ' })).toBeInTheDocument();
  });

  it('a failed load says so and โหลดใหม่ asks again', async () => {
    getReply = { status: 500 };
    open();

    expect(await screen.findByRole('alert')).toHaveTextContent('โหลดการจองไม่สำเร็จ');
    getReply = null;
    fireEvent.click(screen.getByRole('button', { name: 'โหลดใหม่' }));
    expect(await loaded()).toHaveTextContent('ประชุมลูกค้า');
  });

  it('someone not signed in is taken to sign-in', async () => {
    getReply = { status: 401, body: { message: 'Unauthorized' } };
    me = { status: 401, body: { message: 'Unauthorized' } };
    open();

    expect(await screen.findByRole('heading', { level: 1, name: 'ขอรหัสเข้าสู่ระบบ' })).toBeInTheDocument();
  });

  it('กลับ goes back to the pending queue', async () => {
    open();
    await loaded();

    fireEvent.click(screen.getByTestId('ui-mrr-010-back'));

    expect(await screen.findByRole('heading', { level: 1, name: 'รายการรออนุมัติ' })).toBeInTheDocument();
  });

  it('AC-mrr-087 a System Administrator before the start sees the booking and its trail, but no reason and no เปลี่ยนผลการอนุมัติ — the status stays อนุมัติแล้ว', async () => {
    me = { status: 200, body: { fullName: 'SA1', role: 'SYSTEM_ADMINISTRATOR' } };
    open();

    expect(await loaded()).toHaveTextContent('ประชุมลูกค้า');
    await waitFor(() => expect(calls.some((c) => c.url === '/auth/me')).toBe(true));
    await waitFor(() => expect(screen.queryByTestId('ui-mrr-010-ent-010-reason')).not.toBeInTheDocument());
    expect(screen.queryByTestId('ui-mrr-010-change-decision')).not.toBeInTheDocument();
    expect(screen.getByTestId('ui-mrr-010-ent-007-status')).toHaveTextContent('อนุมัติแล้ว');
    expect(screen.getByTestId('ui-mrr-010-back')).toBeInTheDocument();
    expect(calls.some((c) => c.url === `${GET}/audit`)).toBe(true);
    expect(posts()).toHaveLength(0);
  });

  it('while API-035 has not answered, nothing is offered — the default is no command', async () => {
    me = { status: 500 };
    open();

    await loaded();
    await waitFor(() => expect(calls.some((c) => c.url === '/auth/me')).toBe(true));
    expect(screen.queryByTestId('ui-mrr-010-change-decision')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ui-mrr-010-ent-010-reason')).not.toBeInTheDocument();
  });
});
