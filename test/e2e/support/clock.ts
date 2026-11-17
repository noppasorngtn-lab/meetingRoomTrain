/**
 * The app's clock, moved for a test (OQ-T1-01). The api serves /__test/clock only when the dev stack sets
 * ENABLE_TEST_CONTROLS=true (docker/docker-compose.yml). It talks to the api directly (:3000) — the web
 * proxy only forwards the app's own prefixes. The clock then ticks on from the instant given; always put it
 * back (`resetClock`) — global-setup does too, in case a run stopped halfway.
 */
const API = 'http://localhost:3000';

async function post(now: string | null) {
  const res = await fetch(`${API}/__test/clock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ now }) });
  if (!res.ok) throw new Error(`/__test/clock answered ${res.status} — is the api running with ENABLE_TEST_CONTROLS=true?`);
  return (await res.json()) as { now: string; offsetMs: number };
}

/** Make the app read `at` (a Date or an ISO instant) as "now". */
export const setClock = (at: Date | string) => post(new Date(at).toISOString());
export const resetClock = () => post(null);

/**
 * Runs one reminder pass and one auto-cancel pass now, at the app's clock — the jobs the timers run, scoped to the
 * bookings whose title contains `titleContains` (/__test/jobs/run refuses to run without a scope). While the clock is
 * moved the timers stand still, so this is the only pass that happens.
 */
export async function runJobs(titleContains: string) {
  const res = await fetch(`${API}/__test/jobs/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ titleContains }) });
  if (!res.ok) throw new Error(`/__test/jobs/run answered ${res.status} ${await res.text()}`);
  return (await res.json()) as { now: string };
}
