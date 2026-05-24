const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs');

const isProd = process.env.NODE_ENV === 'production';
const bucketName = process.env.GCS_BUCKET_NAME || 'lyric-video-generator-2026-assets';

let storageClient;
if (isProd) {
  console.log(`Initializing Google Cloud Storage for bucket: ${bucketName}...`);
  storageClient = new Storage({
    projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'lyric-video-generator-2026',
  });
}

/**
 * Uploads a local file to GCS (in production) or leaves it locally (in dev)
 * @param {string} localPath - Absolute path to local file
 * @param {string} folder - Folder name ('audio' or 'video')
 * @param {string} filename - Target filename
 * @returns {Promise<string>} File path/URL to be stored in the database
 */
async function uploadFile(localPath, folder, filename) {
  if (!fs.existsSync(localPath)) {
    throw new Error(`Local file not found at path: ${localPath}`);
  }

  if (isProd) {
    const destination = `${folder}/${filename}`;
    console.log(`Uploading local file ${localPath} to GCS bucket ${bucketName} at: ${destination}`);
    
    try {
      const bucket = storageClient.bucket(bucketName);
      
      // Get correct content-type
      let contentType = 'application/octet-stream';
      if (filename.endsWith('.mp3')) contentType = 'audio/mpeg';
      else if (filename.endsWith('.mp4')) contentType = 'video/mp4';

      await bucket.upload(localPath, {
        destination,
        metadata: {
          contentType,
          cacheControl: 'public, max-age=31536000',
        }
      });

      // Ensure the file is publicly readable so the browser can play it directly
      try {
        await bucket.file(destination).makePublic();
      } catch (aclErr) {
        console.warn(`Could not set public ACL for ${destination} (Fine if uniform bucket-level access is enabled):`, aclErr.message);
      }

      // Delete local temporary file
      try {
        fs.unlinkSync(localPath);
        console.log(`Successfully deleted local temporary file: ${localPath}`);
      } catch (err) {
        console.error(`Failed to delete local temporary file: ${localPath}`, err.message);
      }

      // Return direct GCS URL
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${destination}`;
      console.log(`GCS upload completed successfully. Public URL: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      console.error('Failed to upload file to GCS:', error);
      throw error;
    }
  } else {
    // In local development, the file is already at localPath on disk.
    // Return the local absolute path (as the existing code did).
    return localPath;
  }
}

/**
 * Deletes a file from GCS (in production) or local disk (in dev)
 * @param {string} filePath - Absolute path or GCS public URL of file
 */
async function deleteFile(filePath) {
  if (!filePath) return;

  if (isProd) {
    // Expecting URL format: https://storage.googleapis.com/bucket-name/folder/filename.ext
    const marker = `https://storage.googleapis.com/${bucketName}/`;
    if (!filePath.startsWith(marker)) {
      console.warn(`File path ${filePath} does not appear to be a GCS URL in bucket ${bucketName}. Skipping GCS deletion.`);
      return;
    }

    const relativePath = filePath.replace(marker, '');
    console.log(`Deleting file from GCS bucket ${bucketName}: ${relativePath}`);

    try {
      const bucket = storageClient.bucket(bucketName);
      await bucket.file(relativePath).delete();
      console.log(`Successfully deleted file from GCS: ${relativePath}`);
    } catch (err) {
      // If the file is already gone, log a warning but don't fail
      if (err.code === 404) {
        console.warn(`File not found on GCS for deletion: ${relativePath}`);
      } else {
        console.error(`Error deleting file ${relativePath} from GCS:`, err.message);
      }
    }
  } else {
    // Local mode deletion
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Successfully deleted local file: ${filePath}`);
      } catch (err) {
        console.error(`Failed to delete local file ${filePath}:`, err.message);
      }
    }
  }
}

module.exports = {
  uploadFile,
  deleteFile,
  isProd
};
