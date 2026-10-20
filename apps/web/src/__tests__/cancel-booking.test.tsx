import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';

const BOOKING = '55555555-5555-5555-5555-555555555555';
const CANCEL_URL = `/bookings/${BOOKING}/cancel`;

type Reply = { status: number; body?: unknown };
type Call = { method: string; url: string };

let status: string;
let cancelReply: Reply | Promise<Reply>;
let calls: Call[];

/** Far enough ahead that "before the start" holds whatever day the test runs. */
let slot = { startAt: '2099-10-17T03:00:00.000Z', endAt: '2099-10-17T04:00:00.000Z' };

const list = (): Reply => ({
  status: 200,
  body: { items: [{ id: BOOKING, roomId: 'r1', roomName: 'ห้อง A', ...slot, title: 'ประชุมทีม', status }], page: 1, pageSize: 20, total: 1 },
});

beforeEach(() => {
  status = 'CONFIRMED';
  slot = { startAt: '2099-10-17T03:00:00.000Z', endAt: '2099-10-17T04:00:00.000Z' };
  cancelReply = { status: 200, body: { message: 'ยกเลิกการจองสำเร็จ' } };
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url });
    let r: Reply = { status: 500 };
    if (url === '/me/bookings?page=1') r = list();
    if (url === CANCEL_URL && method === 'POST') {
      r = await cancelReply;
      // The api has cancelled it; the next read of the list says so.
      if (r.status === 200) status = 'CANCELLED';
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
    <MemoryRouter initialEntries={['/UI-mrr-007']}>
      <AppRoutes />
    </MemoryRouter>,
  );

const cancel = async () => fireEvent.click(await screen.findByTestId('ui-mrr-007-cancel'));
const cancels = () => calls.filter((c) => c.url === CANCEL_URL);

describe('FE-mrr-005 cancel own booking (UI-mrr-007 cancel)', () => {
  it('AC-mrr-009 cancels through POST /bookings/:id/cancel and shows ยกเลิกการจองสำเร็จ, staying on my bookings', async () => {
    open();
    await cancel();

    expect(await screen.findByRole('status')).toHaveTextContent('ยกเลิกการจองสำเร็จ');
    expect(cancels()).toEqual([{ method: 'POST', url: CANCEL_URL }]);
    expect(screen.getByRole('heading', { level: 1, name: 'การจองของฉัน' })).toBeInTheDocument();
    // The list is read again and the booking now shows as cancelled, with nothing left to press.
    await waitFor(() => expect(screen.getByTestId('ui-mrr-007-ent-007-status')).toHaveTextContent('ยกเลิกแล้ว'));
    expect(screen.queryByTestId('ui-mrr-007-cancel')).not.toBeInTheDocument();
  });

  it('AC-mrr-054 the booker sees ยกเลิกการจองสำเร็จ — no other step on the page', async () => {
    status = 'PENDING_APPROVAL';
    open();
    await cancel();

    expect(await screen.findByRole('status')).toHaveTextContent('ยกเลิกการจองสำเร็จ');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('AC-mrr-010 a refused cancel says เฉพาะผู้จองเท่านั้นที่แก้ไขหรือยกเลิกได้ and the booking stays', async () => {
    cancelReply = { status: 403, body: { message: 'เฉพาะผู้จองเท่านั้นที่แก้ไขหรือยกเลิกได้' } };
    open();
    await cancel();

    expect(await screen.findByRole('alert')).toHaveTextContent('เฉพาะผู้จองเท่านั้นที่แก้ไขหรือยกเลิกได้');
    expect(screen.getByTestId('ui-mrr-007-ent-007-status')).toHaveTextContent('จองสำเร็จ (ห้องไม่ต้องอนุมัติ)');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('AC-mrr-026 at 09:59 for a 10:00 booking the cancel is offered and goes through', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T09:59:00+07:00'));
    slot = { startAt: '2026-10-20T03:00:00.000Z', endAt: '2026-10-20T04:00:00.000Z' };
    open();
    await cancel();

    expect(await screen.findByRole('status')).toHaveTextContent('ยกเลิกการจองสำเร็จ');
    expect(cancels()).toHaveLength(1);
  });

  it('AC-mrr-027 pressed at 10:00 for a 10:00 booking — the api refuses and the page says the meeting has started', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T09:59:00+07:00'));
    slot = { startAt: '2026-10-20T03:00:00.000Z', endAt: '2026-10-20T04:00:00.000Z' };
    cancelReply = { status: 409, body: { message: 'การประชุมเริ่มแล้ว กรุณาติดต่อผู้ดูแลห้องเพื่อแก้ไขหรือยกเลิก' } };
    open();
    const button = await screen.findByTestId('ui-mrr-007-cancel');
    vi.setSystemTime(new Date('2026-10-20T10:00:00+07:00'));

    fireEvent.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent('การประชุมเริ่มแล้ว กรุณาติดต่อผู้ดูแลห้องเพื่อแก้ไขหรือยกเลิก');
    expect(screen.getByTestId('ui-mrr-007-ent-007-status')).toHaveTextContent('จองสำเร็จ (ห้องไม่ต้องอนุมัติ)');
  });

  it('at 10:00 a list read afresh offers no cancel for a booking that has started', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T10:00:00+07:00'));
    slot = { startAt: '2026-10-20T03:00:00.000Z', endAt: '2026-10-20T04:00:00.000Z' };
    open();
    await screen.findByTestId('ui-mrr-007-ent-007-room');

    expect(screen.queryByTestId('ui-mrr-007-cancel')).not.toBeInTheDocument();
  });

  it('error state — a mail that did not go asks to press again, the status unchanged and the button still there', async () => {
    cancelReply = { status: 503, body: { message: 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง' } };
    open();
    await cancel();

    expect(await screen.findByRole('alert')).toHaveTextContent('ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง');
    expect(screen.getByTestId('ui-mrr-007-ent-007-status')).toHaveTextContent('จองสำเร็จ (ห้องไม่ต้องอนุมัติ)');
    expect(screen.getByTestId('ui-mrr-007-cancel')).toBeEnabled();

    cancelReply = { status: 200, body: { message: 'ยกเลิกการจองสำเร็จ' } };
    fireEvent.click(screen.getByTestId('ui-mrr-007-cancel'));
    expect(await screen.findByRole('status')).toHaveTextContent('ยกเลิกการจองสำเร็จ');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('an answer the api gives no reason for still says the cancel did not happen', async () => {
    cancelReply = { status: 500 };
    open();
    await cancel();

    expect(await screen.findByRole('alert')).toHaveTextContent('ยกเลิกการจองไม่สำเร็จ กรุณากดยกเลิกอีกครั้ง');
  });

  it('the button is disabled while the cancel is on its way, so it is sent once', async () => {
    let answer!: (r: Reply) => void;
    cancelReply = new Promise<Reply>((resolve) => (answer = resolve));
    open();
    await cancel();

    expect(screen.getByTestId('ui-mrr-007-cancel')).toBeDisabled();
    fireEvent.click(screen.getByTestId('ui-mrr-007-cancel'));
    expect(cancels()).toHaveLength(1);

    answer({ status: 200, body: { message: 'ยกเลิกการจองสำเร็จ' } });
    expect(await screen.findByRole('status')).toHaveTextContent('ยกเลิกการจองสำเร็จ');
  });

  it('a session that ended goes to sign-in', async () => {
    cancelReply = { status: 401, body: { message: 'Unauthorized' } };
    open();
    await cancel();

    expect(await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
  });
});
