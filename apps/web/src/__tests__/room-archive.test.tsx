import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';

const ROOM_A = '33333333-3333-4333-8333-333333333333';
const ROOM_B = '44444444-4444-4444-8444-444444444444';

const DELETED = 'ลบห้องแล้ว';
const REFUSAL = 'เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้';
/** The question put to the person before a room is archived — a delete that cannot be undone. */
const CONFIRM = 'การลบจะเลิกใช้ห้องถาวรและเปิดกลับไม่ได้ การจองเดิมคงไว้ ยืนยันลบหรือไม่';

type Reply = { status: number; body?: unknown };
type Call = { method: string; url: string };

let replies: Record<string, Reply | (() => Reply | Promise<Reply>)>;
let calls: Call[];
let confirmSpy: ReturnType<typeof vi.fn>;

const row = (over: object = {}) => ({
  id: ROOM_A, code: 'A', name: 'ห้อง A', capacity: 8, status: 'ACTIVE', requiresApproval: false, approver: null, versionNo: 1, ...over,
});
const pageOf = (items: object[]): Reply => ({ status: 200, body: { items, page: 1, pageSize: 20, total: items.length } });

const LIST = '/rooms?page=1';

beforeEach(() => {
  calls = [];
  replies = { [LIST]: pageOf([row()]) };
  confirmSpy = vi.fn().mockReturnValue(true);
  vi.stubGlobal('confirm', confirmSpy);
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url });
    const r = replies[`${method === 'GET' ? '' : `${method} `}${url}`] ?? { status: 500 };
    const reply = typeof r === 'function' ? await r() : r;
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const open = () =>
  render(
    <MemoryRouter initialEntries={['/UI-mrr-012']}>
      <AppRoutes />
    </MemoryRouter>,
  );

const posts = () => calls.filter((c) => c.method === 'POST');
const ARCHIVE = `POST /rooms/${ROOM_A}/archive`;

/** After the delete the api no longer lists the room. */
const archivedThen = () => {
  replies[LIST] = pageOf([]);
  return { status: 200, body: { message: DELETED } };
};

describe('FE-mrr-044 delete a room on the rooms page (UI-mrr-012)', () => {
  it('offers ลบห้อง on every room that is not archived, between แก้ไขห้อง and the maintenance button (UIC-001)', async () => {
    replies[LIST] = pageOf([row(), row({ id: ROOM_B, code: 'B', status: 'UNDER_MAINTENANCE' }), row({ id: 'z', code: 'Z', status: 'ARCHIVED' })]);
    open();

    const buttons = await screen.findAllByTestId('ui-mrr-012-archive');
    expect(buttons.map((b) => b.textContent)).toEqual(['ลบห้อง', 'ลบห้อง']);
    const first = buttons[0].closest('.row-actions') as HTMLElement;
    expect([...first.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['แก้ไขห้อง', 'ลบห้อง', 'ปิดปรับปรุง']);
  });

  it('AC-mrr-109 asks first, then posts to API-025, says ลบห้องแล้ว, and the room leaves the list', async () => {
    replies[ARCHIVE] = archivedThen;
    open();

    fireEvent.click(await screen.findByTestId('ui-mrr-012-archive'));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(DELETED));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toContain(CONFIRM);
    expect(confirmSpy.mock.calls[0][0]).toContain('ห้อง A');
    expect(posts()).toEqual([{ method: 'POST', url: `/rooms/${ROOM_A}/archive` }]);
    expect(await screen.findByText('ยังไม่มีห้องประชุม')).toBeInTheDocument();
    expect(screen.queryByTestId('ui-mrr-012-archive')).not.toBeInTheDocument();
  });

  it('a person who says no to the question deletes nothing', async () => {
    confirmSpy.mockReturnValue(false);
    open();

    fireEvent.click(await screen.findByTestId('ui-mrr-012-archive'));

    expect(posts()).toEqual([]);
    expect(screen.getByTestId('ui-mrr-012-ent-003-name')).toHaveTextContent('ห้อง A');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('AC-mrr-110 someone who is not a Room Administrator gets the api\'s words, and the room stays', async () => {
    replies[ARCHIVE] = { status: 403, body: { statusCode: 403, message: REFUSAL } };
    open();

    fireEvent.click(await screen.findByTestId('ui-mrr-012-archive'));

    expect(await screen.findByRole('alert')).toHaveTextContent(REFUSAL);
    expect(screen.getByTestId('ui-mrr-012-ent-003-name')).toHaveTextContent('ห้อง A');
  });

  it('error state — a delete that fails says so and the room stays', async () => {
    replies[ARCHIVE] = { status: 500 };
    open();

    fireEvent.click(await screen.findByTestId('ui-mrr-012-archive'));

    expect(await screen.findByRole('alert')).toHaveTextContent('ลบห้องไม่สำเร็จ กรุณากดอีกครั้ง');
    expect(screen.getByTestId('ui-mrr-012-ent-003-name')).toHaveTextContent('ห้อง A');
  });

  it('a room that is already gone says ไม่พบห้อง with the api\'s words', async () => {
    replies[ARCHIVE] = { status: 404, body: { statusCode: 404, message: 'ไม่พบห้อง' } };
    open();

    fireEvent.click(await screen.findByTestId('ui-mrr-012-archive'));

    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่พบห้อง');
  });

  it('one press at a time — every delete and toggle is disabled while one is being sent', async () => {
    let release!: (r: Reply) => void;
    replies[LIST] = pageOf([row(), row({ id: ROOM_B, code: 'B' })]);
    replies[ARCHIVE] = () => new Promise<Reply>((r) => (release = r));
    open();

    fireEvent.click((await screen.findAllByTestId('ui-mrr-012-archive'))[0]);

    await waitFor(() => screen.getAllByTestId('ui-mrr-012-archive').forEach((b) => expect(b).toBeDisabled()));
    screen.getAllByTestId('ui-mrr-012-toggle-maintenance').forEach((b) => expect(b).toBeDisabled());
    release({ status: 200, body: { message: DELETED } });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(DELETED));
  });
});
