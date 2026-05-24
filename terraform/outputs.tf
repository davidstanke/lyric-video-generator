output "project_id" {
  description = "The GCP Project ID."
  value       = var.project_id
}

output "region" {
  description = "The GCP region."
  value       = var.region
}

output "gcs_bucket_name" {
  description = "The name of the provisioned GCS Bucket."
  value       = google_storage_bucket.assets_bucket.name
}

output "gcs_bucket_url" {
  description = "The GCS URL of the provisioned assets bucket."
  value       = "gs://${google_storage_bucket.assets_bucket.name}"
}

output "artifact_registry_repo_url" {
  description = "The URL prefix of the Docker Artifact Registry."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.repository_id}"
}

output "service_account_email" {
  description = "The email address of the dedicated Cloud Run service account."
  value       = google_service_account.cloud_run_sa.email
}
