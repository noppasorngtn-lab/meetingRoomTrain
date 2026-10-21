import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiError, getJson, patchJson, postJson } from '../../shared/api';
import { Pager } from '../../shared/Pager';
import { routeOf } from '../../shared/sitemap';

/** A row as it stands on screen — `id: null` until a new one is saved (API-026). */
interface Row {
  key: string;
  id: string | null;
  name: string;
  active: boolean;
  saved: { name: string; active: boolean } | null;
  error: string | null;
}

type Load = { kind: 'loading' } | { kind: 'ready' } | { kind: 'failed' } | { kind: 'unauthorized' };

const SIGN_IN = 'UI-mrr-001';
/** add's and save's destinationRef is self; back's is the rooms. */
const SELF = 'UI-mrr-014';
const ROOMS = 'UI-mrr-012';
/** UI-mrr-014 overflow — 50 to a page. */
const PAGE_SIZE = 50;

/**
 * UI-mrr-014 — a Room Administrator adds a facility (API-026), renames it or takes it out of use
 * (API-027). The rows are the ones still offered (API-002); one taken out of use stays on screen
 * until the page is read again.
 */
export function FacilitiesPage() {
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchRows = useCallback(() => {
    setLoad({ kind: 'loading' });
    getJson<{ id: string; name: string }[]>('/facilities?active=true')
      .then((list) => {
        setRows(list.map((f) => ({ key: f.id, id: f.id, name: f.name, active: true, saved: { name: f.name, active: true }, error: null })));
        setLoad({ kind: 'ready' });
      })
      .catch((err) => setLoad(err instanceof ApiError && err.status === 401 ? { kind: 'unauthorized' } : { kind: 'failed' }));
  }, []);

  useEffect(fetchRows, [fetchRows]);

  const change = (key: string, set: Partial<Row>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...set, error: null } : r)));

  const add = () => {
    setRows((all) => [{ key: `new-${Date.now()}`, id: null, name: '', active: true, saved: null, error: null }, ...all]);
    setPage(1);
  };

  const save = async (row: Row) => {
    const name = row.name.trim();
    if (!name) return setRows((all) => all.map((r) => (r.key === row.key ? { ...r, error: 'กรุณาระบุชื่อสิ่งอำนวยความสะดวก' } : r)));
    if (name.length > 100) {
      return setRows((all) => all.map((r) => (r.key === row.key ? { ...r, error: 'ชื่อสิ่งอำนวยความสะดวกต้องไม่เกิน 100 ตัวอักษร' } : r)));
    }
    setSaving(row.key);
    try {
      const done = row.id
        ? await patchJson<{ facility: { id: string; name: string; active: boolean }; message: string }>(`/facilities/${row.id}`, {
            ...(name !== row.saved?.name ? { name } : {}),
            ...(row.active !== row.saved?.active ? { active: row.active } : {}),
          })
        : await postJson<{ facility: { id: string; name: string; active: boolean }; message: string }>('/facilities', { name });
      const { facility } = done;
      setRows((all) =>
        all.map((r) =>
          r.key === row.key ? { ...r, id: facility.id, name: facility.name, active: facility.active, saved: { name: facility.name, active: facility.active } } : r,
        ),
      );
      // Said through the shell's notice; the page stays where it is.
      navigate(routeOf(SELF), { replace: true, state: { notice: done.message } });
    } catch (err) {
      // Said at that row (UI-mrr-014 error state): a name already used, not a Room Administrator, or the api failed.
      if (err instanceof ApiError && err.status === 401) return setLoad({ kind: 'unauthorized' });
      const message = err instanceof ApiError && err.status !== 500 ? err.message : 'บันทึกไม่สำเร็จ กรุณากดบันทึกอีกครั้ง';
      setRows((all) => all.map((r) => (r.key === row.key ? { ...r, error: message } : r)));
    } finally {
      setSaving(null);
    }
  };

  const addButton = (
    <button type="button" className="btn btn-primary" data-testid="ui-mrr-014-add" onClick={add}>
      เพิ่ม
    </button>
  );
  const back = (
    <button type="button" className="btn btn-secondary" data-testid="ui-mrr-014-back" onClick={() => navigate(routeOf(ROOMS))}>
      กลับ
    </button>
  );

  // The states design declares for this page (screens.json UI-mrr-014).
  if (load.kind === 'unauthorized') return <Navigate to={routeOf(SIGN_IN)} replace />;
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <>
      <h1>สิ่งอำนวยความสะดวก</h1>
      <p className="purpose">Room Administrator เพิ่ม แก้ชื่อ หรือปิดใช้รายการสิ่งอำนวยความสะดวกที่ใช้กรองและเลือกตอนจอง</p>
      <div className="actions">
        {addButton}
        {back}
      </div>
      {/* Not role="status": the shell's notice after a save is the page's one status message. */}
      {load.kind === 'loading' && <p className="help" aria-live="polite">กำลังโหลดรายการสิ่งอำนวยความสะดวก…</p>}
      {load.kind === 'failed' && (
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">โหลดรายการสิ่งอำนวยความสะดวกไม่สำเร็จ</span>
          <button type="button" className="btn btn-secondary" onClick={fetchRows}>
            โหลดใหม่
          </button>
        </div>
      )}
      {load.kind === 'ready' && rows.length === 0 && (
        <div className="card">
          <p>ยังไม่มีสิ่งอำนวยความสะดวก</p>
          <div className="actions">{addButton}</div>
        </div>
      )}
      {load.kind === 'ready' && rows.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">การทำงาน</span></th>
                  <th scope="col">ชื่อ</th>
                  <th scope="col">ใช้งาน</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const unchanged = r.saved !== null && r.name === r.saved.name && r.active === r.saved.active;
                  return (
                    <tr key={r.key}>
                      <td>
                        {/* UIC-001 — the row's action in the first column. */}
                        <span className="row-actions">
                          <button
                            type="button"
                            className="more"
                            data-testid="ui-mrr-014-save"
                            disabled={unchanged || saving !== null}
                            aria-busy={saving === r.key || undefined}
                            onClick={() => save(r)}
                          >
                            บันทึก
                          </button>
                        </span>
                      </td>
                      <td>
                        <div className={r.error ? 'field err' : 'field'}>
                          <label className="sr-only" htmlFor={`facility-${r.key}`}>ชื่อ</label>
                          <input
                            className="input"
                            id={`facility-${r.key}`}
                            type="text"
                            data-testid="ui-mrr-014-ent-004-name"
                            value={r.name}
                            onChange={(e) => change(r.key, { name: e.target.value })}
                            aria-invalid={r.error ? true : undefined}
                            aria-describedby={r.error ? `facility-${r.key}-error` : undefined}
                          />
                          {r.error && <span className="errtext" id={`facility-${r.key}-error`}>{r.error}</span>}
                        </div>
                      </td>
                      <td>
                        {/* A new facility is offered from the start (API-026); it is taken out of use once saved. */}
                        <label className="check">
                          <input
                            type="checkbox"
                            data-testid="ui-mrr-014-ent-004-active"
                            checked={r.active}
                            disabled={r.id === null}
                            onChange={(e) => change(r.key, { active: e.target.checked })}
                          />
                          <span className="sr-only">ใช้งาน</span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
        </div>
      )}
    </>
  );
}
