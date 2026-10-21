import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';

const BOOKING = '77777777-7777-4777-8777-777777777777';
const GET = `/bookings/${BOOKING}`;
const ADMIN_EDIT = `/bookings/${BOOKING}/admin-edit`;
const ADMIN_CANCEL = `/bookings/${BOOKING}/admin-cancel`;
const EDITED = 'บันทึกการแก้ไขสำเร็จ';
const CANCELLED = 'ยกเลิกการจองสำเร็จ';
const URGENT = 'ห้องต้องใช้จัดงานด่วน';

type Reply = { status: number; body?: unknown };
type Call = { method: string; url: string; body?: unknown };

let booking: Record<string, unknown>;
let replies: Record<string, Reply | (() => Reply | Promise<Reply>)>;
let calls: Call[];

beforeEach(() => {
  // AC-mrr-028 · AC-mrr-053 — U1's booking of room A 18/10 10:00–11:00, and it is 10:30.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T10:30:00+07:00'));
  booking = {
    id: BOOKING, roomId: 'r1', roomName: 'ห้อง A', startAt: '2026-10-18T03:00:00.000Z', endAt: '2026-10-18T04:00:00.000Z',
    title: 'ประชุมทีม', status: 'CONFIRMED', bookedBy: { id: 'u1', fullName: 'U1' }, attendees: [], equipment: [],
  };
  replies = {};
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    let r: Reply = { status: 500 };
    if (url === GET && method === 'GET') r = { status: 200, body: booking };
    // The page reads the booking's trail too (FE-mrr-012); it is FE-mrr-012's to show.
    if (url === `${GET}/audit` && method === 'GET') r = { status: 200, body: [] };
    // Who is signed in, as API-035 answers (FE-mrr-038): a Room Administrator, so the commands show.
    if (url === '/auth/me' && method === 'GET') r = { status: 200, body: { fullName: 'RA1', role: 'ROOM_ADMINISTRATOR' } };
    const asked = replies[`${method} ${url}`];
    if (asked) r = typeof asked === 'function' ? await asked() : asked;
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
const posts = () => calls.filter((c) => c.method === 'POST');
const trailReads = () => calls.filter((c) => c.method === 'GET' && c.url === `${GET}/audit`).length;

describe('FE-mrr-009 edit or cancel on behalf of the booker (UI-mrr-010)', () => {
  it('while the meeting is under way the title opens and แก้แทนผู้จอง · ยกเลิกแทนผู้จอง are offered, in the zone\'s order', async () => {
    open();

    expect(await loaded()).toHaveValue('ประชุมทีม');
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons.slice(buttons.indexOf('แก้แทนผู้จอง'))).toEqual(['แก้แทนผู้จอง', 'ยกเลิกแทนผู้จอง', 'กลับ']);
  });

  it('AC-mrr-028 · AC-mrr-053 ยกเลิกแทนผู้จอง with ห้องต้องใช้จัดงานด่วน posts API-015, says ยกเลิกการจองสำเร็จ and reads the trail again', async () => {
    replies[`POST ${ADMIN_CANCEL}`] = () => {
      booking = { ...booking, status: 'CANCELLED' };
      return { status: 200, body: { message: CANCELLED } };
    };
    open();
    await loaded();
    await waitFor(() => expect(trailReads()).toBe(1));
    type(URGENT);

    fireEvent.click(screen.getByTestId('ui-mrr-010-cancel-on-behalf'));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(CANCELLED));
    expect(posts()).toEqual([{ method: 'POST', url: ADMIN_CANCEL, body: { reason: URGENT } }]);
    expect(await screen.findByText('ยกเลิกแล้ว')).toHaveAttribute('data-testid', 'ui-mrr-010-ent-007-status');
    await waitFor(() => expect(trailReads()).toBe(2));
    // A cancelled booking holds no room: nothing more is done for the booker.
    expect(screen.queryByTestId('ui-mrr-010-cancel-on-behalf')).not.toBeInTheDocument();
    expect(screen.getByTestId('ui-mrr-010-ent-010-reason')).toHaveValue('');
  });

  it('AC-mrr-029 · AC-mrr-055 an empty reason — กรุณาระบุเหตุผล at the field, nothing is sent and the trail is not read again', async () => {
    open();
    await loaded();
    await waitFor(() => expect(trailReads()).toBe(1));
    type('   ');

    fireEvent.click(screen.getByTestId('ui-mrr-010-cancel-on-behalf'));

    expect(await screen.findByText('กรุณาระบุเหตุผล')).toHaveAttribute('id', 'ui-mrr-010-ent-010-reason-error');
    expect(screen.getByTestId('ui-mrr-010-ent-010-reason')).toHaveAttribute('aria-invalid', 'true');
    expect(posts()).toEqual([]);
    expect(screen.getByTestId('ui-mrr-010-ent-007-status')).toHaveTextContent('จองสำเร็จ (ห้องไม่ต้องอนุมัติ)');
    expect(trailReads()).toBe(1);
  });

  it('AC-mrr-042 at 10:59 RA1 retitles ประชุมวางแผน with ผู้จองพิมพ์หัวข้อผิด — changed at once, no request, บันทึกการแก้ไขสำเร็จ', async () => {
    vi.setSystemTime(new Date('2026-10-18T10:59:00+07:00'));
    replies[`POST ${ADMIN_EDIT}`] = () => {
      booking = { ...booking, title: 'ประชุมวางแผน' };
      return { status: 200, body: { message: EDITED } };
    };
    open();
    await loaded();
    fireEvent.change(screen.getByTestId('ui-mrr-010-ent-007-title'), { target: { value: 'ประชุมวางแผน' } });
    type('ผู้จองพิมพ์หัวข้อผิด');

    fireEvent.click(screen.getByTestId('ui-mrr-010-edit-on-behalf'));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(EDITED));
    expect(posts()).toEqual([{ method: 'POST', url: ADMIN_EDIT, body: { title: 'ประชุมวางแผน', reason: 'ผู้จองพิมพ์หัวข้อผิด' } }]);
    await waitFor(() => expect(screen.getByTestId('ui-mrr-010-ent-007-title')).toHaveValue('ประชุมวางแผน'));
    expect(screen.queryByText('การประชุมจบแล้ว — การแก้ไขจะเป็นคำขอให้ผู้ดูแลห้องคนอื่นอนุมัติ')).not.toBeInTheDocument();
  });

  it('UC-mrr-009 an edit with no reason — กรุณาระบุเหตุผล and nothing is sent', async () => {
    open();
    await loaded();
    fireEvent.change(screen.getByTestId('ui-mrr-010-ent-007-title'), { target: { value: 'ประชุมวางแผน' } });

    fireEvent.click(screen.getByTestId('ui-mrr-010-edit-on-behalf'));

    expect(await screen.findByText('กรุณาระบุเหตุผล')).toBeInTheDocument();
    expect(posts()).toEqual([]);
  });

  it('error state — the mail did not go: the api\'s words, the booking stays, the reason kept to press again', async () => {
    replies[`POST ${ADMIN_CANCEL}`] = { status: 503, body: { message: 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง' } };
    open();
    await loaded();
    type(URGENT);

    fireEvent.click(screen.getByTestId('ui-mrr-010-cancel-on-behalf'));

    expect(await screen.findByRole('alert')).toHaveTextContent('ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง');
    expect(screen.getByTestId('ui-mrr-010-ent-007-status')).toHaveTextContent('จองสำเร็จ (ห้องไม่ต้องอนุมัติ)');
    expect(screen.getByTestId('ui-mrr-010-ent-010-reason')).toHaveValue(URGENT);
  });

  it('error state — the meeting ended while the page was open: the api refuses and says why', async () => {
    replies[`POST ${ADMIN_CANCEL}`] = { status: 409, body: { message: 'การประชุมจบแล้ว ยกเลิกไม่ได้' } };
    open();
    await loaded();
    type(URGENT);
    vi.setSystemTime(new Date('2026-10-18T11:00:00+07:00'));

    fireEvent.click(screen.getByTestId('ui-mrr-010-cancel-on-behalf'));

    expect(await screen.findByRole('alert')).toHaveTextContent('การประชุมจบแล้ว ยกเลิกไม่ได้');
  });

  it('loading state — the command buttons are disabled while saving', async () => {
    let release!: (r: Reply) => void;
    replies[`POST ${ADMIN_CANCEL}`] = () => new Promise<Reply>((r) => (release = r));
    open();
    await loaded();
    type(URGENT);

    fireEvent.click(screen.getByTestId('ui-mrr-010-cancel-on-behalf'));

    await waitFor(() => expect(screen.getByTestId('ui-mrr-010-cancel-on-behalf')).toBeDisabled());
    expect(screen.getByTestId('ui-mrr-010-edit-on-behalf')).toBeDisabled();
    release({ status: 200, body: { message: CANCELLED } });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(CANCELLED));
  });

  it.each([
    ['before the start, 09:59 — the booker\'s own to change', '2026-10-18T09:59:00+07:00', 'CONFIRMED'],
    ['at the end, 11:00 — an edit becomes a request, nothing is cancelled', '2026-10-18T11:00:00+07:00', 'CONFIRMED'],
    ['a booking still waiting for approval holds no room', '2026-10-18T10:30:00+07:00', 'PENDING_APPROVAL'],
  ])('ACL-010 no ยกเลิกแทนผู้จอง %s', async (_what, now, status) => {
    vi.setSystemTime(new Date(now));
    booking = { ...booking, status };
    open();
    await loaded();

    expect(screen.queryByTestId('ui-mrr-010-cancel-on-behalf')).not.toBeInTheDocument();
  });

  it('ACL-010 the start itself counts — at 10:00 the booking can be cancelled for the booker', async () => {
    vi.setSystemTime(new Date('2026-10-18T10:00:00+07:00'));
    open();
    await loaded();

    expect(screen.getByTestId('ui-mrr-010-cancel-on-behalf')).toHaveTextContent('ยกเลิกแทนผู้จอง');
  });

  it('AC-mrr-086 a System Administrator at 10:30 sees the booking and its trail, but no reason, no แก้แทนผู้จอง and no ยกเลิกแทนผู้จอง — the booking stays', async () => {
    replies['GET /auth/me'] = { status: 200, body: { fullName: 'SA1', role: 'SYSTEM_ADMINISTRATOR' } };
    open();

    expect(await loaded()).toHaveTextContent('ประชุมทีม');
    await waitFor(() => expect(calls.some((c) => c.url === '/auth/me')).toBe(true));
    await waitFor(() => expect(screen.queryByTestId('ui-mrr-010-ent-010-reason')).not.toBeInTheDocument());
    expect(screen.queryByTestId('ui-mrr-010-edit-on-behalf')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ui-mrr-010-cancel-on-behalf')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /หัวข้อ/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('ui-mrr-010-back')).toBeInTheDocument();
    expect(trailReads()).toBeGreaterThan(0);
    expect(posts()).toHaveLength(0);
  });

  it('someone whose session API-035 refuses is taken to sign-in', async () => {
    replies['GET /auth/me'] = { status: 401, body: { message: 'Unauthorized' } };
    open();

    expect(await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
  });
});
