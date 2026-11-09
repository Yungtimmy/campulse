#!/usr/bin/env bash
# Apply every migration to a fresh database, then prove a second university
# cannot read FUNAAB. Demo seed data is retired. supabase/tests/isolation.sql
# inserts throwaway fixtures in the same transaction and rolls them back.
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
