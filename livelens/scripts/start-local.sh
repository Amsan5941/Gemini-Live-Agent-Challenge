#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "${ROOT_DIR}/backend/.env" ]]; then
  cp "${ROOT_DIR}/backend/.env.example" "${ROOT_DIR}/backend/.env"
fi

if [[ ! -f "${ROOT_DIR}/frontend/.env.local" ]]; then
  cp "${ROOT_DIR}/frontend/.env.example" "${ROOT_DIR}/frontend/.env.local"
fi

if [[ ! -d "${ROOT_DIR}/backend/.venv" ]]; then
  python3 -m venv "${ROOT_DIR}/backend/.venv"
fi

source "${ROOT_DIR}/backend/.venv/bin/activate"
pip install --disable-pip-version-check -r "${ROOT_DIR}/backend/requirements.txt"
python -m playwright install chromium

echo "Starting backend on http://localhost:8000"
(
  cd "${ROOT_DIR}/backend"
  source .venv/bin/activate
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
) &
BACKEND_PID=$!

echo "Starting frontend on http://localhost:3000"
(
  cd "${ROOT_DIR}/frontend"
  npm install --no-audit --no-fund
  npm run dev
) &
FRONTEND_PID=$!

cleanup() {
  kill "${BACKEND_PID}" "${FRONTEND_PID}" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM
wait "${BACKEND_PID}" "${FRONTEND_PID}"
