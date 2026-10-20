import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, getJson, postJson } from '../../shared/api';
import { routeOf } from '../../shared/sitemap';
import { slotLabel } from '../../shared/time';
import { BookingStatus, canChange, STATUS_LABEL } from './status';

interface MyBooking {
  id: string;
  roomId: string;
  roomName: string;
  startAt: string;
  endAt: string;
  title: string;
  status: BookingStatus;
}

interface MyBookingsPage {
  items: MyBooking[];
  page: number;
  pageSize: number;
  total: number;
}

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; data: MyBookingsPage }
  | { kind: 'failed' }
  | { kind: 'unauthorized' };

const SIGN_IN = 'UI-mrr-001';
/** cancel's destination in screens.json — it stays here. */
const MY_BOOKINGS = 'UI-mrr-007';
/** The empty state's way on — search for a free room. */
const FIND_ROOM = 'UI-mrr-004';
/** open's destination in screens.json. */
const EDIT_BOOKING = 'UI-mrr-008';

/**
 * UI-mrr-007 — the bookings the caller made, history included, from API-006. Only their own: a
 * booking they merely attend never shows here (AC-mrr-011). The api pages it 20 at a time with the
 * latest start first (the overflow state); ?page=<n> picks the page. The booker cancels a booking
 * right here (API-009 · UC-mrr-005).
 */
export function MyBookingsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const page = Number(params.get('page')) || 1;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const fetchPage = useCallback(() => {
    setLoad({ kind: 'loading' });
    getJson<MyBookingsPage>(`/me/bookings?page=${page}`)
      .then((data) => setLoad({ kind: 'ready', data }))
      .catch((err) => setLoad(err instanceof ApiError && err.status === 401 ? { kind: 'unauthorized' } : { kind: 'failed' }));
  }, [page]);

  useEffect(fetchPage, [fetchPage]);

  const cancel = async (id: string) => {
    setCancelling(id);
    setFailure(null);
    try {
      const done = await postJson<{ message: string }>(`/bookings/${id}/cancel`, {});
      // Said through the shell's notice, the same way a save or a new booking reports here.
      navigate({ pathname: routeOf(MY_BOOKINGS), search: params.toString() }, { replace: true, state: { notice: done.message } });
      fetchPage();
    } catch (err) {
      // The booking stays as it was (UI-mrr-007 error state) — the api says why: not the booker,
      // already started, or the mail did not go and the person should press again.
      if (err instanceof ApiError && err.status === 401) return setLoad({ kind: 'unauthorized' });
      setFailure(err instanceof ApiError && err.status !== 500 ? err.message : 'ยกเลิกการจองไม่สำเร็จ กรุณากดยกเลิกอีกครั้ง');
    } finally {
      setCancelling(null);
    }
  };

  // The states design declares for this page (screens.json UI-mrr-007).
  if (load.kind === 'unauthorized') return <Navigate to={routeOf(SIGN_IN)} replace />;
  return (
    <>
      <h1>การจองของฉัน</h1>
      <p className="purpose">ดูรายการและประวัติการจองที่ตนเป็นผู้จอง แล้วเลือกแก้ไขหรือยกเลิก</p>
      {/* Not role="status": the shell's notice after a save is the page's one status message. */}
      {load.kind === 'loading' && <p className="help" aria-live="polite">กำลังโหลดการจอง…</p>}
      {failure && (
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">{failure}</span>
        </div>
      )}
      {load.kind === 'failed' && (
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">โหลดการจองไม่สำเร็จ</span>
          <button type="button" className="btn btn-secondary" onClick={fetchPage}>
            โหลดใหม่
          </button>
        </div>
      )}
      {load.kind === 'ready' && load.data.total === 0 && (
        <div className="card">
          <p>คุณยังไม่มีการจอง</p>
          <Link className="btn btn-primary" to={routeOf(FIND_ROOM)}>
            ค้นหาห้องว่าง
          </Link>
        </div>
      )}
      {load.kind === 'ready' && load.data.total > 0 && (
        <BookingTable
          data={load.data}
          cancelling={cancelling}
          onOpen={(id) => navigate(`${routeOf(EDIT_BOOKING)}?booking=${id}`)}
          onCancel={cancel}
          onPage={(n) => setParams({ page: String(n) })}
        />
      )}
    </>
  );
}

interface TableProps {
  data: MyBookingsPage;
  /** The booking whose cancel is on its way, if any. */
  cancelling: string | null;
  onOpen: (id: string) => void;
  onCancel: (id: string) => void;
  onPage: (n: number) => void;
}

function BookingTable({ data, cancelling, onOpen, onCancel, onPage }: TableProps) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <div className="card">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">การทำงาน</span></th>
              <th scope="col">ห้อง</th>
              <th scope="col">ช่วงเวลา</th>
              <th scope="col">หัวข้อ</th>
              <th scope="col">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((b) => (
              <tr key={b.id}>
                <td>
                  {/* UIC-001 — row actions in the first column, edit before command. */}
                  {canChange(b) && (
                    <span className="row-actions">
                      <button type="button" className="more" data-testid="ui-mrr-007-open" onClick={() => onOpen(b.id)}>
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        className="more more-danger"
                        data-testid="ui-mrr-007-cancel"
                        disabled={cancelling !== null}
                        aria-busy={cancelling === b.id || undefined}
                        onClick={() => onCancel(b.id)}
                      >
                        ยกเลิกการจอง
                      </button>
                    </span>
                  )}
                </td>
                <td data-testid="ui-mrr-007-ent-007-room">{b.roomName}</td>
                <td className="time" data-testid="ui-mrr-007-ent-007-start-at">{slotLabel(b.startAt, b.endAt)}</td>
                <td className="clip" title={b.title} data-testid="ui-mrr-007-ent-007-title">{b.title}</td>
                <td data-testid="ui-mrr-007-ent-007-status">{STATUS_LABEL[b.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav className="actions pager" aria-label="แบ่งหน้า">
          <button type="button" className="btn btn-secondary" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>
            หน้าก่อน
          </button>
          <span className="help">หน้า {data.page} จาก {pages}</span>
          <button type="button" className="btn btn-secondary" disabled={data.page >= pages} onClick={() => onPage(data.page + 1)}>
            หน้าถัดไป
          </button>
        </nav>
      )}
    </div>
  );
}
