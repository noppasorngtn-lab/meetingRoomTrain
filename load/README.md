# Load cases NFR-mrr-002 (TC-NFR-REQ001-104 / 105)

Staging-like stack on Docker — **not the real staging** (its address, owner and machine spec are still [TBD]).
Data size follows the design (`.aeon/design/nfr.json`, NFR-mrr-002 condition): 50 rooms, ~50,000 bookings over 2 years (seed: 50,400; current week 60% full). The real staging's size is [TBD]. API/DB limits (1 CPU / 512 MB each) are QA assumptions [TBD].
The design's NFR-002/004 text conflicts with what req recorded (p95 vs every request; sustained 30 min vs one burst) - see docs/qa/req-design-request-nfr002-nfr004-conflict-2026-11-23.md. These scripts follow req.
Measure point = API response of `GET /rooms/:id/calendar?view=week` (Dev decision 2026-11-23); browser render time is not included.

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
