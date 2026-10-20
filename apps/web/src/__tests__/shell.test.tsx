import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';
import { SCREENS } from '../shared/sitemap';

const labelOf = (id: string) => SCREENS.find((s) => s.id === id)!.label;

/** A built page carries its wireframe's title (screens.json `title`), which can differ from its menu label. */
const BUILT_TITLE: Record<string, string> = { 'UI-mrr-006': 'จองห้องประชุม', 'UI-mrr-009': 'รายการรออนุมัติ' };
const headingOf = (id: string) => BUILT_TITLE[id] ?? labelOf(id);

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );

describe('FE-mrr-022 app shell', () => {
  it('shows the five top-level menu entries in sitemap order', () => {
    at('/UI-mrr-004');

    const nav = screen.getByRole('navigation', { name: 'เมนูหลัก' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'ค้นหาห้องว่าง',
      'การจองของฉัน',
      'รออนุมัติ',
      'ห้องประชุม',
      'รายงานการใช้ห้อง',
    ]);
    expect(links.map((l) => l.getAttribute('data-testid'))).toEqual([
      'nav-ui-mrr-004',
      'nav-ui-mrr-007',
      'nav-ui-mrr-009',
      'nav-ui-mrr-012',
      'nav-rpt-mrr-001',
    ]);
  });

  it('the app bar carries the product name and the way out', () => {
    at('/UI-mrr-004');

    const bar = screen.getByRole('banner');
    expect(within(bar).getByText('ระบบจองห้องประชุม')).toBeInTheDocument();
    const out = within(bar).getByRole('link', { name: 'ออกจากระบบ' });
    expect(out).toHaveAttribute('data-testid', 'nav-ui-mrr-003');
    expect(out).toHaveAttribute('href', '/UI-mrr-003');
  });

  it('a child page marks its top-level entry as the current one', () => {
    at('/UI-mrr-008');

    expect(screen.getByTestId('nav-ui-mrr-007')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('nav-ui-mrr-004')).not.toHaveAttribute('aria-current');
  });

  const framed = ['UI-mrr-004', 'UI-mrr-005', 'UI-mrr-006', 'UI-mrr-007', 'UI-mrr-008', 'UI-mrr-009',
    'UI-mrr-010', 'UI-mrr-011', 'UI-mrr-012', 'UI-mrr-013', 'UI-mrr-014', 'RPT-mrr-001'];

  it.each(framed)('%s opens inside the frame', (id) => {
    at(`/${id}`);

    expect(screen.getByRole('navigation', { name: 'เมนูหลัก' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: headingOf(id) })).toBeInTheDocument();
  });

  it.each(['UI-mrr-001', 'UI-mrr-002', 'UI-mrr-003'])('%s is an auth page and opens without the frame', (id) => {
    at(`/${id}`);

    expect(screen.queryByRole('navigation', { name: 'เมนูหลัก' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: labelOf(id) })).toBeInTheDocument();
  });

  it('the root opens the sign-in page', () => {
    at('/');

    expect(screen.getByRole('heading', { level: 1, name: labelOf('UI-mrr-001') })).toBeInTheDocument();
  });
});
