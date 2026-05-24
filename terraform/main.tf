terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.0, < 6.0"
    }
  }
  backend "gcs" {
    bucket = "lyric-video-generator-2026-tfstate"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ==============================================================================
# 1. Enable Required Google Cloud APIs
# ==============================================================================
variable "gcp_services" {
  type = list(string)
  default = [
    "run.googleapis.com",
    "firestore.googleapis.com",
    "storage.googleapis.com",
    "speech.googleapis.com",
    "aiplatform.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com"
  ]
}

resource "google_project_service" "enabled_apis" {
  for_each                   = toset(var.gcp_services)
  project                    = var.project_id
  service                    = each.key
  disable_dependent_services = false
  disable_on_destroy         = false
}

# ==============================================================================
# 2. Google Cloud Storage Bucket for Audio & Video Assets
# ==============================================================================
resource "google_storage_bucket" "assets_bucket" {
  name          = var.bucket_name
  location      = var.region
  force_destroy = false

  # Enable uniform bucket-level access (clean and standard)
  uniform_bucket_level_access = true

  # Set up CORS rules so browser audio/video players can stream GCS assets directly
  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "OPTIONS"]
    response_header = ["Content-Type", "Range"]
    max_age_seconds = 3600
  }

  depends_on = [google_project_service.enabled_apis]
}

# Make GCS bucket objects publicly readable by default (so browser players can fetch them)
resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.assets_bucket.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# Dedicated Private GCS Bucket for Cloud Build Staging
resource "google_storage_bucket" "build_staging_bucket" {
  name          = "${var.project_id}-cloudbuild-staging"
  location      = var.region
  force_destroy = true # Safe to purge staging files on destroy

  # Enable uniform bucket-level access (clean and standard)
  uniform_bucket_level_access = true

  # Keep it private
  public_access_prevention = "enforced"

  depends_on = [google_project_service.enabled_apis]
}

data "google_project" "project" {}

# Grant Storage Object Admin on the staging bucket to the Cloud Build service account
resource "google_storage_bucket_iam_member" "cloudbuild_staging_access" {
  bucket = google_storage_bucket.build_staging_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${data.google_project.project.number}@cloudbuild.gserviceaccount.com"
}

# Grant Storage Object Admin on the staging bucket to the Compute default service account (often used by Cloud Build)
resource "google_storage_bucket_iam_member" "compute_staging_access" {
  bucket = google_storage_bucket.build_staging_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}

# ==============================================================================
# 3. Google Cloud Firestore Database (Native Mode)
# ==============================================================================
resource "google_firestore_database" "default_db" {
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  # Firestore native mode database setup requires API enabled
  depends_on = [google_project_service.enabled_apis]
}

# ==============================================================================
# 4. Google Artifact Registry for storing Docker Images
# ==============================================================================
resource "google_artifact_registry_repository" "docker_repo" {
  location      = var.region
  repository_id = var.repository_id
  description   = "Docker repository for the Lyric Video Generator container images"
  format        = "DOCKER"

  depends_on = [google_project_service.enabled_apis]
}

# ==============================================================================
# 5. Granular IAM Service Account for Cloud Run Runner
# ==============================================================================
resource "google_service_account" "cloud_run_sa" {
  account_id   = "lyric-video-runner"
  display_name = "Lyric Video Generator Cloud Run Runner"
  description  = "Service account with minimum-privilege roles to run the Lyric Video Generator application."

  depends_on = [google_project_service.enabled_apis]
}

# Grant Datastore User (Firestore CRUD) to Service Account
resource "google_project_iam_member" "firestore_access" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Grant Vertex AI User to Service Account (for theme classifier)
resource "google_project_iam_member" "vertex_ai_access" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Grant Speech client (for lyric transcription) to Service Account
resource "google_project_iam_member" "speech_access" {
  project = var.project_id
  role    = "roles/speech.client"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Grant complete storage operations (create, view, delete) on our specific GCS Bucket to the Service Account
resource "google_storage_bucket_iam_member" "sa_bucket_access" {
  bucket = google_storage_bucket.assets_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}
