# Load cases NFR-mrr-002 (TC-NFR-REQ001-104 / 105)

Staging-like stack on Docker — **not the real staging** (its address, owner and machine spec are still [TBD]).
Sizes (20 rooms, ~60% of one-hour slots taken for the week, API/DB limited to 1 CPU / 512 MB each) are QA assumptions [TBD].
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
