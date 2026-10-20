export type BookingStatus = 'PENDING_APPROVAL' | 'CONFIRMED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/** STM-mrr-001's state labels, word for word. */
export const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING_APPROVAL: 'รออนุมัติ',
  CONFIRMED: 'จองสำเร็จ (ห้องไม่ต้องอนุมัติ)',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ปฏิเสธแล้ว',
  CANCELLED: 'ยกเลิกแล้ว',
};

/** ACL-005 · ACL-006 condition — the states an owner may still edit or cancel. */
export const EDITABLE: BookingStatus[] = ['PENDING_APPROVAL', 'CONFIRMED', 'APPROVED'];

/** The api enforces this too (ACL-005 · ACL-006); a page just does not offer what it would refuse. */
export const canChange = (b: { status: BookingStatus; startAt: string }) =>
  EDITABLE.includes(b.status) && new Date(b.startAt).getTime() > Date.now();
