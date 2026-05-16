#!/bin/bash
# Run once after first deploy to populate the database.
# In Railway: Settings → Deploy → Run Command, or via Railway CLI:
#   railway run bash scripts/seed-once.sh
set -e
npx prisma db seed
