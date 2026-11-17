import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from '../App';

type Reply = { status: number; body?: unknown };

const FACILITIES = [
  { id: '22222222-2222-4222-8222-222222222222', name: 'โปรเจกเตอร์' },
  { id: '33333333-3333-4333-8333-333333333333', name: 'ไวต์บอร์ด' },
];
const ROOM_A = { id: '11111111-1111-4111-8111-111111111111', name: 'ห้อง A', capacity: 10, requiresApproval: false };

let search: Reply[];
let facilities: Reply;
let calls: string[];

beforeEach(() => {
  search = [];
  facilities = { status: 200, body: FACILITIES };
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url);
    const r = url.startsWith('/facilities') ? facilities : (search.shift() ?? { status: 500 });
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const Here = () => {
  const l = useLocation();
  return <span data-testid="here">{l.pathname}{l.search}</span>;
};

const open = () =>
  render(
    <MemoryRouter initialEntries={['/UI-mrr-004']}>
      <AppRoutes />
      <Here />
    </MemoryRouter>,
  );

const type = (testid: string, value: string) => fireEvent.change(screen.getByTestId(testid), { target: { value } });
const fill = (v: { date?: string; start?: string; end?: string; attendees?: string } = {}) => {
  type('ui-mrr-004-search-date', v.date ?? '2099-10-18');
  type('ui-mrr-004-search-start-time', v.start ?? '13:00');
  type('ui-mrr-004-search-end-time', v.end ?? '14:00');
  type('ui-mrr-004-attendee-count', v.attendees ?? '6');
};
const searchCalls = () => calls.filter((c) => c.startsWith('/rooms/available'));
const press = () => fireEvent.click(screen.getByTestId('ui-mrr-004-search'));

describe('FE-mrr-042 free room search page', () => {
  it('AC-mrr-106 asks the API for the day, times and attendees, and lists the room with its name, capacity and a way to book', async () => {
    search.push({ status: 200, body: [ROOM_A] });
    open();
    fill();
    press();

    expect(await screen.findByTestId('ui-mrr-004-ent-003-name')).toHaveTextContent('ห้อง A');
    expect(screen.getByTestId('ui-mrr-004-ent-003-capacity')).toHaveTextContent('10 คน');
    expect(screen.getByTestId('ui-mrr-004-ent-003-requires-approval')).toHaveTextContent('ไม่ต้องอนุมัติ');
    expect(screen.getByTestId('ui-mrr-004-book')).toHaveTextContent('ไปหน้าจอง');
    expect(searchCalls()).toEqual(['/rooms/available?date=2099-10-18&start=13:00&end=14:00&attendees=6']);
  });

  it('says a room needs approval when it does', async () => {
    search.push({ status: 200, body: [{ ...ROOM_A, requiresApproval: true }] });
    open();
    fill();
    press();

    expect(await screen.findByTestId('ui-mrr-004-ent-003-requires-approval')).toHaveTextContent('ต้องอนุมัติ');
    expect(screen.getByTestId('ui-mrr-004-ent-003-requires-approval')).not.toHaveTextContent('ไม่ต้องอนุมัติ');
  });

  it('AC-mrr-107 with no room, says ไม่พบห้องว่าง and what to change', async () => {
    search.push({ status: 200, body: [] });
    open();
    fill();
    press();

    expect(await screen.findByText('ไม่พบห้องว่าง')).toBeInTheDocument();
    expect(screen.getByText('ลองเปลี่ยนเวลา จำนวนคน หรือตัวกรอง')).toBeInTheDocument();
    expect(screen.queryByTestId('ui-mrr-004-book')).not.toBeInTheDocument();
  });

  it('sends the facilities that were ticked, offered from the active ones (API-002)', async () => {
    search.push({ status: 200, body: [ROOM_A] });
    open();
    const group = await screen.findByTestId('ui-mrr-004-ent-004-name');
    expect(calls).toContain('/facilities?active=true');
    fireEvent.click(within(group).getByLabelText('โปรเจกเตอร์'));
    fireEvent.click(within(group).getByLabelText('ไวต์บอร์ด'));
    fill();
    press();

    await screen.findByTestId('ui-mrr-004-ent-003-name');
    expect(searchCalls()).toEqual([`/rooms/available?date=2099-10-18&start=13:00&end=14:00&attendees=6&facilities=${FACILITIES[0].id},${FACILITIES[1].id}`]);
  });

  it('shows a searching indicator in place of the list while the answer is on its way, and the form stays editable', async () => {
    let release!: (r: Response) => void;
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) =>
      url.startsWith('/facilities')
        ? Promise.resolve(new Response(JSON.stringify(FACILITIES), { status: 200 }))
        : new Promise<Response>((res) => { release = res; }),
    );
    open();
    fill();
    press();

    expect(await screen.findByRole('status')).toHaveTextContent('กำลังค้นหาห้องว่าง');
    expect(screen.getByTestId('ui-mrr-004-search-date')).not.toBeDisabled();
    release(new Response(JSON.stringify([ROOM_A]), { status: 200 }));
    await screen.findByTestId('ui-mrr-004-ent-003-name');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('on a failed search tells the person and lets the same search button try again', async () => {
    search.push({ status: 500 }, { status: 200, body: [ROOM_A] });
    open();
    fill();
    press();

    expect(await screen.findByRole('alert')).toHaveTextContent('ค้นหาไม่สำเร็จ');
    press();
    await screen.findByTestId('ui-mrr-004-ent-003-name');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(searchCalls()).toHaveLength(2);
  });

  it('sends a person who is not signed in to the sign-in page', async () => {
    search.push({ status: 401 });
    open();
    fill();
    press();

    await waitFor(() => expect(screen.getByTestId('here')).toHaveTextContent('/UI-mrr-001'));
  });

  describe('the form is checked before anything is asked of the API', () => {
    it('says the end must be after the start, and does not search', async () => {
      open();
      fill({ start: '14:00', end: '14:00' });
      press();

      expect(await screen.findByText('เวลาสิ้นสุดต้องหลังเวลาเริ่ม')).toBeInTheDocument();
      expect(searchCalls()).toEqual([]);
    });

    it.each([
      ['a date before today', { date: '2020-01-01' }, 'วันที่ต้องเป็นวันนี้หรืออนาคต'],
      ['no date', { date: '' }, 'วันที่ต้องเป็นวันนี้หรืออนาคต'],
      ['no start time', { start: '' }, 'กรุณาระบุเวลาเริ่ม'],
      ['no end time', { end: '' }, 'กรุณาระบุเวลาสิ้นสุด'],
      ['zero attendees', { attendees: '0' }, 'จำนวนผู้เข้าร่วมต้องเป็นจำนวนเต็มตั้งแต่ 1'],
      ['attendees that is not a whole number', { attendees: '2.5' }, 'จำนวนผู้เข้าร่วมต้องเป็นจำนวนเต็มตั้งแต่ 1'],
      ['no attendees', { attendees: '' }, 'จำนวนผู้เข้าร่วมต้องเป็นจำนวนเต็มตั้งแต่ 1'],
    ])('refuses %s', async (_what, v, message) => {
      open();
      // A future date keeps every other example about the one field it names.
      fill({ date: '2099-01-01', ...v });
      press();

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(searchCalls()).toEqual([]);
    });
  });

  describe('going on from a room', () => {
    it('book carries the room, day and times to the booking form', async () => {
      search.push({ status: 200, body: [ROOM_A] });
      open();
      fill();
      press();
      await screen.findByTestId('ui-mrr-004-book');

      fireEvent.click(screen.getByTestId('ui-mrr-004-book'));

      const here = screen.getByTestId('here').textContent!;
      expect(here.startsWith('/UI-mrr-006?')).toBe(true);
      const q = new URLSearchParams(here.split('?')[1]);
      expect(Object.fromEntries(q)).toEqual({ room: ROOM_A.id, date: '2099-10-18', start: '13:00', end: '14:00' });
    });

    it('view-calendar opens that room\'s calendar on the searched day', async () => {
      search.push({ status: 200, body: [ROOM_A] });
      open();
      fill();
      press();
      await screen.findByTestId('ui-mrr-004-view-calendar');

      fireEvent.click(screen.getByTestId('ui-mrr-004-view-calendar'));

      const here = screen.getByTestId('here').textContent!;
      expect(here.startsWith('/UI-mrr-005?')).toBe(true);
      expect(Object.fromEntries(new URLSearchParams(here.split('?')[1]))).toEqual({ room: ROOM_A.id, date: '2099-10-18' });
    });

    it('the row prints data-row-key (the room\'s name) and the actions act on their own row', async () => {
      const b = { ...ROOM_A, id: '44444444-4444-4444-8444-444444444444', name: 'ห้อง B' };
      search.push({ status: 200, body: [ROOM_A, b] });
      open();
      fill();
      press();
      await screen.findAllByTestId('ui-mrr-004-book');

      const row = screen.getByText('ห้อง B').closest('tr') as HTMLElement;
      expect(row).toHaveAttribute('data-row-key', 'ห้อง B');
      fireEvent.click(within(row).getByTestId('ui-mrr-004-book'));

      expect(new URLSearchParams(screen.getByTestId('here').textContent!.split('?')[1]).get('room')).toBe(b.id);
    });
  });

  describe('overflow — more than 20 rooms', () => {
    const rooms = Array.from({ length: 23 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      name: `ห้อง ${String(i + 1).padStart(2, '0')}`,
      capacity: 8,
      requiresApproval: false,
    }));

    it('shows 20 to a page and the rest on the next', async () => {
      search.push({ status: 200, body: rooms });
      open();
      fill();
      press();

      await screen.findAllByTestId('ui-mrr-004-ent-003-name');
      expect(screen.getAllByTestId('ui-mrr-004-ent-003-name')).toHaveLength(20);
      fireEvent.click(screen.getByRole('button', { name: 'หน้าถัดไป' }));
      expect(screen.getAllByTestId('ui-mrr-004-ent-003-name')).toHaveLength(3);
      expect(screen.getByText('ห้อง 23')).toBeInTheDocument();
    });

    it('draws no pager for 20 rooms or fewer', async () => {
      search.push({ status: 200, body: rooms.slice(0, 20) });
      open();
      fill();
      press();

      await screen.findAllByTestId('ui-mrr-004-ent-003-name');
      expect(screen.queryByRole('navigation', { name: 'แบ่งหน้า' })).not.toBeInTheDocument();
    });

    it('cuts a long name short with … and gives the whole name on hover', async () => {
      const long = 'ห้องประชุมใหญ่ชั้น 12 อาคารสำนักงานใหญ่ฝั่งตะวันออก (ห้องรับรองผู้บริหาร)';
      search.push({ status: 200, body: [{ ...ROOM_A, name: long }] });
      open();
      fill();
      press();

      const cell = await screen.findByTestId('ui-mrr-004-ent-003-name');
      expect(cell).toHaveAttribute('title', long);
      expect(cell).toHaveClass('clip');
    });
  });
});
