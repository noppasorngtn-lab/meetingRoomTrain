import { execFileSync } from 'node:child_process';
import { expect, type APIRequestContext } from '@playwright/test';
import { world } from './world';

/**
 * Data for TC-BKG-UI004-101..103 (EX-mrr-106..108, room search) and TC-RMM-UI013-110..111 (EX-mrr-109..110, room delete)
 * — docs/qa/t1-test-cases.md §C.
 *
 * Fixed `E2E-SRCH-*` rooms, made through the admin API as ra1 and kept between runs (see `ensureRoom`).
 * A room for the delete cases (EX-109/110) must be new each run instead: ARCHIVED cannot be re-opened (STM-mrr-003).
 * Assert on these rooms by NAME only: the search shows every room of the system that fits, so never assert a full list.
 */
const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-c', sql], { encoding: 'utf8' }).trim();

export const SEARCH_ROOMS = {
  // EX-106: room A capacity 10 (shown) and room B capacity 4 (hidden for 6 attendees)
  a: { code: 'E2E-SRCH-A', name: 'E2E Search A', capacity: 10, requiresApproval: false },
  b: { code: 'E2E-SRCH-B', name: 'E2E Search B', capacity: 4, requiresApproval: false },
  // EX-108: room B holds a PENDING_APPROVAL booking, so it must be an approval room; room C is put under maintenance
  bPending: { code: 'E2E-SRCH-BP', name: 'E2E Search Pending', capacity: 10, requiresApproval: true },
  c: { code: 'E2E-SRCH-C', name: 'E2E Search Maintenance', capacity: 10, requiresApproval: false },
} as const;
export type SearchRoom = (typeof SEARCH_ROOMS)[keyof typeof SEARCH_ROOMS];

/** Status of a room by code ('' when there is none). */
export const roomStatus = (code: string) => psql(`select status from meeting_rooms where code = '${code}'`);

/**
 * Finds the fixture room by its code or creates it through API-021 as `admin` (ra1); returns its id. Idempotent, like
 * global-setup's E2E rooms: these rooms stay for good, because a room that ever held a booking or a maintenance period
 * cannot be removed by SQL (foreign keys — first smoke run, 2026-11-18). Their bookings are cancelled by global-setup
 * (titles start with E2E), which gives the slots back.
 */
export async function ensureRoom(admin: APIRequestContext, room: SearchRoom): Promise<string> {
  let id = psql(`select id from meeting_rooms where code = '${room.code}'`);
  if (!id) {
    const res = await admin.post('/rooms', {
      data: { code: room.code, name: room.name, capacity: room.capacity, photos: [], facilityIds: [], requiresApproval: room.requiresApproval, approverId: null },
    });
    expect(res.status(), await res.text()).toBeLessThan(300);
    id = psql(`select id from meeting_rooms where code = '${room.code}'`);
  }
  return id;
}

/** API-024 toggles ACTIVE ↔ UNDER_MAINTENANCE: brings the room to the wanted state (no call when it is there already). */
export async function setMaintenance(admin: APIRequestContext, code: string, roomId: string, wanted: 'ACTIVE' | 'UNDER_MAINTENANCE') {
  if (roomStatus(code) === wanted) return;
  const res = await admin.post(`/rooms/${roomId}/maintenance`);
  expect(res.status(), await res.text()).toBe(200);
  expect(((await res.json()) as { status: string }).status).toBe(wanted);
}

/** A booking as `who` on a room id, any status that holds the slot (CONFIRMED, or PENDING_APPROVAL on an approval room). */
export async function holdSlot(who: APIRequestContext, roomId: string, slot: { startAt: string; endAt: string }, title: string) {
  const res = await who.post('/bookings', {
    data: { roomId, startAt: slot.startAt, endAt: slot.endAt, title, attendeeIds: [world.users.ra1.id], equipmentIds: [] },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as { id: string; status: string };
}

/**
 * EX-mrr-107 "every room is taken or under maintenance" — OQ-T1-11 (2): every room of the SYSTEM, not only the fixture's.
 * Books every ACTIVE room for the slot (titles start with E2E, so global-setup cancels them next run). Rooms under
 * maintenance need nothing. Returns the number of rooms tried. Call it before the search, in the same test.
 */
export async function holdEveryRoom(who: APIRequestContext, slot: { startAt: string; endAt: string }) {
  const ids = psql("select id from meeting_rooms where status = 'ACTIVE'").split('\n').filter(Boolean);
  for (const id of ids) {
    const res = await who.post('/bookings', {
      data: { roomId: id, startAt: slot.startAt, endAt: slot.endAt, title: 'E2E BLOCK ALL', attendeeIds: [world.users.ra1.id], equipmentIds: [] },
    });
    // 409 "not free" = the slot is already held in that room, which is what this wants
    if (res.status() !== 409) expect(res.status(), await res.text()).toBe(201);
  }
  return ids.length;
}
