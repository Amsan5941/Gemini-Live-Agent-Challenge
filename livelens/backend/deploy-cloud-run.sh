#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:?GOOGLE_CLOUD_PROJECT is required}"
SERVICE_NAME="${SERVICE_NAME:-livelens-backend}"
REGION="${REGION:-us-central1}"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

gcloud builds submit --tag "${IMAGE}"
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --set-env-vars APP_ENV=production

