import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CalendarPage } from './features/calendar/CalendarPage';
import { AppShell } from './features/shell/AppShell';
import { AuthLayout } from './features/shell/AuthLayout';
import { PendingScreen } from './shared/PendingScreen';
import { SCREENS, routeOf } from './shared/sitemap';

/** The sitemap's first entry screen — sign-in. */
const ENTRY = 'UI-mrr-001';

/** Screens already built; every other one is still its placeholder. */
const BUILT: Record<string, JSX.Element> = {
  'UI-mrr-005': <CalendarPage />,
};

const routesFor = (auth: boolean) =>
  SCREENS.filter((s) => s.auth === auth).map((s) => (
    <Route key={s.id} path={routeOf(s.id)} element={BUILT[s.id] ?? <PendingScreen screen={s} />} />
  ));

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={routeOf(ENTRY)} replace />} />
      <Route element={<AuthLayout />}>{routesFor(true)}</Route>
      <Route element={<AppShell />}>{routesFor(false)}</Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
