# Open Stuttgart: Build der Oberfläche und schlankes Laufzeit-Image für Dokploy.
# Die Datenbestände (server/data) und der Zwischenspeicher (server/.cache) kommen
# als Volumes ins Image, siehe docs/deploy-dokploy.md.

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8787
WORKDIR /app
COPY server ./server
# Kontakt-Synonyme werden zur Laufzeit aus src/data gelesen (server/sources/kontakte.mjs).
COPY src/data ./src/data
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
# Grunddaten (venues.json, iris-codes.json, feste-maerkte.json, …) überleben ein leeres Volume:
# sie liegen als seed-data im Image und werden vom Einstiegsskript nachgelegt.
RUN cp -r server/data /app/seed-data \
  && mkdir -p server/data server/.cache \
  && chown -R node:node /app \
  && chmod +x /app/docker-entrypoint.sh
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["/app/docker-entrypoint.sh"]
