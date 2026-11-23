// NFR-mrr-002 load cases against the room calendar API (GET /rooms/:id/calendar), the data behind the room table.
//   TC-NFR-REQ001-104: VUS=200  - every request must finish within 2 s (not p95, not the average)        [OQ 1a/1b/1d]
//   TC-NFR-REQ001-105: VUS=201  - system must not fall over: no 5xx/timeout, and healthy again afterwards [OQ 1c]
// Measure point = the API response (Dev decision 2026-11-23); browser render time is NOT included.
// Run (k6 in Docker, on the staging-like stack's network):
//   docker run --rm -i --network mrr-staging_default -v "<repo>/load:/load" -e VUS=200 -e MODE=104 grafana/k6 run /load/nfr002.k6.js
import http from 'k6/http';
import { check } from 'k6';

const VUS = Number(__ENV.VUS || 200);
const MODE = __ENV.MODE || '104';
const BASE = __ENV.BASE_URL || 'http://api:3000';
const seed = JSON.parse(open('/load/.seed.json'));

export const options = {
  // One shot: all VUs start together and each sends one request ("200 คนกดพร้อมกันครั้งเดียว").
  scenarios: { once: { executor: 'per-vu-iterations', vus: VUS, iterations: 1, maxDuration: '60s' } },
  thresholds:
    MODE === '104'
      ? { http_req_duration: ['max<2000'], http_req_failed: ['rate==0'], checks: ['rate==1'] }
      : { http_req_failed: ['rate==0'], checks: ['rate==1'] }, // 105: slower than 2 s is allowed; errors are not
};

export default function () {
  const i = __VU - 1;
  if (i >= seed.tokens.length) throw new Error(`seed has ${seed.tokens.length} sessions, need ${VUS} - re-run seed with --users ${VUS}`);
  const room = seed.rooms[i % seed.rooms.length];
  const res = http.get(`${BASE}/rooms/${room}/calendar?view=week&date=${seed.date}`, {
    headers: { Cookie: `mrr_session=${seed.tokens[i]}` },
    timeout: '30s',
  });
  check(res, { 'status 200': (r) => r.status === 200, 'has body': (r) => (r.body || '').length > 2 });
}

// 105: the service must be back to normal after the burst (/auth/me without a cookie answers 401 when Nest + DB are up).
export function teardown() {
  const r = http.get(`${BASE}/auth/me`, { responseCallback: http.expectedStatuses(401) }); // 401 is the healthy answer, not a failure
  check(r, { 'healthy after the burst (401 without cookie)': (x) => x.status === 401 });
}
