import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';

const BOOKING = '66666666-6666-6666-6666-666666666666';
const GET = `/bookings/${BOOKING}`;
const ADMIN_EDIT = `/bookings/${BOOKING}/admin-edit`;
const SENT = 'ส่งคำขอแก้ไขแล้ว รอผู้ดูแลห้องคนอื่นอนุมัติ';

type Reply = { status: number; body?: unknown };
type Call = { method: string; url: string; body?: unknown };

let booking: Record<string, unknown>;
let editReply: Reply | (() => Reply | Promise<Reply>);
let calls: Call[];

beforeEach(() => {
  // AC-mrr-041 — room A 18/10 10:00–11:00 'ประชุมทีม' of U1, and it is 11:00, the end itself.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T11:00:00+07:00'));
  booking = {
    id: BOOKING, roomId: 'r1', roomName: 'ห้อง A', startAt: '2026-10-18T03:00:00.000Z', endAt: '2026-10-18T04:00:00.000Z',
    title: 'ประชุมทีม', status: 'CONFIRMED', bookedBy: { id: 'u1', fullName: 'U1' }, attendees: [], equipment: [],
  };
  editReply = { status: 200, body: { message: SENT } };
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    let r: Reply = { status: 500 };
    if (url === GET && method === 'GET') r = { status: 200, body: booking };
    // The page reads the booking's trail too (FE-mrr-012); nothing has been done to it yet.
    if (url === `${GET}/audit` && method === 'GET') r = { status: 200, body: [] };
    // Who is signed in, as API-035 answers (FE-mrr-038): a Room Administrator, so the commands show.
    if (url === '/auth/me' && method === 'GET') r = { status: 200, body: { fullName: 'RA1', role: 'ROOM_ADMINISTRATOR' } };
    // A request changes nothing on the booking until another Room Administrator approves (BR-mrr-014).
    if (url === ADMIN_EDIT && method === 'POST') r = typeof editReply === 'function' ? await editReply() : editReply;
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
const retitle = (value: string) => fireEvent.change(screen.getByTestId('ui-mrr-010-ent-007-title'), { target: { value } });
const type = (value: string) => fireEvent.change(screen.getByTestId('ui-mrr-010-ent-010-reason'), { target: { value } });
const edit = () => fireEvent.click(screen.getByTestId('ui-mrr-010-edit-on-behalf'));
const posts = () => calls.filter((c) => c.method === 'POST');

describe('FE-mrr-010 adjustment request after the meeting ends page (UI-mrr-010)', () => {
  it('AC-mrr-041 at 11:00 RA1 retitles ประชุมวางแผน with ผู้จองพิมพ์หัวข้อผิด: a request is sent, the title stays ประชุมทีม', async () => {
    open();
    expect(await loaded()).toHaveValue('ประชุมทีม');
    retitle('ประชุมวางแผน');
    type('ผู้จองพิมพ์หัวข้อผิด');

    edit();

    expect(await screen.findByRole('status')).toHaveTextContent(SENT);
    expect(posts()).toEqual([{ method: 'POST', url: ADMIN_EDIT, body: { title: 'ประชุมวางแผน', reason: 'ผู้จองพิมพ์หัวข้อผิด' } }]);
    // Read again: the booking keeps its values.
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET' && c.url === GET)).toHaveLength(2));
    await waitFor(() => expect(screen.getByTestId('ui-mrr-010-ent-007-title')).toHaveValue('ประชุมทีม'));
    expect(screen.getByTestId('ui-mrr-010-ent-007-status')).toHaveTextContent('จองสำเร็จ (ห้องไม่ต้องอนุมัติ)');
    expect(screen.getByTestId('ui-mrr-010-ent-010-reason')).toHaveValue('');
  });

  it('UC-mrr-010 no reason — กรุณาระบุเหตุผล at the field and nothing is sent', async () => {
    open();
    await loaded();
    retitle('ประชุมวางแผน');
    type('  ');

    edit();

    expect(await screen.findByText('กรุณาระบุเหตุผล')).toBeInTheDocument();
    expect(screen.getByTestId('ui-mrr-010-ent-010-reason')).toHaveAttribute('aria-invalid', 'true');
    expect(posts()).toEqual([]);
    expect(screen.getByTestId('ui-mrr-010-ent-007-title')).toHaveValue('ประชุมวางแผน');
  });

  it('UC-mrr-010 the api\'s own กรุณาระบุเหตุผล lands at the field too', async () => {
    editReply = { status: 400, body: { message: 'กรุณาระบุเหตุผล', field: 'reason' } };
    open();
    await loaded();
    retitle('ประชุมวางแผน');
    type('x');

    edit();

    expect(await screen.findByText('กรุณาระบุเหตุผล')).toBeInTheDocument();
    expect(screen.getByTestId('ui-mrr-010-ent-010-reason')).toHaveAttribute('aria-invalid', 'true');
  });

  it('an empty title is refused at the field in the api\'s words, nothing sent', async () => {
    open();
    await loaded();
    retitle('   ');
    type('ผู้จองพิมพ์หัวข้อผิด');

    edit();

    expect(await screen.findByText('กรุณาระบุหัวข้อการประชุม')).toBeInTheDocument();
    expect(posts()).toEqual([]);
  });

  it('error state — nothing differs: the api\'s words, what was typed kept', async () => {
    editReply = { status: 400, body: { message: 'ไม่มีค่าที่ขอแก้ไข', field: 'changes' } };
    open();
    await loaded();
    type('ผู้จองพิมพ์หัวข้อผิด');

    edit();

    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่มีค่าที่ขอแก้ไข');
    expect(screen.getByTestId('ui-mrr-010-ent-010-reason')).toHaveValue('ผู้จองพิมพ์หัวข้อผิด');
  });

  it('error state — a failure the api does not explain asks to press again, the title kept', async () => {
    editReply = { status: 500 };
    open();
    await loaded();
    retitle('ประชุมวางแผน');
    type('ผู้จองพิมพ์หัวข้อผิด');

    edit();

    expect(await screen.findByRole('alert')).toHaveTextContent('ส่งคำขอแก้ไขไม่สำเร็จ กรุณากดอีกครั้ง');
    expect(screen.getByTestId('ui-mrr-010-ent-007-title')).toHaveValue('ประชุมวางแผน');
  });

  it('unauthorized state — the api refuses someone who is not a Room Administrator, in its words', async () => {
    editReply = { status: 403, body: { message: 'เฉพาะผู้ดูแลห้องเท่านั้นที่แก้แทนผู้จองได้' } };
    open();
    await loaded();
    retitle('ประชุมวางแผน');
    type('ผู้จองพิมพ์หัวข้อผิด');

    edit();

    expect(await screen.findByRole('alert')).toHaveTextContent('เฉพาะผู้ดูแลห้องเท่านั้นที่แก้แทนผู้จองได้');
  });

  it('loading state — the button is disabled while saving, so one request is sent', async () => {
    let finish!: (r: Reply) => void;
    editReply = () => new Promise<Reply>((resolve) => (finish = resolve));
    open();
    await loaded();
    retitle('ประชุมวางแผน');
    type('ผู้จองพิมพ์หัวข้อผิด');

    edit();

    await waitFor(() => expect(screen.getByTestId('ui-mrr-010-edit-on-behalf')).toBeDisabled());
    edit();
    finish({ status: 200, body: { message: SENT } });
    expect(await screen.findByRole('status')).toHaveTextContent(SENT);
    expect(posts()).toHaveLength(1);
  });

  it('ACL-011 at 10:59 the meeting has not ended — no request is offered; the edit there is a direct one (FE-mrr-009)', async () => {
    vi.setSystemTime(new Date('2026-10-18T10:59:00+07:00'));
    open();

    expect(await loaded()).toHaveValue('ประชุมทีม');
    expect(screen.queryByText('การประชุมจบแล้ว — การแก้ไขจะเป็นคำขอให้ผู้ดูแลห้องคนอื่นอนุมัติ')).not.toBeInTheDocument();
  });

  it('ACL-011 before the meeting starts — the title is not open and nothing is edited for the booker', async () => {
    vi.setSystemTime(new Date('2026-10-18T09:59:00+07:00'));
    open();

    expect(await loaded()).toHaveTextContent('ประชุมทีม');
    expect(screen.queryByRole('textbox', { name: /หัวข้อ/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('ui-mrr-010-edit-on-behalf')).not.toBeInTheDocument();
  });

  it('ACL-011 a booking that did not hold its room (rejected) offers no request after the end', async () => {
    booking = { ...booking, status: 'REJECTED' };
    open();

    expect(await loaded()).toHaveTextContent('ประชุมทีม');
    expect(screen.queryByTestId('ui-mrr-010-edit-on-behalf')).not.toBeInTheDocument();
  });

  it('ACL-011 an approved booking whose meeting has ended offers the request too', async () => {
    booking = { ...booking, status: 'APPROVED' };
    open();

    expect(await loaded()).toHaveValue('ประชุมทีม');
    expect(screen.getByTestId('ui-mrr-010-edit-on-behalf')).toHaveTextContent('แก้แทนผู้จอง');
    expect(screen.queryByTestId('ui-mrr-010-change-decision')).not.toBeInTheDocument();
  });
});
