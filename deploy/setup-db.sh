#!/bin/sh
# One-time, on the server: creates the saha_crm database + its own role in the existing PostgreSQL,
# and writes the connection settings to /root/containers/saha-crm/.env (readable by root only).
set -e
DIR=/root/containers/saha-crm
PG=${PG_CONTAINER:-postgres-db-postgres-1}
# Multi-company: the app role creates one database per company (idempotent, runs on every deploy)
grant_createdb() {
  docker exec -i "$PG" sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -qc "ALTER ROLE saha_crm CREATEDB"'
}
if [ -f "$DIR/.env" ]; then grant_createdb; echo "database already set up"; exit 0; fi
mkdir -p "$DIR"
DBPASS=$(openssl rand -hex 24)
JWT=$(openssl rand -hex 32)
docker exec -i "$PG" sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres' <<SQL
CREATE ROLE saha_crm LOGIN PASSWORD '$DBPASS';
CREATE DATABASE saha_crm OWNER saha_crm;
REVOKE ALL ON DATABASE saha_crm FROM PUBLIC;
SQL
grant_createdb
umask 077
cat > "$DIR/.env" <<ENV
DATABASE_URL=postgres://saha_crm:$DBPASS@$PG:5432/saha_crm
JWT_SECRET=$JWT
ENV
echo "database saha_crm + role created; settings written to $DIR/.env"
