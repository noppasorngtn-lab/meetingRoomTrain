import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './features/shell/AppShell';
import { AuthLayout } from './features/shell/AuthLayout';
import { PendingScreen } from './shared/PendingScreen';
import { SCREENS, routeOf } from './shared/sitemap';

/** The sitemap's first entry screen — sign-in. */
const ENTRY = 'UI-mrr-001';

const routesFor = (auth: boolean) =>
  SCREENS.filter((s) => s.auth === auth).map((s) => (
    <Route key={s.id} path={routeOf(s.id)} element={<PendingScreen screen={s} />} />
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
