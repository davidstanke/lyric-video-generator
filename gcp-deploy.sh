#!/bin/bash
set -e

# ==============================================================================
# Configuration Variables
# ==============================================================================
PROJECT_ID="lyric-video-generator-2026"
REGION="us-central1"
SERVICE_NAME="lyric-video-generator"
BUCKET_NAME="lyric-video-generator-2026-assets"

echo -e "\033[1;36m======================================================================\033[0m"
echo -e "\033[1;36m🚀 Preparing Lyric Video Generator Deployment for $PROJECT_ID\033[0m"
echo -e "\033[1;36m======================================================================\033[0m"

# 1. Set the active gcloud project
echo -e "\n\033[1;33m--> Setting active Google Cloud Project...\033[0m"
gcloud config set project "$PROJECT_ID"

# 2. Enable necessary GCP Service APIs
echo -e "\n\033[1;33m--> Enabling required Google Cloud APIs...\033[0m"
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  speech.googleapis.com \
  aiplatform.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com

# 3. Create Google Cloud Storage Bucket for audio/video assets
echo -e "\n\033[1;33m--> Creating GCS bucket (if it does not exist)...\033[0m"
if ! gsutil ls -b "gs://$BUCKET_NAME" >/dev/null 2>&1; then
  gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://$BUCKET_NAME"
  echo -e "\033[1;32m✓ Created GCS bucket: gs://$BUCKET_NAME\033[0m"
else
  echo -e "\033[1;32m✓ GCS bucket gs://$BUCKET_NAME already exists.\033[0m"
fi

# 4. Set GCS CORS policy to allow direct browser streaming
echo -e "\n\033[1;33m--> Applying CORS policy to GCS bucket...\033[0m"
gsutil cors set cors-config.json "gs://$BUCKET_NAME"
echo -e "\033[1;32m✓ CORS policy applied successfully.\033[0m"

# 5. Initialize Firestore Database (if not already done)
echo -e "\n\033[1;33m--> Checking/Initializing Cloud Firestore database...\033[0m"
if ! gcloud firestore databases describe --database="(default)" >/dev/null 2>&1; then
  gcloud firestore databases create --location="$REGION" --type=firestore-native
  echo -e "\033[1;32m✓ Created Firestore database (default) in $REGION\033[0m"
else
  echo -e "\033[1;32m✓ Firestore database (default) already exists.\033[0m"
fi

# 6. Build container using Cloud Build and deploy to Cloud Run
echo -e "\n\033[1;33m--> Building container image with Cloud Build...\033[0m"
gcloud builds submit --tag "gcr.io/$PROJECT_ID/$SERVICE_NAME:latest"

echo -e "\n\033[1;33m--> Deploying to Google Cloud Run...\033[0m"
gcloud run deploy "$SERVICE_NAME" \
  --image "gcr.io/$PROJECT_ID/$SERVICE_NAME:latest" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,GCP_PROJECT_ID=$PROJECT_ID,GCS_BUCKET_NAME=$BUCKET_NAME"

echo -e "\n\033[1;32m======================================================================\033[0m"
echo -e "\033[1;32m🎉 Success! Lyric Video Generator is deployed to Google Cloud Run.\033[0m"
echo -e "\033[1;32m======================================================================\033[0m"
