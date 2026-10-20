import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';

const BOOKING = '55555555-5555-5555-5555-555555555555';
const U2 = { id: '22222222-2222-2222-2222-222222222222', fullName: 'U2' };
const U3 = { id: '33333333-3333-3333-3333-333333333333', fullName: 'U3', email: 'u3@example.test' };
const MIC = { id: '44444444-4444-4444-4444-444444444444', name: 'ไมโครโฟน' };
const OLD_BOARD = { id: '66666666-6666-6666-6666-666666666666', name: 'กระดานเก่า' };

type Reply = { status: number; body?: unknown };
type Call = { method: string; url: string; body?: unknown };

let booking: Reply;
let saveReply: Reply;
let calls: Call[];

/** Far enough ahead that "before the start" holds whatever day the test runs. */
const FUTURE = { startAt: '2099-10-17T03:00:00.000Z', endAt: '2099-10-17T04:00:00.000Z' };

const mine = (over: object = {}) => ({
  status: 200,
  body: {
    id: BOOKING, roomId: 'r1', roomName: 'ห้อง A', ...FUTURE, title: 'ประชุมทีม', status: 'CONFIRMED',
    bookedBy: { id: 'u1', fullName: 'U1' }, attendees: [U2], equipment: [], ...over,
  },
});

beforeEach(() => {
  booking = mine();
  saveReply = { status: 200, body: { message: 'บันทึกการแก้ไขสำเร็จ' } };
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r: Reply =
      url === `/bookings/${BOOKING}` && method === 'GET' ? booking
      : url === `/bookings/${BOOKING}` && method === 'PATCH' ? saveReply
      : url === '/facilities?active=true' ? { status: 200, body: [MIC] }
      : url.startsWith('/users?query=') ? { status: 200, body: [U3] }
      : { status: 500 };
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const open = () =>
  render(
    <MemoryRouter initialEntries={[`/UI-mrr-008?booking=${BOOKING}`]}>
      <AppRoutes />
    </MemoryRouter>,
  );

const loaded = () => waitFor(() => expect(screen.getByTestId('ui-mrr-008-ent-007-title')).toHaveValue('ประชุมทีม'));
const type = (testid: string, value: string) => fireEvent.change(screen.getByTestId(testid), { target: { value } });
const save = () => fireEvent.click(screen.getByTestId('ui-mrr-008-save'));
const patched = () => calls.filter((c) => c.method === 'PATCH');

describe('FE-mrr-004 edit booking page (UI-mrr-008)', () => {
  it('opens with the booking as it is — times in Bangkok, attendees, status', async () => {
    open();
    await loaded();

    expect(screen.getByTestId('ui-mrr-008-ent-007-start-at')).toHaveValue('2099-10-17T10:00');
    expect(screen.getByTestId('ui-mrr-008-ent-007-end-at')).toHaveValue('2099-10-17T11:00');
    expect(screen.getByRole('list', { name: 'ผู้เข้าร่วมที่เลือก' })).toHaveTextContent('U2');
    expect(screen.getByTestId('ui-mrr-008-ent-007-status')).toHaveTextContent('จองสำเร็จ (ห้องไม่ต้องอนุมัติ)');
    expect(calls[0]).toEqual({ method: 'GET', url: `/bookings/${BOOKING}`, body: undefined });
  });

  it('AC-mrr-008 saves a new title and shows บันทึกการแก้ไขสำเร็จ on my bookings', async () => {
    open();
    await loaded();
    type('ui-mrr-008-ent-007-title', 'ประชุมวางแผน');

    save();

    expect(await screen.findByRole('heading', { level: 1, name: 'การจองของฉัน' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('บันทึกการแก้ไขสำเร็จ');
    expect(patched()).toEqual([{
      method: 'PATCH',
      url: `/bookings/${BOOKING}`,
      body: {
        startAt: '2099-10-17T10:00:00+07:00', endAt: '2099-10-17T11:00:00+07:00',
        title: 'ประชุมวางแผน', attendeeIds: [U2.id],
      },
    }]);
  });

  it('AC-mrr-021 sends the new time as Bangkok time', async () => {
    open();
    await loaded();
    type('ui-mrr-008-ent-007-start-at', '2099-10-17T14:00');
    type('ui-mrr-008-ent-007-end-at', '2099-10-17T15:00');

    save();

    await waitFor(() => expect(patched()).toHaveLength(1));
    expect(patched()[0].body).toMatchObject({ startAt: '2099-10-17T14:00:00+07:00', endAt: '2099-10-17T15:00:00+07:00' });
  });

  it('changes attendees and equipment, sending equipment only once it changed', async () => {
    open();
    await loaded();
    type('ui-mrr-008-ent-008-user', 'U3');
    fireEvent.click(await screen.findByRole('button', { name: /^U3 / }));
    fireEvent.click(screen.getByRole('button', { name: 'เอา U2 ออก' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'ไมโครโฟน' }));

    save();

    await waitFor(() => expect(patched()).toHaveLength(1));
    expect(patched()[0].body).toMatchObject({ attendeeIds: [U3.id], equipmentIds: [MIC.id] });
  });

  it('equipment no longer offered stays ticked, and is left alone when not touched', async () => {
    booking = mine({ equipment: [OLD_BOARD] });
    open();
    await loaded();

    expect(screen.getByRole('checkbox', { name: 'กระดานเก่า' })).toBeChecked();
    save();

    await waitFor(() => expect(patched()).toHaveLength(1));
    expect(patched()[0].body).not.toHaveProperty('equipmentIds');
  });

  it.each([
    ['AC-mrr-061 the mail not going out', 503, 'ส่ง Email แจ้งเตือนไม่สำเร็จ กรุณากดใหม่อีกครั้ง'],
    ['AC-mrr-080 the room closed for maintenance', 409, 'ห้องนี้ปิดปรับปรุง ไม่สามารถจองได้'],
    ['a new time that is taken', 409, 'ห้องนี้ไม่ว่างในช่วงเวลาที่เลือก กรุณาเลือกเวลาอื่น'],
  ])('error: %s shows the reason and keeps the form', async (_what, status, message) => {
    saveReply = { status, body: { statusCode: status, message } };
    open();
    await loaded();
    type('ui-mrr-008-ent-007-start-at', '2099-10-17T14:00');
    type('ui-mrr-008-ent-007-end-at', '2099-10-17T15:00');

    save();

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByTestId('ui-mrr-008-ent-007-start-at')).toHaveValue('2099-10-17T14:00');
    expect(screen.getByTestId('ui-mrr-008-save')).toBeEnabled();
  });

  it('overflow: a title over 200 characters is refused, and nothing is sent', async () => {
    open();
    await loaded();
    type('ui-mrr-008-ent-007-title', 'ก'.repeat(201));

    save();

    expect(await screen.findByText('หัวข้อการประชุมต้องไม่เกิน 200 ตัวอักษร')).toBeInTheDocument();
    expect(patched()).toEqual([]);
  });

  it('the BR-mrr-002 checks hold here too — no empty title, no empty attendee list', async () => {
    open();
    await loaded();
    type('ui-mrr-008-ent-007-title', '');
    fireEvent.click(screen.getByRole('button', { name: 'เอา U2 ออก' }));

    save();

    expect(await screen.findByText('กรุณาระบุหัวข้อการประชุม')).toBeInTheDocument();
    expect(screen.getByText('กรุณาระบุผู้เข้าร่วมอย่างน้อย 1 คน')).toBeInTheDocument();
    expect(patched()).toEqual([]);
  });

  it.each([
    ['someone who is not the booker (the api answers 404)', { status: 404, body: { message: 'ไม่พบการจอง' } }],
    ['a booking already started', mine({ startAt: '2020-01-01T03:00:00.000Z', endAt: '2020-01-01T04:00:00.000Z' })],
    ['a cancelled booking', mine({ status: 'CANCELLED' })],
  ])('unauthorized: %s shows แก้ไขการจองนี้ไม่ได้ and no form', async (_what, reply) => {
    booking = reply;
    open();

    expect(await screen.findByRole('alert')).toHaveTextContent('แก้ไขการจองนี้ไม่ได้');
    expect(screen.queryByTestId('ui-mrr-008-save')).not.toBeInTheDocument();
    expect(screen.getByTestId('ui-mrr-008-back')).toBeInTheDocument();
  });

  it('unauthorized: a save the api refuses as not the booker hides the form', async () => {
    saveReply = { status: 403, body: { message: 'แก้ไขได้เฉพาะการจองที่คุณเป็นผู้จอง' } };
    open();
    await loaded();

    save();

    expect(await screen.findByRole('alert')).toHaveTextContent('แก้ไขการจองนี้ไม่ได้');
    expect(screen.queryByTestId('ui-mrr-008-save')).not.toBeInTheDocument();
  });

  it('loading: save is disabled while the edit is saved and the mail sent', async () => {
    let answer!: (r: Response) => void;
    open();
    await loaded();
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((r) => { answer = r; }));

    save();

    await waitFor(() => expect(screen.getByTestId('ui-mrr-008-save')).toBeDisabled());
    answer(new Response(JSON.stringify({ message: 'บันทึกการแก้ไขสำเร็จ' }), { status: 200 }));
    expect(await screen.findByRole('heading', { level: 1, name: 'การจองของฉัน' })).toBeInTheDocument();
  });

  it('nobody signed in is taken to the sign-in page', async () => {
    booking = { status: 401 };
    open();

    expect(await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
  });

  it('back: returns to my bookings without saving', async () => {
    open();
    await loaded();

    fireEvent.click(screen.getByTestId('ui-mrr-008-back'));

    expect(await screen.findByRole('heading', { level: 1, name: 'การจองของฉัน' })).toBeInTheDocument();
    expect(patched()).toEqual([]);
  });
});
