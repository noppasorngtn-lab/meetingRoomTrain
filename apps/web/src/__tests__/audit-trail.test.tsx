import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';

const BOOKING = '77777777-7777-7777-7777-777777777777';
const GET = `/bookings/${BOOKING}`;
const AUDIT = `/bookings/${BOOKING}/audit`;
const DECIDE = `/bookings/${BOOKING}/decision`;
const RA1 = { id: '22222222-2222-2222-2222-222222222222', fullName: 'RA1' };
const RA2 = { id: '33333333-3333-3333-3333-333333333333', fullName: 'RA2' };
const REFUSAL = 'เฉพาะผู้ดูแลห้องและผู้ดูแลระบบเท่านั้นที่ดูร่องรอยได้';

type Reply = { status: number; body?: unknown };
type Call = { method: string; url: string };

let replies: Record<string, Reply | (() => Reply | Promise<Reply>)>;
let calls: Call[];

/** ห้อง A 18/10 10:00–11:00 'ประชุมทีม' of U1 — far ahead, so a change of decision is still offered. */
const booking = (over: object = {}) => ({
  id: BOOKING, roomId: 'r1', roomName: 'ห้อง A', startAt: '2099-10-18T03:00:00.000Z', endAt: '2099-10-18T04:00:00.000Z',
  title: 'ประชุมทีม', status: 'APPROVED', bookedBy: { id: 'u1', fullName: 'U1' }, attendees: [], equipment: [], ...over,
});
const entry = (over: object = {}) => ({
  id: 'e1', actor: RA1, action: 'CANCEL_ON_BEHALF', reason: 'ห้องต้องใช้จัดงานด่วน', detail: null, at: '2026-10-18T03:30:00.000Z', ...over,
});

beforeEach(() => {
  calls = [];
  replies = {
    [GET]: { status: 200, body: booking() },
    [AUDIT]: { status: 200, body: [entry()] },
    // Who is signed in, as API-035 answers (FE-mrr-038): a Room Administrator, so the commands show.
    '/auth/me': { status: 200, body: { fullName: 'RA1', role: 'ROOM_ADMINISTRATOR' } },
  };
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
    <MemoryRouter initialEntries={[`/UI-mrr-010?booking=${BOOKING}`]}>
      <AppRoutes />
    </MemoryRouter>,
  );

const trail = () => screen.findByRole('region', { name: 'ร่องรอย' });
const rows = () =>
  screen.getAllByTestId('ui-mrr-010-ent-010-at').map((at, i) => [
    at.textContent,
    screen.getAllByTestId('ui-mrr-010-ent-010-actor')[i].textContent,
    screen.getAllByTestId('ui-mrr-010-ent-010-action')[i].textContent,
  ]);

describe('FE-mrr-012 a booking\'s trail on the admin page (UI-mrr-010)', () => {
  it('AC-mrr-056 · AC-mrr-057 shows RA1 · 18/10 10:30 · ยกเลิกแทนผู้จอง · ห้องต้องใช้จัดงานด่วน, read through API-016', async () => {
    open();

    const section = await trail();
    await within(section).findByTestId('ui-mrr-010-ent-010-at');
    expect(rows()).toEqual([['18/10 10:30', 'RA1', 'ยกเลิกแทนผู้จอง']]);
    expect(within(section).getByText('ห้องต้องใช้จัดงานด่วน')).toBeInTheDocument();
    expect(calls).toContainEqual({ method: 'GET', url: AUDIT });
  });

  it('AC-mrr-052 an approval reads อนุมัติ at 16/10 14:05, its empty reason as —', async () => {
    replies[AUDIT] = { status: 200, body: [entry({ action: 'APPROVE', reason: null, at: '2026-10-16T07:05:00.000Z' })] };
    open();

    await screen.findByTestId('ui-mrr-010-ent-010-action');
    expect(rows()).toEqual([['16/10 14:05', 'RA1', 'อนุมัติ']]);
    expect(within(await trail()).getByText('—')).toBeInTheDocument();
  });

  it('each action reads in the words of the button that does it', async () => {
    const actions = ['APPROVE', 'REJECT', 'CHANGE_DECISION', 'EDIT_ON_BEHALF', 'CANCEL_ON_BEHALF', 'CREATE_ADJUSTMENT', 'APPROVE_ADJUSTMENT', 'REJECT_ADJUSTMENT'];
    replies[AUDIT] = { status: 200, body: actions.map((action, i) => entry({ id: `e${i}`, action, at: `2026-10-18T0${i}:00:00.000Z` })) };
    open();

    await screen.findAllByTestId('ui-mrr-010-ent-010-action');
    // The latest first.
    expect(screen.getAllByTestId('ui-mrr-010-ent-010-action').map((a) => a.textContent)).toEqual([
      'ปฏิเสธคำขอ', 'อนุมัติคำขอ', 'สร้างคำขอแก้ไข', 'ยกเลิกแทนผู้จอง', 'แก้แทนผู้จอง', 'เปลี่ยนผลการอนุมัติ', 'ปฏิเสธ', 'อนุมัติ',
    ]);
  });

  it('AC-mrr-054 · AC-mrr-055 empty state — nothing done by an administrator: ยังไม่มีการกระทำของผู้ดูแล', async () => {
    replies[AUDIT] = { status: 200, body: [] };
    open();

    expect(await within(await trail()).findByText('ยังไม่มีการกระทำของผู้ดูแล')).toBeInTheDocument();
    expect(screen.queryByTestId('ui-mrr-010-ent-010-action')).not.toBeInTheDocument();
  });

  it('AC-mrr-058 U1, the booker, sees the booking but not its trail: เฉพาะผู้ดูแลห้องและผู้ดูแลระบบเท่านั้นที่ดูร่องรอยได้', async () => {
    replies[AUDIT] = { status: 403, body: { message: REFUSAL } };
    open();

    expect(await within(await trail()).findByRole('alert')).toHaveTextContent(REFUSAL);
    expect(screen.getByTestId('ui-mrr-010-ent-007-title')).toHaveTextContent('ประชุมทีม');
    expect(screen.queryByTestId('ui-mrr-010-ent-010-actor')).not.toBeInTheDocument();
  });

  it('AC-mrr-059 U2, an attendee, may not see the booking either — ไม่พบการจอง, and the trail\'s refusal in the api\'s words', async () => {
    replies[GET] = { status: 404, body: { message: 'ไม่พบการจอง' } };
    replies[AUDIT] = { status: 403, body: { message: REFUSAL } };
    open();

    expect(await screen.findByText(REFUSAL)).toBeInTheDocument();
    expect(screen.getByText('ไม่พบการจอง')).toBeInTheDocument();
    expect(screen.queryByTestId('ui-mrr-010-ent-010-actor')).not.toBeInTheDocument();
  });

  it('a booking that is not found says so once, not again in the trail', async () => {
    replies[GET] = { status: 404, body: { message: 'ไม่พบการจอง' } };
    replies[AUDIT] = { status: 404, body: { message: 'ไม่พบการจอง' } };
    open();

    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่พบการจอง');
    await waitFor(() => expect(calls).toContainEqual({ method: 'GET', url: AUDIT }));
    expect(screen.getAllByText('ไม่พบการจอง')).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'ร่องรอย' })).not.toBeInTheDocument();
  });

  it('a change of decision writes an entry, so the trail is read again and shows it', async () => {
    replies[AUDIT] = { status: 200, body: [] };
    replies[`POST ${DECIDE}`] = () => {
      replies[AUDIT] = { status: 200, body: [entry({ actor: RA2, action: 'CHANGE_DECISION', reason: 'อนุมัติผิดห้อง' })] };
      return { status: 200, body: { message: 'เปลี่ยนผลการอนุมัติสำเร็จ' } };
    };
    open();
    await within(await trail()).findByText('ยังไม่มีการกระทำของผู้ดูแล');

    fireEvent.change(screen.getByTestId('ui-mrr-010-ent-010-reason'), { target: { value: 'อนุมัติผิดห้อง' } });
    fireEvent.click(screen.getByTestId('ui-mrr-010-change-decision'));

    expect(await screen.findByTestId('ui-mrr-010-ent-010-action')).toHaveTextContent('เปลี่ยนผลการอนุมัติ');
    expect(screen.getByTestId('ui-mrr-010-ent-010-actor')).toHaveTextContent('RA2');
    expect(calls.filter((c) => c.url === AUDIT)).toHaveLength(2);
  });

  it('loading state — กำลังโหลดร่องรอย… until the trail arrives', async () => {
    let answer!: (r: Reply) => void;
    replies[AUDIT] = () => new Promise<Reply>((resolve) => (answer = resolve));
    open();

    expect(await screen.findByText('กำลังโหลดร่องรอย…')).toBeInTheDocument();
    answer({ status: 200, body: [entry()] });
    await screen.findByTestId('ui-mrr-010-ent-010-actor');
    expect(screen.queryByText('กำลังโหลดร่องรอย…')).not.toBeInTheDocument();
  });

  it('error state — a failed read says so and โหลดใหม่ asks again, the rest of the page unaffected', async () => {
    replies[AUDIT] = { status: 500 };
    open();

    const alert = await within(await trail()).findByRole('alert');
    expect(alert).toHaveTextContent('โหลดร่องรอยไม่สำเร็จ');
    expect(screen.getByTestId('ui-mrr-010-ent-007-title')).toHaveTextContent('ประชุมทีม');
    replies[AUDIT] = { status: 200, body: [entry()] };
    fireEvent.click(within(alert).getByRole('button', { name: 'โหลดใหม่' }));

    expect(await screen.findByTestId('ui-mrr-010-ent-010-actor')).toHaveTextContent('RA1');
  });

  it('someone not signed in is taken to sign-in', async () => {
    replies[GET] = { status: 401, body: { message: 'Unauthorized' } };
    replies[AUDIT] = { status: 401, body: { message: 'Unauthorized' } };
    open();

    expect(await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
  });

  it('overflow state — more than 50 entries page, the latest first', async () => {
    const many = Array.from({ length: 51 }, (_, i) =>
      entry({ id: `e${i}`, actor: { id: `a${i}`, fullName: `RA${i}` }, at: new Date(Date.UTC(2026, 9, 18, 0, i)).toISOString() }));
    replies[AUDIT] = { status: 200, body: many };
    open();

    await screen.findAllByTestId('ui-mrr-010-ent-010-actor');
    const actors = () => screen.getAllByTestId('ui-mrr-010-ent-010-actor').map((a) => a.textContent);
    expect(actors()).toHaveLength(50);
    expect(actors()[0]).toBe('RA50');
    expect(screen.getByText('หน้า 1 จาก 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'หน้าถัดไป' }));

    expect(actors()).toEqual(['RA0']);
    // Paging the trail keeps the booking on the page.
    expect(screen.getByTestId('ui-mrr-010-ent-007-title')).toHaveTextContent('ประชุมทีม');
  });

  it('overflow state — a long reason folds behind its opening words and opens on a press', async () => {
    const long = 'ห้องต้องใช้จัดงานด่วนของผู้บริหารที่แจ้งเข้ามาเมื่อเช้า ทุกการจองช่วงนี้จึงถูกยกเลิกแทนผู้จองและแจ้งทุกคนแล้ว';
    replies[AUDIT] = { status: 200, body: [entry({ reason: long })] };
    open();

    const summary = await screen.findByText(`${long.slice(0, 60)}…`);
    const details = summary.closest('details')!;
    expect(details).not.toHaveAttribute('open');
    fireEvent.click(summary);
    expect(details).toHaveAttribute('open');
  });
});
