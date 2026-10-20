import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, getJson } from '../../shared/api';
import { routeOf } from '../../shared/sitemap';
import { slotLabel } from '../../shared/time';
import { BookingStatus, canEdit, STATUS_LABEL } from './status';

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
/** The empty state's way on — search for a free room. */
const FIND_ROOM = 'UI-mrr-004';
/** open's destination in screens.json. */
const EDIT_BOOKING = 'UI-mrr-008';

/**
 * UI-mrr-007 — the bookings the caller made, history included, from API-006. Only their own: a
 * booking they merely attend never shows here (AC-mrr-011). The api pages it 20 at a time with the
 * latest start first (the overflow state); ?page=<n> picks the page.
 */
export function MyBookingsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const page = Number(params.get('page')) || 1;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });

  const fetchPage = useCallback(() => {
    setLoad({ kind: 'loading' });
    getJson<MyBookingsPage>(`/me/bookings?page=${page}`)
      .then((data) => setLoad({ kind: 'ready', data }))
      .catch((err) => setLoad(err instanceof ApiError && err.status === 401 ? { kind: 'unauthorized' } : { kind: 'failed' }));
  }, [page]);

  useEffect(fetchPage, [fetchPage]);

  // The states design declares for this page (screens.json UI-mrr-007).
  if (load.kind === 'unauthorized') return <Navigate to={routeOf(SIGN_IN)} replace />;
  return (
    <>
      <h1>การจองของฉัน</h1>
      <p className="purpose">ดูรายการและประวัติการจองที่ตนเป็นผู้จอง แล้วเลือกแก้ไขหรือยกเลิก</p>
      {/* Not role="status": the shell's notice after a save is the page's one status message. */}
      {load.kind === 'loading' && <p className="help" aria-live="polite">กำลังโหลดการจอง…</p>}
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
          onOpen={(id) => navigate(`${routeOf(EDIT_BOOKING)}?booking=${id}`)}
          onPage={(n) => setParams({ page: String(n) })}
        />
      )}
    </>
  );
}

function BookingTable({ data, onOpen, onPage }: { data: MyBookingsPage; onOpen: (id: string) => void; onPage: (n: number) => void }) {
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
                  {canEdit(b) && (
                    <button type="button" className="more" data-testid="ui-mrr-007-open" onClick={() => onOpen(b.id)}>
                      แก้ไข
                    </button>
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
