import { execFileSync } from 'node:child_process';
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
 * Hours already held in the next 31 days, in any room (read once, when the spec file is loaded — after global-setup has
 * given the old E2E hours back). `nearSlot` stays clear of them and of the slots it has handed out itself, so a slot
 * is free when the case uses it. That matters for cases that move the app's clock to just before the slot BEFORE
 * booking: if `book()` had to move the day afterwards, the clock would be left pointing at the wrong day.
 */
const taken: [number, number][] = (() => {
  try {
    const out = execFileSync(
      'docker',
      ['exec', 'mrr-db-1', 'psql', '-U', 'mrr', '-d', 'mrr', '-At', '-F', '|', '-c',
        "select (extract(epoch from start_at) * 1000)::bigint, (extract(epoch from end_at) * 1000)::bigint from bookings " +
          "where end_at > now() and start_at < now() + interval '31 days' and status in ('CONFIRMED', 'APPROVED', 'PENDING_APPROVAL')"],
      { encoding: 'utf8' },
    ).trim();
    return out ? out.split('\n').map((r) => r.split('|').map(Number) as [number, number]) : [];
  } catch {
    return []; // no docker here: fall back to random slots and `book()`'s retry
  }
})();
const clashes = (s: number, e: number) => taken.some(([ts, te]) => s < te && e > ts);

/**
 * A random hour 2-29 days ahead (the booking.spec cases use 30-730, and "my bookings" lists the latest start first, so
 * these stay at the end of the list), clear of every booking held now and of what this process already took. A repeat
 * run rarely lands on a slot an earlier run left even without that, because the start also gets a random minute (step 5).
 */
export function nearSlot(hour?: number, reserveHours = 1) {
  // `reserveHours` keeps the hours after the slot clear too, for a case that books or moves a second one later the same day.
  const span = (slot: { startAt: string }) => [Date.parse(slot.startAt), Date.parse(slot.startAt) + reserveHours * 3_600_000] as [number, number];
  let slot = pick(hour);
  for (let i = 0; i < 300 && clashes(...span(slot)); i++) slot = pick(hour);
  taken.push(span(slot));
  return slot;
}

function pick(hour = 6 + Math.floor(Math.random() * 14)) {
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
