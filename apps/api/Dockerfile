# Build context: the repo root (one package-lock.json for every workspace).
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w @mrr/api
COPY apps/api apps/api
RUN npm run build -w @mrr/api \
 && cp -r apps/api/src/common/database/migrations apps/api/dist/common/database/migrations

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w @mrr/api --omit=dev
COPY --from=build /repo/apps/api/dist apps/api/dist
WORKDIR /repo/apps/api
EXPOSE 3000
# Nothing in src applies the migrations at start-up, so the image does it before main.js;
# a failed migration exits non-zero and the container never reports healthy.
CMD ["node", "-e", "const {Kysely,PostgresDialect}=require('kysely');const {Pool}=require('pg');const {migrate}=require('./dist/common/database/migrate');const db=new Kysely({dialect:new PostgresDialect({pool:new Pool({connectionString:process.env.DATABASE_URL})})});migrate(db).then((a)=>{console.log('migrations applied: '+(a.join(', ')||'none'));return db.destroy();}).then(()=>require('./dist/main')).catch((e)=>{console.error(e);process.exit(1);});"]
