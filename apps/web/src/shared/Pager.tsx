/** A list's overflow state — the api's pages, previous and next. Nothing at all for a single page. */
export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (n: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="actions pager" aria-label="แบ่งหน้า">
      <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        หน้าก่อน
      </button>
      <span className="help">หน้า {page} จาก {pages}</span>
      <button type="button" className="btn btn-secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        หน้าถัดไป
      </button>
    </nav>
  );
}
