#!/bin/sh
# Regenerates RUN_ALL.sql from the numbered files. Run after editing any of them.
cd "$(dirname "$0")"
{
  echo "-- ============================================================"
  echo "--  Okubu Momo — complete setup, generated from 01..05."
  echo "--  Do not edit: change the numbered files and run build-run-all.sh."
  echo "--  Paste this whole file into the Supabase SQL Editor and Run."
  echo "-- ============================================================"
  echo
  for f in 01_schema.sql 02_rls.sql 03_functions.sql 04_realtime.sql 05_seed.sql 06_categories.sql 07_deletes.sql 08_kitchen_routing.sql 09_settle_completes.sql 10_takeout.sql 11_payment_independent.sql; do
    echo; echo; cat "$f"
  done
} > RUN_ALL.sql
echo "RUN_ALL.sql regenerated ($(wc -l < RUN_ALL.sql) lines)"
