#!/bin/sh
# Volumes (server/data, server/.cache) können beim ersten Start leer sein. Die kleinen
# Grunddaten aus dem Image legt der Server dann selbst nach; die großen Datenbestände
# kommen per rsync (docs/deploy-dokploy.md).
set -e
for f in /app/seed-data/*; do
  [ -e "/app/server/data/$(basename "$f")" ] || cp "$f" /app/server/data/
done
exec node /app/server/index.mjs
