/**
 * The screens of this app as design's sitemap declares them (.aeon/design/sitemap.json):
 * `parent: null` marks a top-level menu entry, `order` its place. A screen's route is its id.
 */
export interface SitemapScreen {
  id: string;
  label: string;
  parent: string | null;
  order: number;
  /** design's `kind: auth` — drawn without the app frame (MV29). */
  auth: boolean;
}

export const SCREENS: SitemapScreen[] = [
  { id: 'UI-mrr-001', label: 'เข้าสู่ระบบ', parent: null, order: 1, auth: true },
  { id: 'UI-mrr-002', label: 'ยืนยันรหัส', parent: 'UI-mrr-001', order: 1, auth: true },
  { id: 'UI-mrr-004', label: 'ค้นหาห้องว่าง', parent: null, order: 2, auth: false },
  { id: 'UI-mrr-005', label: 'ปฏิทินห้อง', parent: 'UI-mrr-004', order: 1, auth: false },
  { id: 'UI-mrr-006', label: 'จองห้อง', parent: 'UI-mrr-004', order: 2, auth: false },
  { id: 'UI-mrr-007', label: 'การจองของฉัน', parent: null, order: 3, auth: false },
  { id: 'UI-mrr-008', label: 'แก้ไขการจอง', parent: 'UI-mrr-007', order: 1, auth: false },
  { id: 'UI-mrr-009', label: 'รออนุมัติ', parent: null, order: 4, auth: false },
  { id: 'UI-mrr-010', label: 'จัดการการจอง', parent: 'UI-mrr-009', order: 1, auth: false },
  { id: 'UI-mrr-011', label: 'คำขอแก้ไขการจอง', parent: 'UI-mrr-009', order: 2, auth: false },
  { id: 'UI-mrr-012', label: 'ห้องประชุม', parent: null, order: 5, auth: false },
  { id: 'UI-mrr-013', label: 'ข้อมูลห้อง', parent: 'UI-mrr-012', order: 1, auth: false },
  { id: 'UI-mrr-014', label: 'สิ่งอำนวยความสะดวก', parent: 'UI-mrr-012', order: 2, auth: false },
  { id: 'RPT-mrr-001', label: 'รายงานการใช้ห้อง', parent: null, order: 6, auth: false },
  { id: 'UI-mrr-003', label: 'ออกจากระบบ', parent: null, order: 99, auth: true },
];

export const LOGOUT = 'UI-mrr-003';

export const routeOf = (id: string) => `/${id}`;

/** `nav-<screen id lowercased>` — the id mock derives for a menu link (mock wireframes.mjs navControlId). */
export const navTestId = (id: string) => `nav-${id.toLowerCase()}`;

/** The top-level screen a route sits under — itself if it has no parent. */
export function topLevelOf(path: string): string | null {
  let s = SCREENS.find((x) => routeOf(x.id) === path);
  while (s?.parent) s = SCREENS.find((x) => x.id === s!.parent);
  return s?.id ?? null;
}

/** The product name a person confirmed in mock's conventions.json `shell.productName` (gate 69). */
export const PRODUCT_NAME = 'ระบบจองห้องประชุม';

/** Top-level entries of the frame, in sitemap order. Auth screens never appear in it. */
export const MENU = SCREENS.filter((s) => s.parent === null && !s.auth).sort((a, b) => a.order - b.order);
