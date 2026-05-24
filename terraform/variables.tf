variable "project_id" {
  description = "The Google Cloud Project ID to provision resources in."
  type        = string
  default     = "lyric-video-generator-2026"
}

variable "region" {
  description = "The GCP region to deploy resources (e.g., Firestore, Cloud Run, Storage)."
  type        = string
  default     = "us-central1"
}

variable "bucket_name" {
  description = "The name of the GCS bucket to store audio and video assets."
  type        = string
  default     = "lyric-video-generator-2026-assets"
}

variable "repository_id" {
  description = "The Artifact Registry repository ID to store Docker images."
  type        = string
  default     = "lyric-video-generator"
}

variable "service_name" {
  description = "The name of the Cloud Run service."
  type        = string
  default     = "lyric-video-generator"
}
