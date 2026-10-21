export type RoomStatus = 'ACTIVE' | 'UNDER_MAINTENANCE' | 'ARCHIVED';

/** STM-mrr-003's state labels, word for word. */
export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  ACTIVE: 'เปิดใช้งาน',
  UNDER_MAINTENANCE: 'ปิดปรับปรุง',
  ARCHIVED: 'เลิกใช้งาน (ลบ)',
};
