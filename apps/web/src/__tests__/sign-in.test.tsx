import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';

// The verbatim Thai of AC-mrr-089..103 — copied from req's examples, never rewritten.
const SENT = 'หากเป็น Email ในระบบ เราได้ส่งรหัสเข้าสู่ระบบไปแล้ว กรุณาตรวจสอบ Email';
const SEND_FAILED = 'ส่งรหัสไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
const ALREADY_SENT = 'ส่งรหัสไปแล้ว กรุณาใช้รหัสเดิมใน Email หรือรอให้รหัสหมดอายุก่อนขอใหม่';
const WRONG = 'รหัสไม่ถูกต้อง กรุณาตรวจสอบรหัสใน Email แล้วกรอกใหม่';
const EXPIRED = 'รหัสหรือลิงก์เข้าสู่ระบบหมดอายุแล้ว กรุณาขอรหัสใหม่';
const USED = 'รหัสหรือลิงก์นี้ถูกใช้เข้าสู่ระบบไปแล้ว กรุณาขอรหัสใหม่';

type Reply = { status: number; body?: unknown };
type Call = { method: string; url: string; body?: unknown };

let replies: Record<string, Reply | Reply[]>;
let calls: Call[];

const REQUEST = 'POST /auth/otp/request';
const VERIFY = 'POST /auth/otp/verify';
const ME = '/auth/me';

beforeEach(() => {
  calls = [];
  sessionStorage.clear();
  replies = {
    // Nobody is signed in yet, unless a test says otherwise.
    [ME]: { status: 401, body: { message: 'Unauthorized' } },
    [REQUEST]: { status: 200, body: { message: SENT } },
    [VERIFY]: { status: 200, body: {} },
  };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, ...(init?.body ? { body: JSON.parse(init.body as string) } : {}) });
    const key = `${method === 'GET' ? '' : `${method} `}${url}`;
    const r = replies[key] ?? { status: 500 };
    const reply = Array.isArray(r) ? r.shift() ?? { status: 500 } : r;
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

const type = (testid: string, value: string) => fireEvent.change(screen.getByTestId(testid), { target: { value } });
const sent = (key: string) => calls.filter((c) => `${c.method} ${c.url}` === key);

describe('FE-mrr-040 sign-in screens (UI-mrr-001 · UI-mrr-002)', () => {
  it('AC-mrr-089 · AC-mrr-096 · AC-mrr-097 asks for a code and moves to the code page, which says it was sent and to whom', async () => {
    open('/UI-mrr-001');

    type('ui-mrr-001-org-email', 'u1@example.test');
    fireEvent.click(screen.getByTestId('ui-mrr-001-request-code'));

    expect(await screen.findByRole('heading', { level: 1, name: 'ยืนยันรหัส OTP' })).toBeInTheDocument();
    expect(screen.getByText(SENT)).toBeInTheDocument();
    expect(screen.getByTestId('ui-mrr-002-requested-email')).toHaveTextContent('u1@example.test');
    expect(sent(REQUEST)[0].body).toEqual({ email: 'u1@example.test' });
  });

  it('AC-mrr-090 stays on the request page with the send failure, and the button can be pressed again', async () => {
    replies[REQUEST] = { status: 503, body: { message: SEND_FAILED } };
    open('/UI-mrr-001');

    type('ui-mrr-001-org-email', 'u1@example.test');
    fireEvent.click(screen.getByTestId('ui-mrr-001-request-code'));

    expect(await screen.findByRole('alert')).toHaveTextContent(SEND_FAILED);
    expect(screen.getByRole('heading', { level: 1, name: 'ขอรหัสเข้าสู่ระบบ' })).toBeInTheDocument();
    expect(screen.getByTestId('ui-mrr-001-request-code')).toBeEnabled();
  });

  it('AC-mrr-093 shows the asked-too-soon sentence when a code is still usable', async () => {
    replies[REQUEST] = { status: 409, body: { message: ALREADY_SENT } };
    open('/UI-mrr-001');

    type('ui-mrr-001-org-email', 'u1@example.test');
    fireEvent.click(screen.getByTestId('ui-mrr-001-request-code'));

    expect(await screen.findByRole('alert')).toHaveTextContent(ALREADY_SENT);
  });

  it('takes somebody already signed in to the room search instead', async () => {
    replies[ME] = { status: 200, body: { fullName: 'U1', role: 'GENERAL_USER' } };
    open('/UI-mrr-001');

    expect(await screen.findByRole('heading', { level: 1, name: 'ค้นหาห้องว่าง' })).toBeInTheDocument();
  });

  describe('the code page', () => {
    const atCodePage = async (email = 'u1@example.test') => {
      open('/UI-mrr-001');
      type('ui-mrr-001-org-email', email);
      fireEvent.click(screen.getByTestId('ui-mrr-001-request-code'));
      await screen.findByRole('heading', { level: 1, name: 'ยืนยันรหัส OTP' });
    };
    const enter = (code: string) => {
      type('ui-mrr-002-otp-code', code);
      fireEvent.click(screen.getByTestId('ui-mrr-002-verify'));
    };

    it('AC-mrr-098 signs in with the code and lands on the room search with no message', async () => {
      await atCodePage();

      enter('482913');

      expect(await screen.findByRole('heading', { level: 1, name: 'ค้นหาห้องว่าง' })).toBeInTheDocument();
      expect(sent(VERIFY)[0].body).toEqual({ email: 'u1@example.test', code: '482913' });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('AC-mrr-102 keeps the page with the wrong-code sentence, and AC-mrr-103 the same code then signs in', async () => {
      replies[VERIFY] = [{ status: 401, body: { message: WRONG } }, { status: 401, body: { message: WRONG } }, { status: 200, body: {} }];
      await atCodePage();

      enter('482931');
      expect(await screen.findByRole('alert')).toHaveTextContent(WRONG);
      enter('482931');
      expect(await screen.findByRole('alert')).toHaveTextContent(WRONG);

      enter('482913');
      expect(await screen.findByRole('heading', { level: 1, name: 'ค้นหาห้องว่าง' })).toBeInTheDocument();
      expect(sent(REQUEST)).toHaveLength(1);
    });

    it.each([
      ['AC-mrr-099', 410, EXPIRED],
      ['AC-mrr-100', 409, USED],
    ])('%s shows the api\'s sentence and stays on the code page', async (_ac, status, message) => {
      replies[VERIFY] = { status, body: { message } };
      await atCodePage();

      enter('482913');

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.getByRole('heading', { level: 1, name: 'ยืนยันรหัส OTP' })).toBeInTheDocument();
    });

    it('takes only six digits', async () => {
      await atCodePage();

      type('ui-mrr-002-otp-code', '48a29 13999');

      expect(screen.getByTestId('ui-mrr-002-otp-code')).toHaveValue('482913');
    });

    it('AC-mrr-094 · AC-mrr-095 a new code once the old one expired or was used says it was sent again', async () => {
      await atCodePage();

      fireEvent.click(screen.getByTestId('ui-mrr-002-resend'));

      await waitFor(() => expect(sent(REQUEST)).toHaveLength(2));
      expect(await screen.findByText(SENT)).toBeInTheDocument();
      expect(sent(REQUEST)[1].body).toEqual({ email: 'u1@example.test' });
    });

    it('AC-mrr-093 a new code while the old one is still usable shows the asked-too-soon sentence', async () => {
      replies[REQUEST] = [{ status: 200, body: { message: SENT } }, { status: 409, body: { message: ALREADY_SENT } }];
      await atCodePage();

      fireEvent.click(screen.getByTestId('ui-mrr-002-resend'));

      expect(await screen.findByRole('alert')).toHaveTextContent(ALREADY_SENT);
    });
  });

  describe('a magic link that could not be used (API-033)', () => {
    it.each([
      ['AC-mrr-101 used', 'used', USED],
      ['expired', 'expired', EXPIRED],
    ])('%s lands on the code page with the same sentence the code would get', async (_name, reason, message) => {
      sessionStorage.setItem('mrr.requestedEmail', 'u1@example.test');
      open(`/UI-mrr-002?reason=${reason}`);

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.getByTestId('ui-mrr-002-requested-email')).toHaveTextContent('u1@example.test');
    });

    it('sends the person back to ask for a code when this browser never asked for one', async () => {
      open('/UI-mrr-002?reason=expired');

      fireEvent.click(screen.getByTestId('ui-mrr-002-resend'));

      expect(await screen.findByRole('heading', { level: 1, name: 'ขอรหัสเข้าสู่ระบบ' })).toBeInTheDocument();
      expect(sent(REQUEST)).toHaveLength(0);
    });
  });
});
