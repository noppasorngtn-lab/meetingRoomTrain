import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, getJson } from '../../shared/api';
import { Pager } from '../../shared/Pager';
import { routeOf } from '../../shared/sitemap';
import { ROOM_STATUS_LABEL, RoomStatus } from './status';

export interface RoomRow {
  id: string;
  code: string;
  name: string;
  capacity: number;
  status: RoomStatus;
  requiresApproval: boolean;
  approver: { id: string; fullName: string } | null;
  versionNo: number;
}

interface RoomPage {
  items: RoomRow[];
  page: number;
  pageSize: number;
  total: number;
}

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; data: RoomPage }
  | { kind: 'failed' }
  | { kind: 'forbidden'; message: string }
  | { kind: 'unauthorized' };

const SIGN_IN = 'UI-mrr-001';
/** add-room's and edit-room's destinationRef in screens.json. */
const ROOM_FORM = 'UI-mrr-013';
/** facilities' destinationRef in screens.json. */
const FACILITIES = 'UI-mrr-014';

/**
 * UI-mrr-012 — a Room Administrator's rooms (API-020), 20 to a page by code, found by part of a
 * name or a code. ?query=<text>&archived=1&page=<n> keep the search; archived rooms show only
 * through that filter (overflow state).
 */
export function RoomsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const page = Number(params.get('page')) || 1;
  const query = params.get('query') ?? '';
  const archived = params.get('archived') === '1';
  const [text, setText] = useState(query);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });

  const fetchPage = useCallback(() => {
    setLoad({ kind: 'loading' });
    const search = new URLSearchParams({ page: String(page) });
    if (query) search.set('query', query);
    if (archived) search.set('status', 'ARCHIVED');
    getJson<RoomPage>(`/rooms?${search}`)
      .then((data) => setLoad({ kind: 'ready', data }))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) return setLoad({ kind: 'unauthorized' });
        // Not a Room Administrator, a System Administrator included — the api's words.
        if (err instanceof ApiError && err.status === 403) return setLoad({ kind: 'forbidden', message: err.message });
        setLoad({ kind: 'failed' });
      });
  }, [page, query, archived]);

  useEffect(fetchPage, [fetchPage]);

  const keep = (next: { query?: string; archived?: boolean; page?: number }) => {
    const q = next.query ?? query;
    const a = next.archived ?? archived;
    const p = next.page ?? 1;
    setParams({ ...(q ? { query: q } : {}), ...(a ? { archived: '1' } : {}), ...(p > 1 ? { page: String(p) } : {}) });
  };

  const find = (e: FormEvent) => {
    e.preventDefault();
    keep({ query: text.trim() });
  };

  const addRoom = (
    <button type="button" className="btn btn-primary" data-testid="ui-mrr-012-add-room" onClick={() => navigate(routeOf(ROOM_FORM))}>
      เพิ่มห้อง
    </button>
  );

  // The states design declares for this page (screens.json UI-mrr-012).
  if (load.kind === 'unauthorized') return <Navigate to={routeOf(SIGN_IN)} replace />;
  if (load.kind === 'forbidden') {
    return (
      <>
        <h1>ห้องประชุม</h1>
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">{load.message}</span>
        </div>
      </>
    );
  }
  const searching = query !== '' || archived;
  return (
    <>
      <h1>ห้องประชุม</h1>
      <p className="purpose">Room Administrator ดูรายการห้องทั้งหมด แล้วเพิ่ม แก้ไข ปิดปรับปรุง เปิดใช้งาน หรือลบห้อง</p>
      <div className="actions">
        {addRoom}
        <button type="button" className="btn btn-secondary" data-testid="ui-mrr-012-facilities" onClick={() => navigate(routeOf(FACILITIES))}>
          สิ่งอำนวยความสะดวก
        </button>
      </div>
      <form className="card" role="search" onSubmit={find}>
        <div className="grid">
          <div className="field">
            <label htmlFor="rooms-query">ค้นหาห้อง</label>
            <input
              className="input"
              id="rooms-query"
              type="search"
              placeholder="ชื่อหรือรหัสห้อง"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </div>
        <div className="actions">
          <button type="submit" className="btn btn-secondary">ค้นหา</button>
          <label className="check">
            <input type="checkbox" checked={archived} onChange={(e) => keep({ archived: e.target.checked })} />
            แสดงเฉพาะห้องที่ลบแล้ว
          </label>
        </div>
      </form>
      {/* Not role="status": the shell's notice after a save is the page's one status message. */}
      {load.kind === 'loading' && <p className="help" aria-live="polite">กำลังโหลดรายการห้อง…</p>}
      {load.kind === 'failed' && (
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">โหลดรายการห้องไม่สำเร็จ</span>
          <button type="button" className="btn btn-secondary" onClick={fetchPage}>
            โหลดใหม่
          </button>
        </div>
      )}
      {load.kind === 'ready' && load.data.total === 0 && (
        <div className="card">
          {searching ? <p>ไม่พบห้องที่ค้นหา</p> : (
            <>
              <p>ยังไม่มีห้องประชุม</p>
              <div className="actions">{addRoom}</div>
            </>
          )}
        </div>
      )}
      {load.kind === 'ready' && load.data.total > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">การทำงาน</span></th>
                  <th scope="col">รหัสห้อง</th>
                  <th scope="col">ชื่อห้อง</th>
                  <th scope="col">ความจุ</th>
                  <th scope="col">สถานะห้อง</th>
                </tr>
              </thead>
              <tbody>
                {load.data.items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {/* UIC-001 — row actions in the first column. An archived room is gone and is not edited. */}
                      <span className="row-actions">
                        {r.status !== 'ARCHIVED' && (
                          <button
                            type="button"
                            className="more"
                            data-testid="ui-mrr-012-edit-room"
                            onClick={() => navigate(`${routeOf(ROOM_FORM)}?room=${r.id}`)}
                          >
                            แก้ไขห้อง
                          </button>
                        )}
                      </span>
                    </td>
                    <td data-testid="ui-mrr-012-ent-002-code">{r.code}</td>
                    <td className="clip" title={r.name} data-testid="ui-mrr-012-ent-003-name">{r.name}</td>
                    <td data-testid="ui-mrr-012-ent-003-capacity">{r.capacity} คน</td>
                    <td data-testid="ui-mrr-012-ent-002-status">{ROOM_STATUS_LABEL[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={load.data.page} pageSize={load.data.pageSize} total={load.data.total} onPage={(n) => keep({ page: n })} />
        </div>
      )}
    </>
  );
}
