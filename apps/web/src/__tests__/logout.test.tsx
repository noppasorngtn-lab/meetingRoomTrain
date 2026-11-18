import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from '../App';

type Reply = { status: number; body?: unknown } | 'network-down' | 'pending';

let reply: Reply;
let calls: { method: string; url: string }[];
let release: ((r: Response) => void) | undefined;

beforeEach(() => {
  reply = { status: 200, body: {} };
  calls = [];
  release = undefined;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ method: init?.method ?? 'GET', url });
    // The sign-in-again click can land on a page that asks for the facility list: answer it with a list, not the logout reply.
    if (url.startsWith('/facilities')) return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    if (reply === 'network-down') throw new TypeError('Failed to fetch');
    if (reply === 'pending') return new Promise<Response>((res) => { release = res; });
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const Here = () => {
  const l = useLocation();
  return <span data-testid="here">{l.pathname}</span>;
};

const open = () =>
  render(
    <MemoryRouter initialEntries={['/UI-mrr-003']}>
      <AppRoutes />
      <Here />
    </MemoryRouter>,
  );

describe('FE-mrr-046 sign-out page (UI-mrr-003)', () => {
  it('AC-mrr-111 ends the session through API-034, then says ออกจากระบบแล้ว with a way to sign in again', async () => {
    open();

    expect(await screen.findByTestId('ui-mrr-003-confirmation-message')).toHaveTextContent('ออกจากระบบแล้ว');
    expect(screen.getByTestId('ui-mrr-003-sign-in-again')).toHaveTextContent('เข้าสู่ระบบอีกครั้ง');
    expect(calls).toEqual([{ method: 'POST', url: '/auth/logout' }]);
  });

  it('says it is signing out until the session is ended, and does not claim it is done before', async () => {
    reply = 'pending';
    open();

    expect(await screen.findByRole('status')).toHaveTextContent('กำลังออกจากระบบ');
    expect(screen.queryByTestId('ui-mrr-003-confirmation-message')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ui-mrr-003-sign-in-again')).not.toBeInTheDocument();

    release!(new Response('{}', { status: 200 }));
    expect(await screen.findByTestId('ui-mrr-003-confirmation-message')).toHaveTextContent('ออกจากระบบแล้ว');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('เข้าสู่ระบบอีกครั้ง takes the person to the page that asks for a login code (UI-mrr-001)', async () => {
    open();

    fireEvent.click(await screen.findByTestId('ui-mrr-003-sign-in-again'));

    await waitFor(() => expect(screen.getByTestId('here')).toHaveTextContent('/UI-mrr-001'));
  });

  describe('AC-mrr-112 · the session cannot be ended', () => {
    it.each([
      ['the api answers an error', { status: 500 } as Reply],
      ['the api cannot be reached', 'network-down' as Reply],
    ])('when %s: says to try again and does not say the person is signed out', async (_what, failure) => {
      reply = failure;
      open();

      expect(await screen.findByRole('alert')).toHaveTextContent('ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง');
      expect(screen.queryByText('ออกจากระบบแล้ว')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ui-mrr-003-confirmation-message')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ui-mrr-003-sign-in-again')).not.toBeInTheDocument();
    });
  });

  it('AC-mrr-113 shows the same sentence to whoever opens it — it never asks who was signed in', async () => {
    open();

    expect(await screen.findByTestId('ui-mrr-003-confirmation-message')).toHaveTextContent('ออกจากระบบแล้ว');
    expect(calls.every((c) => c.url === '/auth/logout')).toBe(true);
  });

  it('opens without the app frame — nobody is signed in any more', async () => {
    open();

    await screen.findByTestId('ui-mrr-003-confirmation-message');
    expect(screen.queryByRole('navigation', { name: 'เมนูหลัก' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'ออกจากระบบ' })).toBeInTheDocument();
  });
});
