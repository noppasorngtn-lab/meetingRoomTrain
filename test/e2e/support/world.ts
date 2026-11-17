import { readFileSync } from 'node:fs';
import { expect, request, type APIRequestContext } from '@playwright/test';

/** What global-setup wrote: user ids and room ids by key (see accounts.ts). */
export const world: { users: Record<string, { id: string; email: string }>; rooms: Record<string, string> } = JSON.parse(
  readFileSync('.auth/world.json', 'utf8'),
);

export const stateOf = (key: string) => (key === 'u1' ? '.auth/tester.json' : `.auth/${key}.json`);

/** An API client that carries one account's session — the browser's own cookie, without the page. */
export const as = (key: string): Promise<APIRequestContext> =>
  request.newContext({ baseURL: 'http://localhost:4173', storageState: stateOf(key) });

const pad = (n: number) => String(n).padStart(2, '0');
/**
 * A random hour 2-29 days ahead (the booking.spec cases use 30-730, and "my bookings" lists the latest start first, so
 * these stay at the end of the list). The E2E rooms keep their audited bookings for good, so the start also gets a random
 * minute (step 5) — a repeat run rarely lands on a slot an earlier run left.
 */
export function nearSlot(hour = 6 + Math.floor(Math.random() * 14)) {
  const d = new Date(Date.now() + (2 + Math.floor(Math.random() * 28)) * 86_400_000);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const mm = pad(5 * Math.floor(Math.random() * 12));
  return { date, startAt: `${date}T${pad(hour)}:${mm}:00+07:00`, endAt: `${date}T${pad(hour + 1)}:${mm}:00+07:00` };
}

/**
 * Books through the api as `who`. The E2E rooms keep earlier runs' bookings for good, so a slot can be taken: on
 * "room not free" the day is moved (same time of day) and `slot` is updated in place — callers that read it
 * afterwards see the slot that was really booked. Anything else that is not 201 fails the test.
 */
export async function book(
  who: APIRequestContext,
  room: string,
  slot: { startAt: string; endAt: string; date?: string },
  title: string,
  attendees: string[] = [world.users.ra1.id],
) {
  for (let attempt = 1; ; attempt++) {
    const res = await who.post('/bookings', {
      data: { roomId: world.rooms[room], startAt: slot.startAt, endAt: slot.endAt, title, attendeeIds: attendees, equipmentIds: [] },
    });
    if (res.status() === 409 && attempt < 10 && (await res.text()).includes('ไม่ว่าง')) {
      const day = new Date(Date.now() + (2 + Math.floor(Math.random() * 28)) * 86_400_000);
      const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
      slot.startAt = date + slot.startAt.slice(10);
      slot.endAt = date + slot.endAt.slice(10);
      slot.date = date;
      continue;
    }
    expect(res.status(), await res.text()).toBe(201);
    return (await res.json()) as { id: string; status: string; message: string };
  }
}
