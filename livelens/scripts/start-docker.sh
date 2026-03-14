#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "${ROOT_DIR}/backend/.env" ]]; then
  cp "${ROOT_DIR}/backend/.env.example" "${ROOT_DIR}/backend/.env"
fi

if [[ ! -f "${ROOT_DIR}/frontend/.env.local" ]]; then
  cp "${ROOT_DIR}/frontend/.env.example" "${ROOT_DIR}/frontend/.env.local"
fi

cd "${ROOT_DIR}"
docker compose up --build -d
docker compose ps

echo "LiveLens frontend: http://localhost:3000"
echo "LiveLens backend:  http://localhost:8000"
