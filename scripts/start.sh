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
echo "--- [3/4] download Drive PDFs (background) ---"
LOG_FILE="${UPLOAD_DIR}/download.log"
# Só inicia se houver espaço e o script existir
if [ -f "scripts/download-drive-files.js" ]; then
  node scripts/download-drive-files.js >> "${LOG_FILE}" 2>&1 &
  DOWNLOAD_PID=$!
  echo "    PID ${DOWNLOAD_PID} | log: ${LOG_FILE}"
else
  echo "    [SKIP] scripts/download-drive-files.js não encontrado"
fi

echo ""
echo "--- [4/4] next start on port ${PORT:-3000} ---"
exec npx next start -p "${PORT:-3000}"
