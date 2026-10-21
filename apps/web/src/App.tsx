import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdjustmentRequestsPage } from './features/booking/AdjustmentRequestsPage';
import { BookingPage } from './features/booking/BookingPage';
import { EditBookingPage } from './features/booking/EditBookingPage';
import { ManageBookingPage } from './features/booking/ManageBookingPage';
import { MyBookingsPage } from './features/booking/MyBookingsPage';
import { PendingApprovalsPage } from './features/booking/PendingApprovalsPage';
import { CalendarPage } from './features/calendar/CalendarPage';
import { UtilizationReportPage } from './features/reports/UtilizationReportPage';
import { FacilitiesPage } from './features/rooms/FacilitiesPage';
import { RoomFormPage } from './features/rooms/RoomFormPage';
import { RoomsPage } from './features/rooms/RoomsPage';
import { AppShell } from './features/shell/AppShell';
import { AuthLayout } from './features/shell/AuthLayout';
import { PendingScreen } from './shared/PendingScreen';
import { SCREENS, routeOf } from './shared/sitemap';

/** The sitemap's first entry screen — sign-in. */
const ENTRY = 'UI-mrr-001';

/** Screens already built; every other one is still its placeholder. */
const BUILT: Record<string, JSX.Element> = {
  'UI-mrr-005': <CalendarPage />,
  'UI-mrr-006': <BookingPage />,
  'UI-mrr-007': <MyBookingsPage />,
  'UI-mrr-008': <EditBookingPage />,
  'UI-mrr-009': <PendingApprovalsPage />,
  'UI-mrr-010': <ManageBookingPage />,
  'UI-mrr-011': <AdjustmentRequestsPage />,
  'UI-mrr-012': <RoomsPage />,
  'UI-mrr-013': <RoomFormPage />,
  'UI-mrr-014': <FacilitiesPage />,
  'RPT-mrr-001': <UtilizationReportPage />,
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
