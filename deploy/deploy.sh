#!/bin/sh
# Build locally, upload, and (re)start on the server.  Usage: sh deploy/deploy.sh
set -e
cd "$(dirname "$0")/.."
# Server settings live in deploy/deploy.env (not committed). See deploy/deploy.env.example.
[ -f deploy/deploy.env ] && . deploy/deploy.env
: "${SERVER:?Set SERVER (e.g. root@your-server) in deploy/deploy.env}"
DIR=${DIR:-/root/containers/saha-crm}
npm run build
ssh "$SERVER" "mkdir -p $DIR/api"
ssh "$SERVER" "sh -s" < deploy/setup-db.sh
rsync -az --delete dist/ "$SERVER:$DIR/dist/"
rsync -az --delete --exclude node_modules --exclude .env server/ "$SERVER:$DIR/api/"
rsync -az deploy/nginx.conf deploy/Dockerfile.static "$SERVER:$DIR/"
rsync -az deploy/docker-compose.server.yml "$SERVER:$DIR/docker-compose.yml"
ssh "$SERVER" "cd $DIR && docker compose up -d --build --remove-orphans && docker image prune -f >/dev/null"
echo "Deployed."
