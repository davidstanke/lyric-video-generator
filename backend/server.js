require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const speech = require('@google-cloud/speech');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { generateAss } = require('./utils/assGenerator');
const { execSync } = require('child_process');
const { dbQuery, storageDir } = require('./database');
const { guessTitle } = require('./utils/metadata');
const { classifyLyrics } = require('./utils/themeClassifier');
const { alignLyrics, resolveManifestOverlaps } = require('./utils/lyricAligner');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Configure Multer to save audio to storage/audio/
const uploadStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(storageDir, 'audio'))
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({ storage: uploadStorage });

// Helper to get duration of audio
function getAudioDuration(filePath) {
  try {
    const output = execSync(`ffprobe -i "${filePath}" -show_entries format=duration -v quiet -of csv="p=0"`).toString();
    return parseFloat(output.trim());
  } catch (e) {
    console.error('Error getting duration:', e);
    return 55.0; // fallback
  }
}

// Automatically set GOOGLE_APPLICATION_CREDENTIALS if service-account-key.json is present in the parent folder
const keyPath = path.join(__dirname, '../service-account-key.json');
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(keyPath)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
  console.log(`--> Set GOOGLE_APPLICATION_CREDENTIALS to: ${keyPath}`);
}

// Initialize Google Cloud Speech Client
let speechClient;
try {
  speechClient = new speech.SpeechClient();
} catch (error) {
  console.warn("Google Cloud Speech client initialization failed. Ensure GOOGLE_APPLICATION_CREDENTIALS is set.", error.message);
}

// Helper to determine if speech transcription is configured
function isSpeechConfigured() {
  if (!speechClient) return false;
  const keyPath = path.join(__dirname, '../service-account-key.json');
  const envKeyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasCredentials = !!(envKeyPath && fs.existsSync(envKeyPath)) || fs.existsSync(keyPath);
  return hasCredentials;
}

// REST ENDPOINTS

// 0. GET /api/config - Check application configuration status
app.get('/api/config', (req, res) => {
  res.json({
    speechConfigured: isSpeechConfigured()
  });
});

// 1. GET /api/projects - List all projects
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await dbQuery.all('SELECT id, name, audio_path, video_path, created_at, updated_at FROM projects ORDER BY created_at DESC');
    
    // Format response to provide relative URLs for video_path and audio_path
    const formattedProjects = projects.map(p => ({
      ...p,
      audioUrl: `/audio/${path.basename(p.audio_path)}`,
      videoUrl: p.video_path ? `/output/${path.basename(p.video_path)}` : null
    }));
    
    res.json(formattedProjects);
  } catch (error) {
    console.error('Error listing projects:', error);
    res.status(500).json({ error: 'Failed to retrieve projects' });
  }
});

// 2. GET /api/projects/:id - Get specific project details
app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await dbQuery.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({
      ...project,
      manifest: JSON.parse(project.manifest),
      audioUrl: `/audio/${path.basename(project.audio_path)}`,
      videoUrl: project.video_path ? `/output/${path.basename(project.video_path)}` : null
    });
  } catch (error) {
    console.error('Error retrieving project:', error);
    res.status(500).json({ error: 'Failed to retrieve project details' });
  }
});

// 2b. POST /api/projects/probe - Probe metadata of uploaded audio file
app.post('/api/projects/probe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const { guessedTitle, duration } = guessTitle(req.file.path, req.file.originalname);

    res.json({
      tempPath: req.file.path,
      originalName: req.file.originalname,
      guessedTitle,
      duration
    });
  } catch (error) {
    console.error('Error probing metadata:', error);
    res.status(500).json({ error: 'Failed to probe audio file metadata' });
  }
});

// 3. POST /api/projects - Create a new project (Upload & Transcribe)
app.post('/api/projects', async (req, res) => {
  let chunksDir = null;
  try {
    const { tempPath, title, lyrics, autoAlign } = req.body;
    if (!tempPath || !fs.existsSync(tempPath)) {
      return res.status(400).json({ error: 'Valid temporary audio file path is required' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Song title is required' });
    }

    const sanitizedTitle = title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const cleanTitle = sanitizedTitle || 'untitled_track';
    const ext = path.extname(tempPath).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const newFilename = `${cleanTitle}-${uniqueSuffix}${ext}`;
    const newFilePath = path.join(path.dirname(tempPath), newFilename);

    try {
      fs.renameSync(tempPath, newFilePath);
    } catch (renameErr) {
      console.error('Error renaming temporary audio file:', renameErr);
      return res.status(500).json({ error: 'Failed to organize audio file on disk', details: renameErr.message });
    }

    let filePath = newFilePath;
    const originalExt = path.extname(filePath).toLowerCase();

    // If the file is not an MP3, transcode it to MP3
    if (originalExt !== '.mp3') {
      const mp3Path = filePath.replace(path.extname(filePath), '.mp3');
      console.log(`Transcoding non-MP3 file (${originalExt}) to MP3: ${mp3Path}`);
      try {
        execSync(`ffmpeg -i "${filePath}" -codec:a libmp3lame -qscale:a 2 "${mp3Path}"`);
        // Delete original non-MP3 file immediately
        try { fs.unlinkSync(filePath); } catch (e) {}
        filePath = mp3Path;
      } catch (transcodeErr) {
        console.error('Transcoding to MP3 failed:', transcodeErr);
        // Clean up original uploaded file on error
        try { fs.unlinkSync(filePath); } catch (e) {}
        return res.status(500).json({ error: 'Failed to process audio format', details: transcodeErr.message });
      }
    }

    const totalDuration = getAudioDuration(filePath);
    console.log(`Processing file: ${title} (Duration: ${totalDuration.toFixed(1)}s)`);

    let manifest = [];
    let idCounter = 1;
    let transcriptionStatus = 'success';

    const hasLyrics = typeof lyrics === 'string' && lyrics.trim().length > 0;
    const shouldTranscribe = !hasLyrics || (autoAlign && isSpeechConfigured());

    if (shouldTranscribe && !isSpeechConfigured()) {
      try { fs.unlinkSync(filePath); } catch (e) {}
      return res.status(400).json({
        error: 'MissingCredentials',
        message: 'Google Cloud Service Account key is missing or invalid. Automatic lyric generation is unavailable.'
      });
    }

    const allTranscribedWords = [];

    if (shouldTranscribe) {
      try {
        if (totalDuration <= 59.0) {
          // Short audio: transcribe directly
          const audioBytes = fs.readFileSync(filePath).toString('base64');
          const audio = { content: audioBytes };
          const config = {
            encoding: 'MP3',
            sampleRateHertz: 44100,
            languageCode: 'en-US',
            enableWordTimeOffsets: true,
          };

          console.log(`Transcribing ${title} directly...`);
          const [response] = await speechClient.recognize({ audio, config });
          
          response.results.forEach((result) => {
            const alternative = result.alternatives[0];
            const wordsInfo = alternative.words;
            if (wordsInfo && wordsInfo.length > 0) {
              // Collect word level offsets
              wordsInfo.forEach(w => {
                const start = parseFloat(w.startTime.seconds || 0) + (w.startTime.nanos || 0) / 1e9;
                const end = parseFloat(w.endTime.seconds || 0) + (w.endTime.nanos || 0) / 1e9;
                allTranscribedWords.push({
                  word: w.word,
                  startTime: start,
                  endTime: end
                });
              });

              if (!hasLyrics) {
                const startTime = parseFloat(wordsInfo[0].startTime.seconds || 0) + (wordsInfo[0].startTime.nanos || 0) / 1e9;
                const endTime = parseFloat(wordsInfo[wordsInfo.length - 1].endTime.seconds || 0) + (wordsInfo[wordsInfo.length - 1].endTime.nanos || 0) / 1e9;
                manifest.push({
                  id: idCounter++,
                  startTime,
                  endTime,
                  text: alternative.transcript.trim(),
                });
              }
            }
          });
        } else {
          // Long audio: chunk using FFmpeg first
          chunksDir = path.join(storageDir, 'audio', `chunks_${Date.now()}`);
          fs.mkdirSync(chunksDir);

          console.log(`Splitting audio into chunks...`);
          execSync(`ffmpeg -i "${filePath}" -f segment -segment_time 50 -c copy "${chunksDir}/chunk_%03d.mp3"`);

          const chunkFiles = fs.readdirSync(chunksDir)
            .filter(file => file.startsWith('chunk_') && file.endsWith('.mp3'))
            .sort();

          console.log(`Created ${chunkFiles.length} chunks. Transcribing sequentially...`);
          
          let cumulativeTime = 0;

          for (const file of chunkFiles) {
            const chunkPath = path.join(chunksDir, file);
            const audioBytes = fs.readFileSync(chunkPath).toString('base64');
            const audio = { content: audioBytes };
            const config = {
              encoding: 'MP3',
              sampleRateHertz: 44100,
              languageCode: 'en-US',
              enableWordTimeOffsets: true,
            };

            console.log(`Transcribing chunk: ${file}`);
            const [response] = await speechClient.recognize({ audio, config });

            response.results.forEach((result) => {
              const alternative = result.alternatives[0];
              const wordsInfo = alternative.words;
              if (wordsInfo && wordsInfo.length > 0) {
                // Collect word level offsets
                wordsInfo.forEach(w => {
                  const start = parseFloat(w.startTime.seconds || 0) + (w.startTime.nanos || 0) / 1e9;
                  const end = parseFloat(w.endTime.seconds || 0) + (w.endTime.nanos || 0) / 1e9;
                  allTranscribedWords.push({
                    word: w.word,
                    startTime: start + cumulativeTime,
                    endTime: end + cumulativeTime
                  });
                });

                if (!hasLyrics) {
                  const startTime = parseFloat(wordsInfo[0].startTime.seconds || 0) + (wordsInfo[0].startTime.nanos || 0) / 1e9;
                  const endTime = parseFloat(wordsInfo[wordsInfo.length - 1].endTime.seconds || 0) + (wordsInfo[wordsInfo.length - 1].endTime.nanos || 0) / 1e9;
                  manifest.push({
                    id: idCounter++,
                    startTime: startTime + cumulativeTime,
                    endTime: endTime + cumulativeTime,
                    text: alternative.transcript.trim(),
                  });
                }
              }
            });

            // Add chunk duration to cumulativeTime
            const duration = getAudioDuration(chunkPath);
            cumulativeTime += duration;

            // Clean up chunk file
            try { fs.unlinkSync(chunkPath); } catch (e) {}
          }
        }
      } catch (transcribeError) {
        console.error("Transcription error encountered, falling back to manual mode:", transcribeError.message);
        transcriptionStatus = 'manual';
        manifest = [];
      }
    }

    if (hasLyrics) {
      const pastedLines = lyrics.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      let alignedManifest = null;
      
      if (autoAlign && isSpeechConfigured() && allTranscribedWords.length > 0) {
        alignedManifest = alignLyrics(pastedLines, allTranscribedWords);
      }

      if (alignedManifest) {
        manifest = alignedManifest;
        transcriptionStatus = 'success';
      } else {
        console.log("Using manual alignment with clean slate of 0.0 timings.");
        transcriptionStatus = 'manual';
        manifest = pastedLines.map((line, idx) => ({
          id: idx + 1,
          startTime: 0.0,
          endTime: 0.0,
          text: line
        }));
      }
    } else if (transcriptionStatus === 'manual' || manifest.length === 0) {
      // Fallback: Create a single skeleton lyric segment
      manifest = [{
        id: idCounter++,
        startTime: 0.0,
        endTime: Math.min(10.0, totalDuration),
        text: "[Enter lyrics here]"
      }];
    }
    manifest = resolveManifestOverlaps(manifest);

    const projectName = title.trim();
    
    // Determine suggested thematic background color using lyrics analysis
    let suggestedColor = '#0f111a';
    try {
      const themeResult = await classifyLyrics(manifest);
      suggestedColor = themeResult.backgroundColor || '#0f111a';
    } catch (themeError) {
      console.error('Failed to classify lyrics:', themeError);
    }

    // Save project in SQLite database
    const insertResult = await dbQuery.run(
      'INSERT INTO projects (name, audio_path, manifest, background_color) VALUES (?, ?, ?, ?)',
      [projectName, filePath, JSON.stringify(manifest), suggestedColor]
    );

    res.json({
      id: insertResult.id,
      name: projectName,
      audioPath: filePath,
      manifest: manifest,
      transcriptionStatus: transcriptionStatus,
      backgroundColor: suggestedColor
    });

  } catch (error) {
    console.error('Error processing upload:', error);
    res.status(500).json({ error: 'Error processing upload', details: error.message });
  } finally {
    // Ensure cleanup of chunks folder
    if (chunksDir && fs.existsSync(chunksDir)) {
      try {
        const files = fs.readdirSync(chunksDir);
        for (const file of files) {
          fs.unlinkSync(path.join(chunksDir, file));
        }
        fs.rmdirSync(chunksDir);
      } catch (e) {
        console.error('Cleanup of chunks directory failed:', e);
      }
    }
  }
});

// 4. PUT /api/projects/:id/manifest - Save updated manifest
app.put('/api/projects/:id/manifest', async (req, res) => {
  try {
    const { manifest } = req.body;
    if (!manifest) {
      return res.status(400).json({ error: 'Manifest is required' });
    }

    // Check project exists
    const project = await dbQuery.get('SELECT id FROM projects WHERE id = ?', [req.params.id]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const resolvedManifest = resolveManifestOverlaps(manifest);

    await dbQuery.run(
      'UPDATE projects SET manifest = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(resolvedManifest), req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating manifest:', error);
    res.status(500).json({ error: 'Failed to update manifest' });
  }
});

// 4b. PUT /api/projects/:id/rename - Rename project
app.put('/api/projects/:id/rename', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    // Check project exists
    const project = await dbQuery.get('SELECT id FROM projects WHERE id = ?', [req.params.id]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await dbQuery.run(
      'UPDATE projects SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name.trim(), req.params.id]
    );

    res.json({ success: true, name: name.trim() });
  } catch (error) {
    console.error('Error renaming project:', error);
    res.status(500).json({ error: 'Failed to rename project' });
  }
});

// 4c. PUT /api/projects/:id/background-color - Update background color
app.put('/api/projects/:id/background-color', async (req, res) => {
  try {
    const { backgroundColor } = req.body;
    if (!backgroundColor || !backgroundColor.trim()) {
      return res.status(400).json({ error: 'Background color is required' });
    }

    // Check project exists
    const project = await dbQuery.get('SELECT id FROM projects WHERE id = ?', [req.params.id]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await dbQuery.run(
      'UPDATE projects SET background_color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [backgroundColor.trim(), req.params.id]
    );

    res.json({ success: true, backgroundColor: backgroundColor.trim() });
  } catch (error) {
    console.error('Error updating background color:', error);
    res.status(500).json({ error: 'Failed to update background color' });
  }
});

// 5. POST /api/projects/:id/render - Render video
app.post('/api/projects/:id/render', async (req, res) => {
  try {
    const project = await dbQuery.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const audioPath = project.audio_path;
    const manifest = JSON.parse(project.manifest);

    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ error: 'Audio file not found on disk' });
    }

    const assContent = generateAss(manifest, project.name);
    const assFilename = `subtitles_${Date.now()}.ass`;
    const assPath = path.join(storageDir, 'subtitles', assFilename);
    fs.writeFileSync(assPath, assContent);

    const sanitizedTitle = project.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const cleanTitle = sanitizedTitle || 'lyric_video';
    const outputFilename = `${cleanTitle}_${Date.now()}.mp4`;
    const outputPath = path.join(storageDir, 'video', outputFilename);

    console.log('Starting FFmpeg rendering...');

    const absoluteAssPath = path.resolve(assPath);
    const absoluteFontsDir = path.resolve(__dirname, '..', 'resources', 'fonts');

    const escapedAssPath = absoluteAssPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    const escapedFontsDir = absoluteFontsDir.replace(/\\/g, '/').replace(/:/g, '\\:');

    const command = ffmpeg();

    // Bypass fluent-ffmpeg capability check for the lavfi virtual device/format
    const originalAvailableFormats = command.availableFormats;
    command.availableFormats = function(cb) {
      originalAvailableFormats.call(this, (err, formats) => {
        if (err) return cb(err);
        formats = formats || {};
        formats.lavfi = { canDemux: true, canMux: true, description: 'lavfi virtual device' };
        cb(null, formats);
      });
    };

    const rawBgColor = project.background_color || '#0f111a';
    const cleanBgColor = rawBgColor.startsWith('#') ? rawBgColor.replace('#', '0x') : rawBgColor;
    console.log(`Rendering video with background color: ${rawBgColor} (${cleanBgColor})`);

    command
      .input(`color=c=${cleanBgColor}:s=1280x720`)
      .inputFormat('lavfi')
      .input(audioPath)
      .outputOptions(['-shortest'])
      .videoFilters(`subtitles='${escapedAssPath}':fontsdir='${escapedFontsDir}'`)
      .audioCodec('aac')
      .videoCodec('libx264')
      .on('end', async () => {
        console.log('FFmpeg processing finished.');
        
        // Save output path to database
        await dbQuery.run(
          'UPDATE projects SET video_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [outputPath, req.params.id]
        );

        // Delete temporary subtitle file
        try { fs.unlinkSync(assPath); } catch (e) {}

        res.json({ 
          success: true, 
          videoUrl: `/output/${outputFilename}`,
          videoPath: outputPath
        });
      })
      .on('error', (err) => {
        console.error('Error in FFmpeg processing:', err);
        try { fs.unlinkSync(assPath); } catch (e) {}
        res.status(500).json({ error: 'Error generating video', details: err.message });
      })
      .save(outputPath);

  } catch (error) {
    console.error('Error rendering video:', error);
    res.status(500).json({ error: 'Error rendering video', details: error.message });
  }
});

// 6. DELETE /api/projects/:id - Delete project and files
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const project = await dbQuery.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Delete audio file
    if (project.audio_path && fs.existsSync(project.audio_path)) {
      try { fs.unlinkSync(project.audio_path); } catch (e) { console.error('Failed to delete audio file:', e.message); }
    }

    // Delete video file
    if (project.video_path && fs.existsSync(project.video_path)) {
      try { fs.unlinkSync(project.video_path); } catch (e) { console.error('Failed to delete video file:', e.message); }
    }

    // Delete database entry
    await dbQuery.run('DELETE FROM projects WHERE id = ?', [req.params.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Expose static files from storage directory
app.use('/output', express.static(path.join(storageDir, 'video')));
app.use('/audio', express.static(path.join(storageDir, 'audio')));

app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});
