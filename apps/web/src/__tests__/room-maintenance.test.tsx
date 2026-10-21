import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';

const ROOM_A = '33333333-3333-4333-8333-333333333333';
const ROOM_B = '44444444-4444-4444-8444-444444444444';

const CLOSED = 'ตั้งห้องเป็นปิดปรับปรุงแล้ว การจองที่มีอยู่คงเดิม';
const OPENED = 'เปิดห้องใช้งานแล้ว';
const REFUSAL = 'เฉพาะผู้ดูแลห้องเท่านั้นที่ปิดปรับปรุงหรือเปิดใช้งานห้องได้';

type Reply = { status: number; body?: unknown };
type Call = { method: string; url: string };

let replies: Record<string, Reply | (() => Reply | Promise<Reply>)>;
let calls: Call[];

const row = (over: object = {}) => ({
  id: ROOM_A, code: 'A', name: 'ห้อง A', capacity: 8, status: 'ACTIVE', requiresApproval: false, approver: null, versionNo: 1, ...over,
});
const pageOf = (items: object[]): Reply => ({ status: 200, body: { items, page: 1, pageSize: 20, total: items.length } });

const LIST = '/rooms?page=1';

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
    <MemoryRouter initialEntries={['/UI-mrr-012']}>
      <AppRoutes />
    </MemoryRouter>,
  );

const posts = () => calls.filter((c) => c.method === 'POST');

/** After the toggle the api lists the room with its new status. */
const toggledThen = (status: string, message: string) => () => {
  replies[LIST] = pageOf([row({ status })]);
  return { status: 200, body: { message, status } };
};

describe('FE-mrr-014 maintenance toggle on the rooms page (UI-mrr-012)', () => {
  it('a room in use offers ปิดปรับปรุง, a room under maintenance เปิดใช้งาน, an archived room neither', async () => {
    replies[LIST] = pageOf([row(), row({ id: ROOM_B, code: 'B', status: 'UNDER_MAINTENANCE' }), row({ id: 'z', code: 'Z', status: 'ARCHIVED' })]);
    open();

    const buttons = await screen.findAllByTestId('ui-mrr-012-toggle-maintenance');
    expect(buttons.map((b) => b.textContent)).toEqual(['ปิดปรับปรุง', 'เปิดใช้งาน']);
  });

  it('AC-mrr-016 ปิดปรับปรุง posts to API-024 and says the existing bookings stay; the room reads ปิดปรับปรุง', async () => {
    replies[`POST /rooms/${ROOM_A}/maintenance`] = toggledThen('UNDER_MAINTENANCE', CLOSED);
    open();

    fireEvent.click(await screen.findByTestId('ui-mrr-012-toggle-maintenance'));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(CLOSED));
    expect(await screen.findByTestId('ui-mrr-012-ent-002-status')).toHaveTextContent('ปิดปรับปรุง');
    expect(screen.getByTestId('ui-mrr-012-toggle-maintenance')).toHaveTextContent('เปิดใช้งาน');
    expect(posts()).toEqual([{ method: 'POST', url: `/rooms/${ROOM_A}/maintenance` }]);
  });

  it('AC-mrr-081 เปิดใช้งาน opens the room again and says เปิดห้องใช้งานแล้ว', async () => {
    replies[LIST] = pageOf([row({ status: 'UNDER_MAINTENANCE' })]);
    replies[`POST /rooms/${ROOM_A}/maintenance`] = toggledThen('ACTIVE', OPENED);
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'เปิดใช้งาน' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(OPENED));
    expect(await screen.findByTestId('ui-mrr-012-ent-002-status')).toHaveTextContent('เปิดใช้งาน');
  });

  it('error state — a toggle that fails says so and the room\'s status does not change', async () => {
    replies[`POST /rooms/${ROOM_A}/maintenance`] = { status: 500 };
    open();

    fireEvent.click(await screen.findByTestId('ui-mrr-012-toggle-maintenance'));

    expect(await screen.findByRole('alert')).toHaveTextContent('เปลี่ยนสถานะห้องไม่สำเร็จ กรุณากดอีกครั้ง');
    expect(screen.getByTestId('ui-mrr-012-ent-002-status')).toHaveTextContent('เปิดใช้งาน');
  });

  it('unauthorized — a refused toggle shows the api\'s words', async () => {
    replies[`POST /rooms/${ROOM_A}/maintenance`] = { status: 403, body: { statusCode: 403, message: REFUSAL } };
    open();

    fireEvent.click(await screen.findByTestId('ui-mrr-012-toggle-maintenance'));

    expect(await screen.findByRole('alert')).toHaveTextContent(REFUSAL);
  });

  it('one press at a time — every toggle is disabled while one is being sent', async () => {
    let release!: (r: Reply) => void;
    replies[LIST] = pageOf([row(), row({ id: ROOM_B, code: 'B' })]);
    replies[`POST /rooms/${ROOM_A}/maintenance`] = () => new Promise<Reply>((r) => (release = r));
    open();

    fireEvent.click((await screen.findAllByTestId('ui-mrr-012-toggle-maintenance'))[0]);

    await waitFor(() => screen.getAllByTestId('ui-mrr-012-toggle-maintenance').forEach((b) => expect(b).toBeDisabled()));
    release({ status: 200, body: { message: CLOSED, status: 'UNDER_MAINTENANCE' } });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(CLOSED));
  });
});
