import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';

const ROOM = '11111111-1111-1111-1111-111111111111';

type Reply = { status: number; body?: unknown };
let replies: Reply[];
let calls: string[];

beforeEach(() => {
  replies = [];
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url);
    const r = replies.shift() ?? { status: 500 };
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const calendar = (slots: unknown[], view = 'day') => ({
  status: 200,
  body: { roomId: ROOM, view, from: '2026-10-16T17:00:00.000Z', to: '2026-10-17T17:00:00.000Z', slots },
});
const mine = {
  startAt: '2026-10-17T03:00:00.000Z', endAt: '2026-10-17T04:00:00.000Z', busy: true,
  details: { bookedBy: 'U1', title: 'ประชุมทีม', attendees: ['U2', 'U3'] },
};
const other = { startAt: '2026-10-17T06:00:00.000Z', endAt: '2026-10-17T07:00:00.000Z', busy: true };

const open = (query = `room=${ROOM}&date=2026-10-17&view=day`) =>
  render(
    <MemoryRouter initialEntries={[`/UI-mrr-005?${query}`]}>
      <AppRoutes />
    </MemoryRouter>,
  );

describe('FE-mrr-002 room calendar page', () => {
  it('AC-mrr-066 shows my booking with its booker, title and attendees, and asks the API for that room and day', async () => {
    replies.push(calendar([mine]));
    open();

    const slot = await screen.findByTestId('ui-mrr-005-ent-007-title');
    expect(slot).toHaveTextContent('ประชุมทีม');
    expect(screen.getByTestId('ui-mrr-005-ent-007-start-at')).toHaveTextContent('17/10 10:00–11:00');
    expect(screen.getByTestId('ui-mrr-005-ent-007-booked-by')).toHaveTextContent('U1');
    expect(screen.getByTestId('ui-mrr-005-ent-008-user')).toHaveTextContent('U2, U3');
    expect(calls).toEqual([`/rooms/${ROOM}/calendar?view=day&date=2026-10-17`]);
  });

  it('AC-mrr-068 someone else\'s booking shows only ไม่ว่าง', async () => {
    replies.push(calendar([other]));
    open();

    const title = await screen.findByTestId('ui-mrr-005-ent-007-title');
    expect(title).toHaveTextContent('ไม่ว่าง');
    const slot = title.closest('.slot') as HTMLElement;
    expect(within(slot).queryByTestId('ui-mrr-005-ent-007-booked-by')).not.toBeInTheDocument();
    expect(within(slot).queryByTestId('ui-mrr-005-ent-008-user')).not.toBeInTheDocument();
  });

  it('loading: says so while the API has not answered', async () => {
    replies.push(calendar([]));
    open();

    expect(screen.getByRole('status')).toHaveTextContent('กำลังโหลดปฏิทิน');
    await screen.findByText('ช่วงนี้ยังไม่มีการจอง เลือกช่วงเวลาเพื่อจองได้');
  });

  it('empty: a period with no booking says it is free to book', async () => {
    replies.push(calendar([]));
    open();

    expect(await screen.findByText('ช่วงนี้ยังไม่มีการจอง เลือกช่วงเวลาเพื่อจองได้')).toBeInTheDocument();
  });

  it('error: a failed load says so and loads again on request', async () => {
    replies.push({ status: 500 }, calendar([mine]));
    open();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('โหลดปฏิทินไม่สำเร็จ');
    within(alert).getByRole('button', { name: 'โหลดใหม่' }).click();

    expect(await screen.findByTestId('ui-mrr-005-ent-007-title')).toHaveTextContent('ประชุมทีม');
    expect(calls).toHaveLength(2);
  });

  it('not found: a room that does not exist says ไม่พบห้อง', async () => {
    replies.push({ status: 404, body: { message: 'ไม่พบห้อง' } });
    open();

    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่พบห้อง');
  });

  it('unauthorized: nobody signed in is taken to the sign-in page', async () => {
    replies.push({ status: 401 });
    open();

    expect(await screen.findByRole('heading', { level: 1, name: 'ขอรหัสเข้าสู่ระบบ' })).toBeInTheDocument();
  });

  it('switch-view: choosing รายเดือน and pressing เปลี่ยนมุมมอง asks the API for the month', async () => {
    replies.push(calendar([]), calendar([], 'month'));
    open();
    await screen.findByText('ช่วงนี้ยังไม่มีการจอง เลือกช่วงเวลาเพื่อจองได้');

    const select = screen.getByTestId('ui-mrr-005-calendar-view') as HTMLSelectElement;
    expect(select).toHaveValue('day');
    fireEvent.change(select, { target: { value: 'month' } });
    fireEvent.click(screen.getByTestId('ui-mrr-005-switch-view'));

    await waitFor(() => expect(calls).toEqual([
      `/rooms/${ROOM}/calendar?view=day&date=2026-10-17`,
      `/rooms/${ROOM}/calendar?view=month&date=2026-10-17`,
    ]));
  });

  it('book-slot: opens the booking form for this room and day', async () => {
    replies.push(calendar([]));
    open();
    await screen.findByText('ช่วงนี้ยังไม่มีการจอง เลือกช่วงเวลาเพื่อจองได้');

    fireEvent.click(screen.getByTestId('ui-mrr-005-book-slot'));

    expect(await screen.findByRole('heading', { level: 1, name: 'จองห้องประชุม' })).toBeInTheDocument();
  });

  it('overflow: a month-view day with five bookings shows three and +2, which opens the rest', async () => {
    const hour = (h: number) => ({
      startAt: `2026-10-17T0${h}:00:00.000Z`, endAt: `2026-10-17T0${h}:30:00.000Z`, busy: true as const,
    });
    replies.push(calendar([hour(1), hour(2), hour(3), hour(4), hour(5)], 'month'));
    open(`room=${ROOM}&date=2026-10-17&view=month`);

    const more = await screen.findByRole('button', { name: 'ดูอีก 2 รายการ' });
    expect(more).toHaveTextContent('+2');
    expect(screen.getAllByTestId('ui-mrr-005-ent-007-start-at')).toHaveLength(3);

    fireEvent.click(more);

    expect(screen.getAllByTestId('ui-mrr-005-ent-007-start-at')).toHaveLength(5);
  });

  it('a week or day view never folds a day away', async () => {
    const hour = (h: number) => ({
      startAt: `2026-10-17T0${h}:00:00.000Z`, endAt: `2026-10-17T0${h}:30:00.000Z`, busy: true as const,
    });
    replies.push(calendar([hour(1), hour(2), hour(3), hour(4), hour(5)], 'week'));
    open(`room=${ROOM}&date=2026-10-17&view=week`);

    await waitFor(() => expect(screen.getAllByTestId('ui-mrr-005-ent-007-start-at')).toHaveLength(5));
    expect(screen.queryByRole('button', { name: /ดูอีก/ })).not.toBeInTheDocument();
  });
});
