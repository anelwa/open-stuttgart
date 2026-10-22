#!/bin/sh
# Datenbestände neu erzeugen, auf den Server spielen und die App neu starten
# (die Suchdatenbank wird nur beim Start geöffnet). Details: docs/deploy-dokploy.md
# Überschreibbar: HOST, SSH_KEY, APP_NAME
set -e
HOST=${HOST:-root@159.195.33.6}
SSH_KEY=${SSH_KEY:-$HOME/.ssh/id_brain_deploy}
APP_NAME=${APP_NAME:-app-generate-multi-byte-card-u2ylc7}

npm run data:verwaltung
npm run data:search

cd "$(dirname "$0")/../server"
tar czf - --exclude='*-wal' --exclude='*-shm' data \
  | ssh -i "$SSH_KEY" "$HOST" 'tar xzf - -C /opt/open-stuttgart && chown -R 1000:1000 /opt/open-stuttgart'
ssh -i "$SSH_KEY" "$HOST" "docker service update --force $APP_NAME"
echo "Daten übertragen, App neu gestartet."
