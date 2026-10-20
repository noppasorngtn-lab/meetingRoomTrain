import { Link, Outlet, useLocation } from 'react-router-dom';
import { LOGOUT, MENU, PRODUCT_NAME, navTestId, routeOf, topLevelOf } from '../../shared/sitemap';

/** The frame every non-auth page is drawn inside: the app bar and the main menu. */
export function AppShell() {
  const location = useLocation();
  const current = topLevelOf(location.pathname);
  // What the page that sent us here said happened, e.g. 'จองห้องสำเร็จ' after a booking (UI-mrr-006 confirm).
  const notice = (location.state as { notice?: string } | null)?.notice;
  return (
    <div className="shell-app">
      <header className="appbar">
        <span className="wordmark">
          <span className="mark">{PRODUCT_NAME}</span>
        </span>
        <span className="spacer" />
        <Link to={routeOf(LOGOUT)} data-testid={navTestId(LOGOUT)}>
          ออกจากระบบ
        </Link>
      </header>
      <nav className="appnav" aria-label="เมนูหลัก">
        {MENU.map((s) => (
          <Link
            key={s.id}
            to={routeOf(s.id)}
            data-testid={navTestId(s.id)}
            aria-current={s.id === current ? 'page' : undefined}
          >
            {s.label}
          </Link>
        ))}
      </nav>
      <main className="page">
        {notice && (
          <div role="status" className="alert alert-info">
            <span className="alert-title">{notice}</span>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
