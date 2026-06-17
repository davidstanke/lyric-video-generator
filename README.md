# Lyric Video Generator

An automated tool to generate lyric videos from audio and lyrics.

## Running Locally

### Prerequisites
1. **Node.js** (v20+)
2. **Google Cloud Service Account Key**:
   - Save your service account key (with **Cloud Speech-to-Text API** enabled) as `service-account-key.json` in the root folder.

### Run
Simply execute the startup script from the root directory:
```bash
./start.sh
```
*(Alternatively, run `npm start`). This script will automatically install dependencies, initialize the SQLite database, and launch the backend (port 3001) and frontend (port 5173).*

---

## Deploying to Google Cloud Agent Runtime (Cloud Run)

The repository includes a ready-to-use orchestrator script using Terraform and Cloud Build.

### Deploy
Run the deployment script from the root directory:
```bash
./deploy.sh
```
*This script will provision GCP resources using Terraform, build the container image with Google Cloud Build, and deploy it to Google Cloud Run.*
