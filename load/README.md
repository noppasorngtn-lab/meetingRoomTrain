# Load cases NFR-mrr-002 (TC-NFR-REQ001-104 / 105)

Staging-like stack on Docker — **not the real staging** (its address, owner and machine spec are still [TBD]).
Data size follows the design (`.aeon/design/nfr.json`, NFR-mrr-002 condition): 50 rooms, ~50,000 bookings over 2 years. The real staging has no data yet (PO 2026-11-23), so the data is simulated in two profiles, because the real booking density is unknown and per-room-week density is what moves the calendar API:

| `--profile` | slots | current week | bookings per room-week | total (measured 2026-11-23) |
|---|---|---|---|---|
| `normal` (default) | 1 hour | 60% full | ~33 | 49,669 |
| `dense` (worst case) | 30 minutes | 90% full | ~100 | 49,886 |

Run case 104 on both profiles. Before 2026-11-23 the seed drew whole days instead of single slots (random() in WHERE was pushed down to the day scan); no load run had been made on that data. API/DB limits (1 CPU / 512 MB each) are QA assumptions [TBD].
The design's NFR-002/004 text used to conflict with what req recorded (p95 vs every request; sustained 30 min vs one burst) - see docs/qa/req-design-request-nfr002-nfr004-conflict-2026-11-23.md. Design aligned `nfr.json` with req via ADR-014 (2026-11-23; re-signed by Noppasorn the same day). These scripts follow req.
Measure point = API response of `GET /rooms/:id/calendar?view=week` (Dev decision 2026-11-23); browser render time is not included.
The business measure point is the **screen** (owner answer 1a "the room table shows complete data" + design "on screen"), so case 104 at the API is **partial proof only** (Dev answer, item 2 of the conflict request).
**104b** (`load/nfr002-104b.k6.js`, first run 2026-11-23) - while the 200-request k6 burst runs, a few real browsers (Playwright, e.g. 5) open the weekly calendar and time until the slots or the empty state are shown; every probe must be <= 2 s. One k6 run holds both halves: 195 API users + 5 Chromium pages = 200 users, fired together at `FIRE_AT_S`. PO accepted the browser sample in place of 200 browsers (2026-11-23). Not blocked on design (an earlier note here said it was - wrong: testids are derived by mock, and design already declares the screen's states). "Data loaded" = the `role=status` loading line is gone and a slot (`ui-mrr-005-ent-007-start-at`) or the empty text is shown; `role=alert` fails the probe.

```bash
docker compose -f docker/docker-compose.staging.yml --env-file docker/.env up -d --build   # ports: api 3100
node load/seed-staging.mjs                  # users load001..201, rooms, bookings, sessions -> load/.seed.json (profile normal)
node load/seed-staging.mjs --profile dense  # worst-case density; re-seeding replaces the LOAD data
node load/seed-staging.mjs --sessions-only  # before every run: sessions idle out after 30 minutes
docker run --rm -i --network mrr-staging_default -v "<repo>/load:/load" -e VUS=200 -e MODE=104 grafana/k6 run /load/nfr002.k6.js
docker run --rm -i --network mrr-staging_default -v "<repo>/load:/load" -e VUS=201 -e MODE=105 grafana/k6 run /load/nfr002.k6.js
# 104b - the pages are opened by IP: vite preview answers 403 to the host name "web" (allowedHosts), and the app config is dev's
WEBIP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' mrr-staging-web-1)
node load/seed-staging.mjs --sessions-only
docker run --rm -i --network mrr-staging_default -v "<repo>/load:/load" -e WEB_URL=http://$WEBIP:4173 grafana/k6:2.4.0-with-browser run /load/nfr002-104b.k6.js
docker compose -f docker/docker-compose.staging.yml stop
```
Fonts are served by the app itself since 2026-11-23 (`@fontsource`, FE-mrr-022) - the page makes no internet request.
On Git Bash for Windows set `MSYS_NO_PATHCONV=1`. Resource limits: `STG_API_CPUS`, `STG_API_MEM`, `STG_DB_CPUS`, `STG_DB_MEM`.
A run on this stack does not prove the real staging or production meets NFR-mrr-002.
