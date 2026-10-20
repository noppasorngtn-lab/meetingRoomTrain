import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';

const ROOM = '11111111-1111-1111-1111-111111111111';
const U2 = { id: '22222222-2222-2222-2222-222222222222', fullName: 'U2', email: 'u2@example.test' };
const U3 = { id: '33333333-3333-3333-3333-333333333333', fullName: 'U3', email: 'u3@example.test' };
const PROJECTOR = { id: '44444444-4444-4444-4444-444444444444', name: 'โปรเจคเตอร์' };

type Reply = { status: number; body?: unknown };
type Call = { method: string; url: string; body?: unknown };

let room: Reply;
let bookingReply: Reply;
let calls: Call[];

const roomA = (over: object = {}) => ({
  status: 200,
  body: { id: ROOM, name: 'ห้อง A', capacity: 10, requiresApproval: false, status: 'ACTIVE', ...over },
});

beforeEach(() => {
  room = roomA();
  bookingReply = { status: 201, body: { id: 'b1', status: 'CONFIRMED', message: 'จองห้องสำเร็จ' } };
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r: Reply =
      url === `/rooms/${ROOM}` ? room
      : url === '/facilities?active=true' ? { status: 200, body: [PROJECTOR] }
      : url.startsWith('/users?query=') ? { status: 200, body: [U2, U3] }
      : url === '/bookings' && method === 'POST' ? bookingReply
      : { status: 500 };
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const open = (query = `room=${ROOM}&date=2026-10-17&start=10:00&end=11:00`) =>
  render(
    <MemoryRouter initialEntries={[`/UI-mrr-006?${query}`]}>
      <AppRoutes />
    </MemoryRouter>,
  );

const loaded = () => waitFor(() => expect(screen.getByTestId('ui-mrr-006-ent-007-room')).toHaveTextContent('ห้อง A'));

const type = (testid: string, value: string) => fireEvent.change(screen.getByTestId(testid), { target: { value } });

async function addAttendee(name: string) {
  type('ui-mrr-006-ent-008-user', name);
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${name} `) }));
}

const confirm = () => fireEvent.click(screen.getByTestId('ui-mrr-006-confirm'));
const posted = () => calls.filter((c) => c.method === 'POST');

describe('FE-mrr-003 booking form (UI-mrr-006)', () => {
  it('empty: opens with the room and the chosen time, every other field blank', async () => {
    open();
    await loaded();

    expect(screen.getByTestId('ui-mrr-006-ent-007-start-at')).toHaveValue('2026-10-17T10:00');
    expect(screen.getByTestId('ui-mrr-006-ent-007-end-at')).toHaveValue('2026-10-17T11:00');
    expect(screen.getByTestId('ui-mrr-006-ent-007-title')).toHaveValue('');
    expect(within(screen.getByTestId('ui-mrr-006-ent-009-facility')).getByRole('checkbox', { name: 'โปรเจคเตอร์' })).not.toBeChecked();
  });

  it('AC-mrr-019 sends the booking as the api expects, then shows จองห้องสำเร็จ on my bookings', async () => {
    open();
    await loaded();
    type('ui-mrr-006-ent-007-title', 'ประชุมทีม');
    await addAttendee('U2');
    await addAttendee('U3');

    confirm();

    expect(await screen.findByRole('heading', { level: 1, name: 'การจองของฉัน' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('จองห้องสำเร็จ');
    expect(posted()).toEqual([{
      method: 'POST',
      url: '/bookings',
      body: {
        roomId: ROOM,
        startAt: '2026-10-17T10:00:00+07:00',
        endAt: '2026-10-17T11:00:00+07:00',
        title: 'ประชุมทีม',
        attendeeIds: [U2.id, U3.id],
        equipmentIds: [],
      },
    }]);
  });

  it('AC-mrr-005 equipment is optional, and what is ticked is sent', async () => {
    open();
    await loaded();
    type('ui-mrr-006-ent-007-title', 'ประชุมทีม');
    await addAttendee('U2');
    fireEvent.click(screen.getByRole('checkbox', { name: 'โปรเจคเตอร์' }));

    confirm();

    await waitFor(() => expect(posted()).toHaveLength(1));
    expect((posted()[0].body as { equipmentIds: string[] }).equipmentIds).toEqual([PROJECTOR.id]);
  });

  it('AC-mrr-012 a room that needs approval shows the api\'s ส่งคำขอจองแล้ว รอการอนุมัติ', async () => {
    room = roomA({ requiresApproval: true });
    bookingReply = { status: 201, body: { id: 'b2', status: 'PENDING_APPROVAL', message: 'ส่งคำขอจองแล้ว รอการอนุมัติ' } };
    open();
    await loaded();
    expect(screen.getByText('ห้องนี้ต้องรออนุมัติก่อนใช้งาน')).toBeInTheDocument();
    type('ui-mrr-006-ent-007-title', 'ประชุมลูกค้า');
    await addAttendee('U2');

    confirm();

    expect(await screen.findByRole('heading', { level: 1, name: 'การจองของฉัน' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('ส่งคำขอจองแล้ว รอการอนุมัติ');
  });

  it('AC-mrr-006 an empty title is refused on the form, and nothing is sent', async () => {
    open();
    await loaded();
    await addAttendee('U2');

    confirm();

    expect(await screen.findByText('กรุณาระบุหัวข้อการประชุม')).toBeInTheDocument();
    expect(screen.getByTestId('ui-mrr-006-ent-007-title')).toHaveAttribute('aria-invalid', 'true');
    expect(posted()).toEqual([]);
  });

  it('AC-mrr-007 no attendee is refused — the booker is not counted', async () => {
    open();
    await loaded();
    type('ui-mrr-006-ent-007-title', 'ประชุมทีม');

    confirm();

    expect(await screen.findByText('กรุณาระบุผู้เข้าร่วมอย่างน้อย 1 คน')).toBeInTheDocument();
    expect(posted()).toEqual([]);
  });

  it('overflow: a title over 200 characters is refused', async () => {
    open();
    await loaded();
    type('ui-mrr-006-ent-007-title', 'ก'.repeat(201));
    await addAttendee('U2');

    confirm();

    expect(await screen.findByText('หัวข้อการประชุมต้องไม่เกิน 200 ตัวอักษร')).toBeInTheDocument();
    expect(posted()).toEqual([]);
  });

  it('AC-mrr-032 overflow: more attendees than the room holds warns, and still books', async () => {
    room = roomA({ capacity: 1 });
    open();
    await loaded();
    type('ui-mrr-006-ent-007-title', 'ประชุมใหญ่');
    await addAttendee('U2');
    expect(screen.queryByText('ผู้เข้าร่วมเกินความจุห้อง')).not.toBeInTheDocument();
    await addAttendee('U3');

    expect(screen.getByText('ผู้เข้าร่วมเกินความจุห้อง')).toBeInTheDocument();
    confirm();

    await waitFor(() => expect(posted()).toHaveLength(1));
  });

  it.each([
    ['AC-mrr-002 a slot already taken', 409, 'ห้องนี้ไม่ว่างในช่วงเวลาที่เลือก กรุณาเลือกเวลาอื่น'],
    ['AC-mrr-079 a room closed after the form opened', 409, 'ห้องนี้ปิดปรับปรุง ไม่สามารถจองได้'],
    ['AC-mrr-060 the mail not going out', 503, 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง'],
  ])('error: %s shows the api\'s message and keeps what was typed', async (_what, status, message) => {
    bookingReply = { status, body: { statusCode: status, message } };
    open();
    await loaded();
    type('ui-mrr-006-ent-007-title', 'ประชุมทีม');
    await addAttendee('U2');

    confirm();

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByTestId('ui-mrr-006-ent-007-title')).toHaveValue('ประชุมทีม');
    expect(screen.getByRole('list', { name: 'ผู้เข้าร่วมที่เลือก' })).toHaveTextContent('U2');
    expect(screen.getByTestId('ui-mrr-006-confirm')).toBeEnabled();
  });

  it('error: a field the api refuses is marked on that field', async () => {
    bookingReply = { status: 400, body: { statusCode: 400, field: 'start', message: 'เวลาเริ่มต้องเป็นเวลาในอนาคต' } };
    open();
    await loaded();
    type('ui-mrr-006-ent-007-title', 'ประชุมทีม');
    await addAttendee('U2');

    confirm();

    expect(await screen.findByText('เวลาเริ่มต้องเป็นเวลาในอนาคต')).toBeInTheDocument();
    expect(screen.getByTestId('ui-mrr-006-ent-007-start-at')).toHaveAttribute('aria-invalid', 'true');
  });

  it('AC-mrr-079 a room under maintenance says so and cannot be confirmed', async () => {
    room = roomA({ status: 'UNDER_MAINTENANCE' });
    open();
    await loaded();

    expect(screen.getByRole('alert')).toHaveTextContent('ห้องนี้ปิดปรับปรุง ไม่สามารถจองได้');
    expect(screen.getByTestId('ui-mrr-006-confirm')).toBeDisabled();
  });

  it('loading: confirm is disabled while the booking is saved and the mail sent', async () => {
    let answer!: (r: Response) => void;
    open();
    await loaded();
    type('ui-mrr-006-ent-007-title', 'ประชุมทีม');
    await addAttendee('U2');
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((r) => { answer = r; }));

    confirm();

    await waitFor(() => expect(screen.getByTestId('ui-mrr-006-confirm')).toBeDisabled());
    answer(new Response(JSON.stringify({ id: 'b1', status: 'CONFIRMED', message: 'จองห้องสำเร็จ' }), { status: 201 }));
    expect(await screen.findByRole('heading', { level: 1, name: 'การจองของฉัน' })).toBeInTheDocument();
  });

  it('a room that does not exist says ไม่พบห้อง', async () => {
    room = { status: 404, body: { message: 'ไม่พบห้อง' } };
    open();

    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่พบห้อง');
    expect(screen.getByTestId('ui-mrr-006-confirm')).toBeDisabled();
  });

  it('unauthorized: nobody signed in is taken to the sign-in page', async () => {
    room = { status: 401 };
    open();

    expect(await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
  });

  it('cancel-form: closes the form without sending, back to the room search', async () => {
    open();
    await loaded();

    fireEvent.click(screen.getByTestId('ui-mrr-006-cancel-form'));

    expect(await screen.findByRole('heading', { level: 1, name: 'ค้นหาห้องว่าง' })).toBeInTheDocument();
    expect(posted()).toEqual([]);
  });

  it('an attendee already picked is not offered again, and can be taken off', async () => {
    open();
    await loaded();
    await addAttendee('U2');

    type('ui-mrr-006-ent-008-user', 'U');
    expect(await screen.findByRole('button', { name: /^U3 / })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^U2 / })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'เอา U2 ออก' }));

    expect(screen.queryByRole('list', { name: 'ผู้เข้าร่วมที่เลือก' })).not.toBeInTheDocument();
  });
});
