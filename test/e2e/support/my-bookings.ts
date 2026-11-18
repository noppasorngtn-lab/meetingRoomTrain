import type { APIRequestContext } from '@playwright/test';

/**
 * The page of "การจองของฉัน" (UI-mrr-007) that holds a booking.
 *
 * The list is the booker's EVERY booking, cancelled and rejected ones included, 20 to a page, latest start first —
 * and E2E bookings that carry an audit trail cannot be deleted, so the signed-in tester's list only ever grows.
 * A case that expects its booking on page 1, or that stops looking after a fixed number of pages, passes while the
 * list is short and starts failing at random once it is not (measured 2026-11-18: 1,126 rows, 57 pages).
 * This walks the pages the api itself reports, so it keeps working however long the list gets.
 */
export async function myBookingsPageOf(request: APIRequestContext, id: string): Promise<number> {
  let pages = 1;
  for (let n = 1; n <= pages; n++) {
    const res = await request.get(`/me/bookings?page=${n}`);
    const data = (await res.json()) as { items: { id: string }[]; pageSize: number; total: number };
    if (data.items.some((b) => b.id === id)) return n;
    pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  }
  throw new Error(`ไม่พบการจอง ${id} ใน "การจองของฉัน" ทั้ง ${pages} หน้า`);
}
