#!/bin/bash
set -e

# ==============================================================================
# Lyric Video Generator — Terraform & Cloud Run Orchestration Script
# ==============================================================================

# ANSI colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[1;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================================${NC}"
echo -e "${BLUE}🚀 Initiating Orchestrated GCP Production Deployment with Terraform${NC}"
echo -e "${BLUE}======================================================================${NC}"

# Check for Terraform installation
if ! command -v terraform &> /dev/null; then
  echo -e "${RED}❌ Error: Terraform is not installed on this machine. Please install it first.${NC}"
  exit 1
fi

# Check for gcloud installation
if ! command -v gcloud &> /dev/null; then
  echo -e "${RED}❌ Error: Google Cloud SDK (gcloud) is not installed on this machine.${NC}"
  exit 1
fi

# 1. Bootstrap Remote State Bucket & Provision Infrastructure
STATE_BUCKET="lyric-video-generator-2026-tfstate"
PROJECT_ID="lyric-video-generator-2026"
REGION="us-central1"

echo -e "\n${YELLOW}--> Step 1: Checking remote state GCS bucket...${NC}"
if ! gcloud storage buckets describe "gs://${STATE_BUCKET}" --project "$PROJECT_ID" &> /dev/null; then
  echo -e "${YELLOW}Bucket gs://${STATE_BUCKET} does not exist. Creating it...${NC}"
  gcloud storage buckets create "gs://${STATE_BUCKET}" \
    --project "$PROJECT_ID" \
    --location "$REGION" \
    --uniform-bucket-level-access
  echo -e "${GREEN}✓ Remote state GCS bucket created.${NC}"
else
  echo -e "${GREEN}✓ Remote state GCS bucket already exists.${NC}"
fi

echo -e "\n${YELLOW}--> Step 2: Initializing and applying Terraform configuration...${NC}"
cd terraform

echo -e "${YELLOW}Running 'terraform init'...${NC}"
terraform init -reconfigure

echo -e "${YELLOW}Running 'terraform apply'...${NC}"
terraform apply -auto-approve

# 3. Extract Terraform State Outputs
echo -e "\n${YELLOW}--> Step 3: Extracting Terraform output variables...${NC}"
PROJECT_ID=$(terraform output -raw project_id)
REGION=$(terraform output -raw region)
BUCKET_NAME=$(terraform output -raw gcs_bucket_name)
REPO_URL=$(terraform output -raw artifact_registry_repo_url)
SA_EMAIL=$(terraform output -raw service_account_email)

echo -e "${GREEN}✓ Project ID:          ${PROJECT_ID}${NC}"
echo -e "${GREEN}✓ Region:              ${REGION}${NC}"
echo -e "${GREEN}✓ GCS Bucket:          ${BUCKET_NAME}${NC}"
echo -e "${GREEN}✓ Artifact Registry:   ${REPO_URL}${NC}"
echo -e "${GREEN}✓ Service Account:     ${SA_EMAIL}${NC}"

# Navigate back to root
cd ..

# 4. Build container with Google Cloud Build
IMAGE_TAG="${REPO_URL}/lyric-video-generator:latest"
echo -e "\n${YELLOW}--> Step 4: Triggering Cloud Build for container image...${NC}"
echo -e "${YELLOW}Building and pushing target: ${IMAGE_TAG}${NC}"
gcloud builds submit --project "$PROJECT_ID" --tag "$IMAGE_TAG" .

# 5. Deploy to Google Cloud Run
echo -e "\n${YELLOW}--> Step 5: Deploying Lyric Video Generator to Cloud Run...${NC}"
gcloud run deploy lyric-video-generator \
  --project "$PROJECT_ID" \
  --image "$IMAGE_TAG" \
  --platform managed \
  --region "$REGION" \
  --service-account "$SA_EMAIL" \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,GCP_PROJECT_ID=${PROJECT_ID},GCS_BUCKET_NAME=${BUCKET_NAME}"

echo -e "\n${GREEN}======================================================================${NC}"
echo -e "${GREEN}🎉 Success! App is live and fully provisioned with Terraform IaC.${NC}"
echo -e "${GREEN}======================================================================${NC}"
