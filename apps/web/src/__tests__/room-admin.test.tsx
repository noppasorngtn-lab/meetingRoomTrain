import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';

const ROOM_A = '33333333-3333-4333-8333-333333333333';
const ROOM_B = '44444444-4444-4444-8444-444444444444';
const PROJECTOR = { id: 'f1', name: 'โปรเจคเตอร์' };
const MIC = { id: 'f2', name: 'ไมโครโฟน' };
const RA1 = { id: '22222222-2222-4222-8222-222222222222', fullName: 'RA1', email: 'ra1@example.test' };

const SAVED = 'บันทึกข้อมูลห้องสำเร็จ';
const REFUSAL = 'เฉพาะผู้ดูแลห้องเท่านั้นที่จัดการข้อมูลห้องได้';

type Reply = { status: number; body?: unknown };
type Call = { method: string; url: string; body?: unknown };

let replies: Record<string, Reply | (() => Reply | Promise<Reply>)>;
let calls: Call[];

const row = (over: object = {}) => ({
  id: ROOM_A, code: 'A', name: 'ห้อง A', capacity: 8, status: 'ACTIVE', requiresApproval: false, approver: null, versionNo: 1, ...over,
});
const detail = (over: object = {}) => ({ ...row(), photos: ['photo-1'], facilityIds: [PROJECTOR.id], ...over });
const pageOf = (items: object[], page = 1, total = items.length): Reply => ({ status: 200, body: { items, page, pageSize: 20, total } });

const LIST = '/rooms?page=1';
const FACILITIES = '/facilities?active=true';
const ME = '/auth/me';

beforeEach(() => {
  calls = [];
  replies = {
    [LIST]: pageOf([row()]),
    [FACILITIES]: { status: 200, body: [PROJECTOR, MIC] },
    // Who is signed in, as API-035 answers (FE-mrr-038): a Room Administrator unless a test says otherwise.
    [ME]: { status: 200, body: { fullName: 'RA1', role: 'ROOM_ADMINISTRATOR' } },
  };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, ...(init?.body ? { body: JSON.parse(init.body as string) } : {}) });
    const r = replies[`${method === 'GET' ? '' : `${method} `}${url}`] ?? { status: 500 };
    const reply = typeof r === 'function' ? await r() : r;
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const open = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );

const sent = () => calls.filter((c) => c.method !== 'GET');
const type = (testid: string, value: string) => fireEvent.change(screen.getByTestId(testid), { target: { value } });

describe('FE-mrr-013 rooms page (UI-mrr-012)', () => {
  it('lists the rooms from API-020 — code, name, capacity and STM-mrr-003\'s label', async () => {
    replies[LIST] = pageOf([row(), row({ id: ROOM_B, code: 'B', name: 'ห้อง B', capacity: 4, status: 'UNDER_MAINTENANCE' })]);
    open('/UI-mrr-012');

    const codes = await screen.findAllByTestId('ui-mrr-012-ent-002-code');
    expect(codes.map((c) => c.textContent)).toEqual(['A', 'B']);
    expect(screen.getAllByTestId('ui-mrr-012-ent-003-name').map((n) => n.textContent)).toEqual(['ห้อง A', 'ห้อง B']);
    expect(screen.getAllByTestId('ui-mrr-012-ent-003-capacity').map((n) => n.textContent)).toEqual(['8 คน', '4 คน']);
    expect(screen.getAllByTestId('ui-mrr-012-ent-002-status').map((s) => s.textContent)).toEqual(['เปิดใช้งาน', 'ปิดปรับปรุง']);
    expect(calls).toEqual([{ method: 'GET', url: LIST }]);
  });

  it('UIC-001 the row\'s actions sit in the first column, edit before command: แก้ไขห้อง · ปิดปรับปรุง (FE-mrr-014)', async () => {
    open('/UI-mrr-012');
    const first = (await screen.findAllByRole('row'))[1].querySelector('td')!;

    expect(within(first).getAllByRole('button').map((b) => b.textContent)).toEqual(['แก้ไขห้อง', 'ปิดปรับปรุง']);
  });

  it('overflow state — finds by name or code and shows archived rooms only through the filter', async () => {
    replies['/rooms?page=1&query=A'] = pageOf([row()]);
    replies['/rooms?page=1&query=A&status=ARCHIVED'] = pageOf([row({ status: 'ARCHIVED' })]);
    open('/UI-mrr-012');
    await screen.findAllByTestId('ui-mrr-012-ent-002-code');

    fireEvent.change(screen.getByLabelText('ค้นหาห้อง'), { target: { value: ' A ' } });
    fireEvent.click(screen.getByRole('button', { name: 'ค้นหา' }));
    await waitFor(() => expect(calls.at(-1)?.url).toBe('/rooms?page=1&query=A'));
    fireEvent.click(screen.getByLabelText('แสดงเฉพาะห้องที่ลบแล้ว'));

    expect(await screen.findByText('เลิกใช้งาน (ลบ)')).toBeInTheDocument();
    expect(calls.at(-1)?.url).toBe('/rooms?page=1&query=A&status=ARCHIVED');
    // An archived room is gone; it is not edited.
    expect(screen.queryByTestId('ui-mrr-012-edit-room')).not.toBeInTheDocument();
  });

  it('pages 20 at a time', async () => {
    replies[LIST] = pageOf([row()], 1, 21);
    replies['/rooms?page=2'] = pageOf([row({ id: ROOM_B, code: 'Z' })], 2, 21);
    open('/UI-mrr-012');

    fireEvent.click(await screen.findByRole('button', { name: 'หน้าถัดไป' }));

    expect(await screen.findByText('Z')).toBeInTheDocument();
    expect(screen.getByText('หน้า 2 จาก 2')).toBeInTheDocument();
  });

  it('empty state — ยังไม่มีห้องประชุม with เพิ่มห้อง', async () => {
    replies[LIST] = pageOf([]);
    open('/UI-mrr-012');

    expect(await screen.findByText('ยังไม่มีห้องประชุม')).toBeInTheDocument();
    expect(screen.getAllByTestId('ui-mrr-012-add-room')).toHaveLength(2);
  });

  it('loading and error states — the list is replaced while it loads, and a failed load says so', async () => {
    replies[LIST] = { status: 500 };
    open('/UI-mrr-012');

    expect(screen.getByText('กำลังโหลดรายการห้อง…')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('โหลดรายการห้องไม่สำเร็จ');
  });

  it.each([['a General User'], ['a System Administrator']])('unauthorized state — %s sees the api\'s refusal and no list', async () => {
    replies[LIST] = { status: 403, body: { message: REFUSAL } };
    open('/UI-mrr-012');

    expect(await screen.findByRole('alert')).toHaveTextContent(REFUSAL);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ui-mrr-012-add-room')).not.toBeInTheDocument();
  });

  it('เพิ่มห้อง opens an empty room form, สิ่งอำนวยความสะดวก opens UI-mrr-014', async () => {
    open('/UI-mrr-012');

    fireEvent.click(await screen.findByTestId('ui-mrr-012-add-room'));
    expect(await screen.findByRole('heading', { level: 1, name: 'ข้อมูลห้อง' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ui-mrr-013-back'));
    fireEvent.click(await screen.findByTestId('ui-mrr-012-facilities'));

    expect(await screen.findByRole('heading', { level: 1, name: 'สิ่งอำนวยความสะดวก' })).toBeInTheDocument();
  });
});

describe('FE-mrr-013 room form (UI-mrr-013)', () => {
  it('empty state — a new room: every field empty and approval off', async () => {
    open('/UI-mrr-013');

    expect(screen.getByTestId('ui-mrr-013-ent-002-code')).toHaveValue('');
    expect(screen.getByTestId('ui-mrr-013-ent-003-name')).toHaveValue('');
    expect(screen.getByTestId('ui-mrr-013-ent-003-capacity')).toHaveValue(null);
    expect(screen.getByTestId('ui-mrr-013-ent-003-requires-approval')).not.toBeChecked();
    expect(screen.getByTestId('ui-mrr-013-ent-003-approver')).toHaveValue('');
    expect(screen.getByTestId('ui-mrr-013-ent-003-version-no')).toHaveTextContent('ห้องใหม่');
    expect(await screen.findByLabelText('โปรเจคเตอร์')).not.toBeChecked();
  });

  it('AC-mrr-015 adds room C, capacity 10, through API-021 and says บันทึกข้อมูลห้องสำเร็จ on the rooms page', async () => {
    replies['POST /rooms'] = { status: 201, body: { id: ROOM_B, message: SAVED } };
    open('/UI-mrr-013');
    await screen.findByLabelText('โปรเจคเตอร์');

    type('ui-mrr-013-ent-002-code', 'C');
    type('ui-mrr-013-ent-003-name', 'ห้อง C');
    type('ui-mrr-013-ent-003-capacity', '10');
    fireEvent.click(screen.getByLabelText('โปรเจคเตอร์'));
    fireEvent.click(screen.getByTestId('ui-mrr-013-save'));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(SAVED));
    expect(screen.getByRole('heading', { level: 1, name: 'ห้องประชุม' })).toBeInTheDocument();
    expect(sent()).toEqual([{
      method: 'POST', url: '/rooms',
      body: { code: 'C', name: 'ห้อง C', capacity: 10, photos: [], facilityIds: [PROJECTOR.id], requiresApproval: false, approverId: null },
    }]);
  });

  it('แก้ไขห้อง opens the room\'s whole current version from API-022; its code is not editable', async () => {
    replies[`/rooms/${ROOM_A}`] = { status: 200, body: detail({ versionNo: 3, approver: RA1, requiresApproval: true }) };
    open('/UI-mrr-012');

    fireEvent.click(await screen.findByTestId('ui-mrr-012-edit-room'));

    await waitFor(() => expect(screen.getByTestId('ui-mrr-013-ent-003-name')).toHaveValue('ห้อง A'));
    expect(screen.getByTestId('ui-mrr-013-ent-002-code')).toHaveValue('A');
    expect(screen.getByTestId('ui-mrr-013-ent-002-code')).toHaveAttribute('readonly');
    expect(screen.getByTestId('ui-mrr-013-ent-003-capacity')).toHaveValue(8);
    expect(screen.getByTestId('ui-mrr-013-ent-003-version-no')).toHaveTextContent('3');
    expect(screen.getByTestId('ui-mrr-013-ent-003-requires-approval')).toBeChecked();
    expect(screen.getByTestId('ui-mrr-013-ent-003-photos')).toHaveTextContent('1 รูป');
    expect(screen.getByRole('list', { name: 'ผู้อนุมัติประจำห้องที่เลือก' })).toHaveTextContent('RA1');
    expect(await screen.findByLabelText('โปรเจคเตอร์')).toBeChecked();
    expect(screen.getByLabelText('ไมโครโฟน')).not.toBeChecked();
  });

  it('AC-mrr-040 names RA1 the approver of room B and saves the next version through API-023 — what was not changed goes back as it was', async () => {
    replies[`/rooms/${ROOM_B}`] = { status: 200, body: detail({ id: ROOM_B, code: 'B', name: 'ห้อง B', requiresApproval: true }) };
    replies['/users?query=RA'] = { status: 200, body: [RA1] };
    replies[`POST /rooms/${ROOM_B}/versions`] = { status: 201, body: { message: SAVED } };
    replies[LIST] = pageOf([row({ id: ROOM_B, code: 'B', name: 'ห้อง B', approver: RA1 })]);
    open(`/UI-mrr-013?room=${ROOM_B}`);
    await waitFor(() => expect(screen.getByTestId('ui-mrr-013-ent-003-name')).toHaveValue('ห้อง B'));
    await screen.findByLabelText('โปรเจคเตอร์');

    type('ui-mrr-013-ent-003-approver', 'RA');
    fireEvent.click(await screen.findByRole('button', { name: 'RA1 (ra1@example.test)' }));
    fireEvent.click(screen.getByTestId('ui-mrr-013-save'));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(SAVED));
    expect(sent()).toEqual([{
      method: 'POST', url: `/rooms/${ROOM_B}/versions`,
      body: { name: 'ห้อง B', capacity: 8, photos: ['photo-1'], facilityIds: [PROJECTOR.id], requiresApproval: true, approverId: RA1.id },
    }]);
  });

  it.each([
    ['AC-mrr-076 · AC-mrr-078 to needs approval', false, true],
    ['AC-mrr-077 to no approval', true, false],
  ])('%s — the setting is sent with the version; the bookings that have not started are the api\'s to move', async (_what, before, after) => {
    replies[`/rooms/${ROOM_A}`] = { status: 200, body: detail({ requiresApproval: before }) };
    replies[`POST /rooms/${ROOM_A}/versions`] = { status: 201, body: { message: SAVED } };
    open(`/UI-mrr-013?room=${ROOM_A}`);
    await waitFor(() => expect(screen.getByTestId('ui-mrr-013-ent-003-name')).toHaveValue('ห้อง A'));

    fireEvent.click(screen.getByTestId('ui-mrr-013-ent-003-requires-approval'));
    fireEvent.click(screen.getByTestId('ui-mrr-013-save'));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(SAVED));
    expect(sent()[0].body).toMatchObject({ requiresApproval: after });
  });

  it('AC-mrr-032 a lower capacity is saved as it is — nothing on the form holds the bookings to it', async () => {
    replies[`/rooms/${ROOM_A}`] = { status: 200, body: detail({ capacity: 10 }) };
    replies[`POST /rooms/${ROOM_A}/versions`] = { status: 201, body: { message: SAVED } };
    open(`/UI-mrr-013?room=${ROOM_A}`);
    await waitFor(() => expect(screen.getByTestId('ui-mrr-013-ent-003-capacity')).toHaveValue(10));

    type('ui-mrr-013-ent-003-capacity', '4');
    fireEvent.click(screen.getByTestId('ui-mrr-013-save'));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(SAVED));
    expect(sent()[0].body).toMatchObject({ capacity: 4 });
  });

  it.each([['AC-mrr-017 a General User'], ['AC-mrr-018 a System Administrator']])('%s saving is refused with the api\'s words and the form stays', async () => {
    replies['POST /rooms'] = { status: 403, body: { statusCode: 403, message: REFUSAL } };
    open('/UI-mrr-013');

    type('ui-mrr-013-ent-002-code', 'A');
    type('ui-mrr-013-ent-003-name', 'ห้อง A');
    type('ui-mrr-013-ent-003-capacity', '12');
    fireEvent.click(screen.getByTestId('ui-mrr-013-save'));

    expect(await screen.findByRole('alert')).toHaveTextContent(REFUSAL);
    expect(screen.getByTestId('ui-mrr-013-ent-003-capacity')).toHaveValue(12);
  });

  it('unauthorized state — anyone but a Room Administrator opening a room sees คุณไม่มีสิทธิ์เข้าหน้านี้ and no form', async () => {
    // API-022 answers them with the booking form's few fields — no code among them.
    replies[`/rooms/${ROOM_A}`] = { status: 200, body: { id: ROOM_A, name: 'ห้อง A', capacity: 8, requiresApproval: false, status: 'ACTIVE' } };
    open(`/UI-mrr-013?room=${ROOM_A}`);

    expect(await screen.findByRole('alert')).toHaveTextContent('คุณไม่มีสิทธิ์เข้าหน้านี้');
    expect(screen.queryByTestId('ui-mrr-013-save')).not.toBeInTheDocument();
  });

  it('error state — missing values are pointed at, and nothing is sent', async () => {
    open('/UI-mrr-013');

    type('ui-mrr-013-ent-003-capacity', '0');
    fireEvent.click(screen.getByTestId('ui-mrr-013-save'));

    expect(screen.getByText('กรุณาระบุรหัสห้อง')).toBeInTheDocument();
    expect(screen.getByText('กรุณาระบุชื่อห้อง')).toBeInTheDocument();
    expect(screen.getByText('ความจุต้องเป็นจำนวนเต็มตั้งแต่ 1')).toBeInTheDocument();
    expect(screen.getByTestId('ui-mrr-013-ent-003-name')).toHaveAttribute('aria-invalid', 'true');
    expect(sent()).toEqual([]);
  });

  it('overflow state — a name over 100 letters is not taken', async () => {
    open('/UI-mrr-013');

    type('ui-mrr-013-ent-002-code', 'C');
    type('ui-mrr-013-ent-003-name', 'ก'.repeat(101));
    type('ui-mrr-013-ent-003-capacity', '10');
    fireEvent.click(screen.getByTestId('ui-mrr-013-save'));

    expect(screen.getByText('ชื่อห้องต้องไม่เกิน 100 ตัวอักษร')).toBeInTheDocument();
    expect(sent()).toEqual([]);
  });

  it('error state — a code already used is said at the code field, in the api\'s words', async () => {
    replies['POST /rooms'] = { status: 400, body: { statusCode: 400, field: 'code', message: 'รหัสห้องนี้มีอยู่แล้ว' } };
    open('/UI-mrr-013');

    type('ui-mrr-013-ent-002-code', 'A');
    type('ui-mrr-013-ent-003-name', 'ห้อง A ใหม่');
    type('ui-mrr-013-ent-003-capacity', '6');
    fireEvent.click(screen.getByTestId('ui-mrr-013-save'));

    expect(await screen.findByText('รหัสห้องนี้มีอยู่แล้ว')).toHaveAttribute('id', 'ui-mrr-013-ent-002-code-error');
    expect(screen.getByTestId('ui-mrr-013-ent-002-code')).toHaveAttribute('aria-invalid', 'true');
  });

  it('loading state — บันทึก is disabled while saving', async () => {
    let release!: (r: Reply) => void;
    replies['POST /rooms'] = () => new Promise<Reply>((r) => (release = r));
    open('/UI-mrr-013');

    type('ui-mrr-013-ent-002-code', 'C');
    type('ui-mrr-013-ent-003-name', 'ห้อง C');
    type('ui-mrr-013-ent-003-capacity', '10');
    fireEvent.click(screen.getByTestId('ui-mrr-013-save'));

    await waitFor(() => expect(screen.getByTestId('ui-mrr-013-save')).toBeDisabled());
    release({ status: 201, body: { id: ROOM_B, message: SAVED } });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(SAVED));
  });

  it('a facility since taken out of use is left out of the new version, and the form says so', async () => {
    replies[`/rooms/${ROOM_A}`] = { status: 200, body: detail({ facilityIds: [PROJECTOR.id, 'gone'] }) };
    replies[`POST /rooms/${ROOM_A}/versions`] = { status: 201, body: { message: SAVED } };
    open(`/UI-mrr-013?room=${ROOM_A}`);

    expect(await screen.findByText('สิ่งอำนวยความสะดวกที่ปิดใช้แล้ว 1 รายการจะไม่อยู่ในเวอร์ชันใหม่')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ui-mrr-013-save'));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(SAVED));
    expect(sent()[0].body).toMatchObject({ facilityIds: [PROJECTOR.id] });
  });

  it('กลับ goes back to the rooms without saving', async () => {
    open('/UI-mrr-013');

    fireEvent.click(screen.getByTestId('ui-mrr-013-back'));

    expect(await screen.findByRole('heading', { level: 1, name: 'ห้องประชุม' })).toBeInTheDocument();
    expect(sent()).toEqual([]);
  });
});

describe('FE-mrr-013 facilities page (UI-mrr-014)', () => {
  const FACILITY_SAVED = 'บันทึกสิ่งอำนวยความสะดวกสำเร็จ';
  const names = () => screen.getAllByTestId('ui-mrr-014-ent-004-name').map((i) => (i as HTMLInputElement).value);

  it('lists the facilities in use from API-002, each with its name and ใช้งาน', async () => {
    open('/UI-mrr-014');

    await screen.findAllByTestId('ui-mrr-014-ent-004-name');
    expect(names()).toEqual(['โปรเจคเตอร์', 'ไมโครโฟน']);
    expect(screen.getAllByTestId('ui-mrr-014-ent-004-active').every((c) => (c as HTMLInputElement).checked)).toBe(true);
  });

  it('เพิ่ม adds a row; บันทึก posts it to API-026 and says the api\'s words', async () => {
    replies['POST /facilities'] = { status: 201, body: { facility: { id: 'f3', name: 'กระดาน', active: true }, message: FACILITY_SAVED } };
    open('/UI-mrr-014');
    await screen.findAllByTestId('ui-mrr-014-ent-004-name');

    fireEvent.click(screen.getByTestId('ui-mrr-014-add'));
    fireEvent.change(screen.getAllByTestId('ui-mrr-014-ent-004-name')[0], { target: { value: ' กระดาน ' } });
    fireEvent.click(screen.getAllByTestId('ui-mrr-014-save')[0]);

    expect(await screen.findByRole('status')).toHaveTextContent(FACILITY_SAVED);
    expect(sent()).toEqual([{ method: 'POST', url: '/facilities', body: { name: 'กระดาน' } }]);
    expect(names()).toEqual(['กระดาน', 'โปรเจคเตอร์', 'ไมโครโฟน']);
  });

  it('a rename or taking one out of use is sent to API-027 with only what changed', async () => {
    replies[`PATCH /facilities/${MIC.id}`] = { status: 200, body: { facility: { ...MIC, active: false }, message: FACILITY_SAVED } };
    open('/UI-mrr-014');
    await screen.findAllByTestId('ui-mrr-014-ent-004-name');

    expect(screen.getAllByTestId('ui-mrr-014-save')[1]).toBeDisabled();
    fireEvent.click(screen.getAllByTestId('ui-mrr-014-ent-004-active')[1]);
    fireEvent.click(screen.getAllByTestId('ui-mrr-014-save')[1]);

    expect(await screen.findByRole('status')).toHaveTextContent(FACILITY_SAVED);
    expect(sent()).toEqual([{ method: 'PATCH', url: `/facilities/${MIC.id}`, body: { active: false } }]);
    expect(screen.getAllByTestId('ui-mrr-014-ent-004-active')[1]).not.toBeChecked();
  });

  it('error state — a name already used is said at that row', async () => {
    replies[`PATCH /facilities/${MIC.id}`] = { status: 400, body: { statusCode: 400, field: 'name', message: 'มีสิ่งอำนวยความสะดวกชื่อนี้แล้ว' } };
    open('/UI-mrr-014');
    await screen.findAllByTestId('ui-mrr-014-ent-004-name');

    fireEvent.change(screen.getAllByTestId('ui-mrr-014-ent-004-name')[1], { target: { value: 'โปรเจคเตอร์' } });
    fireEvent.click(screen.getAllByTestId('ui-mrr-014-save')[1]);

    const error = await screen.findByText('มีสิ่งอำนวยความสะดวกชื่อนี้แล้ว');
    expect(error.closest('tr')).toBe(screen.getAllByRole('row')[2]);
    expect(screen.getAllByTestId('ui-mrr-014-ent-004-name')[1]).toHaveAttribute('aria-invalid', 'true');
  });

  it.each([['a General User', 'GENERAL_USER'], ['a System Administrator', 'SYSTEM_ADMINISTRATOR']])(
    'AC-mrr-088 %s opening the page is told คุณไม่มีสิทธิ์เข้าหน้านี้ and sees no facility, no เพิ่ม and no บันทึก',
    async (_who, role) => {
      replies[ME] = { status: 200, body: { fullName: 'U1', role } };
      open('/UI-mrr-014');

      expect(await screen.findByRole('alert')).toHaveTextContent('คุณไม่มีสิทธิ์เข้าหน้านี้');
      expect(screen.queryByText('โปรเจคเตอร์')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ui-mrr-014-ent-004-name')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ui-mrr-014-add')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ui-mrr-014-save')).not.toBeInTheDocument();
      expect(screen.getByTestId('ui-mrr-014-back')).toBeInTheDocument();
      expect(sent()).toEqual([]);
    },
  );

  it('while API-035 cannot say who is signed in, nothing is listed and โหลดใหม่ asks again', async () => {
    replies[ME] = { status: 500 };
    open('/UI-mrr-014');

    expect(await screen.findByRole('alert')).toHaveTextContent('โหลดรายการสิ่งอำนวยความสะดวกไม่สำเร็จ');
    expect(screen.queryByTestId('ui-mrr-014-ent-004-name')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ui-mrr-014-add')).not.toBeInTheDocument();

    replies[ME] = { status: 200, body: { fullName: 'RA1', role: 'ROOM_ADMINISTRATOR' } };
    fireEvent.click(screen.getByRole('button', { name: 'โหลดใหม่' }));
    await screen.findAllByTestId('ui-mrr-014-ent-004-name');
    expect(names()).toEqual(['โปรเจคเตอร์', 'ไมโครโฟน']);
  });

  it('someone whose session API-035 refuses is taken to sign-in', async () => {
    replies[ME] = { status: 401, body: { message: 'Unauthorized' } };
    open('/UI-mrr-014');

    expect(await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
  });

  it('unauthorized state — anyone but a Room Administrator is refused at the row with the api\'s words', async () => {
    replies[`PATCH /facilities/${MIC.id}`] = { status: 403, body: { statusCode: 403, message: REFUSAL } };
    open('/UI-mrr-014');
    await screen.findAllByTestId('ui-mrr-014-ent-004-name');

    fireEvent.change(screen.getAllByTestId('ui-mrr-014-ent-004-name')[1], { target: { value: 'ไมค์' } });
    fireEvent.click(screen.getAllByTestId('ui-mrr-014-save')[1]);

    expect(await screen.findByText(REFUSAL)).toBeInTheDocument();
  });

  it('empty state — ยังไม่มีสิ่งอำนวยความสะดวก with เพิ่ม', async () => {
    replies[FACILITIES] = { status: 200, body: [] };
    open('/UI-mrr-014');

    expect(await screen.findByText('ยังไม่มีสิ่งอำนวยความสะดวก')).toBeInTheDocument();
    expect(screen.getAllByTestId('ui-mrr-014-add')).toHaveLength(2);
  });

  it('overflow state — more than 50 are paged', async () => {
    replies[FACILITIES] = { status: 200, body: Array.from({ length: 51 }, (_, i) => ({ id: `f${i}`, name: `รายการ ${i}` })) };
    open('/UI-mrr-014');

    expect(await screen.findAllByTestId('ui-mrr-014-ent-004-name')).toHaveLength(50);
    fireEvent.click(screen.getByRole('button', { name: 'หน้าถัดไป' }));
    expect(names()).toEqual(['รายการ 50']);
  });

  it('กลับ goes back to the rooms', async () => {
    open('/UI-mrr-014');

    fireEvent.click(await screen.findByTestId('ui-mrr-014-back'));

    expect(await screen.findByRole('heading', { level: 1, name: 'ห้องประชุม' })).toBeInTheDocument();
  });
});
