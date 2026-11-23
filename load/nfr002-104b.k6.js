// NFR-mrr-002 case TC-NFR-REQ001-104b: the SCREEN half of case 104 (PO accepted a browser sample in place of 200
// browsers, 2026-11-23). 200 users in one burst: USERS - PROBES of them call the calendar API (as in nfr002.k6.js),
// PROBES of them are real Chromium pages opening the weekly room calendar (UI-mrr-005) at the same instant.
//   pass = every API request <= 2 s AND every page shows its data (or the empty state) <= 2 s after navigation starts.
// "Data shown" (design answer for 104b, option A): the loading line "กำลังโหลดปฏิทิน…" (role=status) is gone and a slot
// [data-testid=ui-mrr-005-ent-007-start-at] or the empty text is on the page; role=alert (load failed) fails the probe.
// Timing: from page.goto() to the first animation frame where that holds, measured on the k6 side (includes a few ms of
// CDP round trip). Both scenarios are scheduled from the test start, so the pages and the API burst fire together
// at FIRE_AT_S; the probes launch Chromium before that and wait.
// Run (needs the web service of docker-compose.staging.yml and the browser image of k6):
//   docker run --rm -i --network mrr-staging_default -v "<repo>/load:/load" grafana/k6:2.4.0-with-browser run /load/nfr002-104b.k6.js
import http from 'k6/http';
import { browser } from 'k6/browser';
import { check } from 'k6';
import exec from 'k6/execution';
import { Counter, Trend } from 'k6/metrics';

const USERS = Number(__ENV.USERS || 200);
const PROBES = Number(__ENV.PROBES || 5);
const FIRE_AT_S = Number(__ENV.FIRE_AT_S || 8);
const API = __ENV.BASE_URL || 'http://api:3000';
const WEB = __ENV.WEB_URL || 'http://web:4173';
const seed = JSON.parse(open('/load/.seed.json'));
if (seed.tokens.length < USERS) throw new Error(`seed has ${seed.tokens.length} sessions, need ${USERS}`);

const screenReady = new Trend('screen_ready_ms', true);
const screenFailed = new Counter('screen_failed');

export const options = {
  scenarios: {
    api: { executor: 'per-vu-iterations', exec: 'api', vus: USERS - PROBES, iterations: 1, startTime: `${FIRE_AT_S}s`, maxDuration: '60s' },
    screen: {
      executor: 'per-vu-iterations', exec: 'screen', vus: PROBES, iterations: 1, maxDuration: `${FIRE_AT_S + 60}s`,
      options: { browser: { type: 'chromium' } },
    },
  },
  thresholds: {
    'http_req_duration{scenario:api}': ['max<2000'],
    'http_req_failed{scenario:api}': ['rate==0'],
    screen_ready_ms: ['max<2000'],
    screen_failed: ['count==0'],
    checks: ['rate==1'],
  },
};

export function api() {
  const i = exec.scenario.iterationInTest; // users 0 .. USERS-PROBES-1
  const room = seed.rooms[i % seed.rooms.length];
  const res = http.get(`${API}/rooms/${room}/calendar?view=week&date=${seed.date}`, {
    headers: { Cookie: `mrr_session=${seed.tokens[i]}` },
    timeout: '30s',
  });
  check(res, { 'api status 200': (r) => r.status === 200 });
}

export async function screen() {
  const i = USERS - PROBES + exec.scenario.iterationInTest; // users USERS-PROBES .. USERS-1
  const room = seed.rooms[i % seed.rooms.length];
  const context = await browser.newContext();
  await context.addCookies([{ name: 'mrr_session', value: seed.tokens[i], url: WEB }]);
  const page = await context.newPage();
  try {
    const wait = exec.scenario.startTime + FIRE_AT_S * 1000 - Date.now();
    if (wait < 0) throw new Error(`Chromium was not ready by FIRE_AT_S=${FIRE_AT_S}s - raise it`);
    await page.waitForTimeout(wait);
    const t0 = Date.now();
    await page.goto(`${WEB}/UI-mrr-005?room=${room}&view=week&date=${seed.date}`);
    // k6 browser's waitForFunction resolves without a usable handle, so the state is read once more after it settles.
    const stateOf = () => {
      if (document.querySelector('[role="alert"]')) return 'error';
      const loading = [...document.querySelectorAll('[role="status"]')].some((e) => e.textContent.includes('กำลังโหลดปฏิทิน'));
      if (loading) return null;
      if (document.querySelector('[data-testid="ui-mrr-005-ent-007-start-at"]')) return 'data';
      if (document.body.innerText.includes('ช่วงนี้ยังไม่มีการจอง')) return 'empty';
      return null;
    };
    await page.waitForFunction(stateOf, { polling: 'raf', timeout: 30000 });
    const ms = Date.now() - t0;
    const state = await page.evaluate(stateOf);
    screenReady.add(ms, { state });
    const ok = check(state, { 'screen shows data or empty': (s) => s === 'data' || s === 'empty' });
    if (!ok) screenFailed.add(1);
    console.log(`probe user ${i} room ${room}: ${state} in ${ms} ms`);
  } catch (e) {
    screenFailed.add(1);
    check(null, { 'screen shows data or empty': () => false });
    console.error(`probe user ${i}: ${e}`);
  } finally {
    await page.close();
    await context.close();
  }
}
