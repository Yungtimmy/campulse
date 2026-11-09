#!/usr/bin/env bash
# Apply every migration to a fresh database, then prove demo-u2 cannot read FUNAAB.
set -euo pipefail

DB="${CAMPULSE_TEST_DB:-campulse_test}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "drop database if exists ${DB};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "create database ${DB};"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$f")"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
done

echo "Running isolation test"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -f "$ROOT/supabase/tests/isolation.sql"
echo "isolation ok"
