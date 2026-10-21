# Build context: the repo root — the theme is imported from .aeon/mockup/handoff, never copied (vite.config.ts).
FROM node:22-bookworm-slim
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci -w @mrr/web
COPY .aeon/mockup/handoff/mrr-ds .aeon/mockup/handoff/mrr-ds
COPY apps/web apps/web
RUN npm run build -w @mrr/web
WORKDIR /repo/apps/web
EXPOSE 4173
# vite preview inherits server.proxy, so one origin serves the pages and forwards the api paths to API_URL.
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "4173", "--strictPort"]
