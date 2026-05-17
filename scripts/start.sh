#!/bin/bash
set -e

echo ""
echo "========================================="
echo " Hospital 3 Colinas — Aquisições"
echo "========================================="
echo " Node.js : $(node --version)"
echo " Port    : ${PORT:-3000}"
echo " Env     : ${NODE_ENV:-production}"

# Validate DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo " [FATAL] DATABASE_URL is not set. Aborting."
  exit 1
fi
echo " DB      : ${DATABASE_URL%%@*}@..."

# Validate auth secret
SECRET="${AUTH_SECRET:-${NEXTAUTH_SECRET:-}}"
if [ -z "$SECRET" ]; then
  echo " [WARN]  AUTH_SECRET / NEXTAUTH_SECRET is not set. Auth will not work."
else
  echo " Auth    : secret is set (${#SECRET} chars)"
fi

echo ""
echo "--- [1/3] upload dir ---"
UPLOAD_DIR="${UPLOAD_DIR:-/data}"
mkdir -p "${UPLOAD_DIR}/uploads"
echo "    UPLOAD_DIR = ${UPLOAD_DIR}"
export UPLOAD_DIR

echo ""
echo "--- [2/4] prisma db push ---"
npx prisma db push --skip-generate
echo "    OK"

echo ""
echo "--- [3/5] download Drive PDFs (background) ---"
LOG_FILE="${UPLOAD_DIR}/download.log"
if [ -f "scripts/download-drive-files.js" ]; then
  node scripts/download-drive-files.js >> "${LOG_FILE}" 2>&1 &
  DOWNLOAD_PID=$!
  echo "    PID ${DOWNLOAD_PID} | log: ${LOG_FILE}"
else
  echo "    [SKIP] scripts/download-drive-files.js não encontrado"
fi

echo ""
echo "--- [4/5] alerta diário de entregas (background cron) ---"
ALERTAS_LOG="${UPLOAD_DIR}/alertas.log"
if [ -n "${CRON_SECRET:-}" ]; then
  (sleep 30 && curl -s -X POST "http://localhost:${PORT:-3000}/api/alertas" \
    -H "Authorization: Bearer ${CRON_SECRET}" >> "${ALERTAS_LOG}" 2>&1) &
  echo "    OK — disparará 30s após o servidor subir"
else
  echo "    [SKIP] CRON_SECRET não definido"
fi

echo ""
echo "--- [5/5] fetch FNS descriptives (background) ---"
FNS_LOG="${UPLOAD_DIR}/fns-fetch.log"
if [ -f "scripts/fetch-fns-descriptives.js" ]; then
  node scripts/fetch-fns-descriptives.js >> "${FNS_LOG}" 2>&1 &
  FNS_PID=$!
  echo "    PID ${FNS_PID} | log: ${FNS_LOG}"
else
  echo "    [SKIP] scripts/fetch-fns-descriptives.js não encontrado"
fi

echo ""
echo "--- [6/6] next start on port ${PORT:-3000} ---"
exec npx next start -p "${PORT:-3000}"
