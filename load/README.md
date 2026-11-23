# Load cases NFR-mrr-002 (TC-NFR-REQ001-104 / 105)

Staging-like stack on Docker — **not the real staging** (its address, owner and machine spec are still [TBD]).
Data size follows the design (`.aeon/design/nfr.json`, NFR-mrr-002 condition): 50 rooms, ~50,000 bookings over 2 years (seed: 50,400; current week 60% full). The real staging's size is [TBD]. API/DB limits (1 CPU / 512 MB each) are QA assumptions [TBD].
The design's NFR-002/004 text used to conflict with what req recorded (p95 vs every request; sustained 30 min vs one burst) - see docs/qa/req-design-request-nfr002-nfr004-conflict-2026-11-23.md. Design aligned `nfr.json` with req via ADR-014 (2026-11-23; re-signed by Noppasorn the same day). These scripts follow req.
Measure point = API response of `GET /rooms/:id/calendar?view=week` (Dev decision 2026-11-23); browser render time is not included.
The business measure point is the **screen** (owner answer 1a "the room table shows complete data" + design "on screen"), so case 104 at the API is **partial proof only** (Dev answer, item 2 of the conflict request).
Planned: **104b** - while the 200-request k6 burst runs, a few real browsers (Playwright, e.g. 5) open the weekly calendar and time until the slots or the empty state are shown; every probe must be <= 2 s. Not written yet. Blocked on: PO accepting a browser sample in place of 200 browsers, and design declaring a "data loaded" testid (gate 45).

```bash
docker compose -f docker/docker-compose.staging.yml --env-file docker/.env up -d --build   # ports: api 3100
node load/seed-staging.mjs                  # users load001..201, rooms, bookings, sessions -> load/.seed.json
node load/seed-staging.mjs --sessions-only  # before every run: sessions idle out after 30 minutes
docker run --rm -i --network mrr-staging_default -v "<repo>/load:/load" -e VUS=200 -e MODE=104 grafana/k6 run /load/nfr002.k6.js
docker run --rm -i --network mrr-staging_default -v "<repo>/load:/load" -e VUS=201 -e MODE=105 grafana/k6 run /load/nfr002.k6.js
docker compose -f docker/docker-compose.staging.yml stop
```
On Git Bash for Windows set `MSYS_NO_PATHCONV=1`. Resource limits: `STG_API_CPUS`, `STG_API_MEM`, `STG_DB_CPUS`, `STG_DB_MEM`.
A run on this stack does not prove the real staging or production meets NFR-mrr-002.
