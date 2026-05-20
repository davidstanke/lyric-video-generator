require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const speech = require('@google-cloud/speech');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { generateSrt } = require('./utils/srtGenerator');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Ensure uploads and output directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

const upload = multer({ dest: 'uploads/' });

// Initialize Google Cloud Speech Client
// Requires GOOGLE_APPLICATION_CREDENTIALS environment variable
let speechClient;
try {
  speechClient = new speech.SpeechClient();
} catch (error) {
  console.warn("Google Cloud Speech client initialization failed. Ensure GOOGLE_APPLICATION_CREDENTIALS is set.", error.message);
}

app.post('/api/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    if (!speechClient) {
      return res.status(500).json({ error: 'Speech client not initialized. Check server configuration.' });
    }

    const filePath = req.file.path;
    const audioBytes = fs.readFileSync(filePath).toString('base64');

    const audio = {
      content: audioBytes,
    };
    
    // Configure based on MP3, typical settings
    const config = {
      encoding: 'MP3',
      sampleRateHertz: 44100, // May need dynamic detection if files vary
      languageCode: 'en-US',
      enableWordTimeOffsets: true,
    };

    const request = {
      audio: audio,
      config: config,
    };

    console.log(`Transcribing ${req.file.originalname}...`);
    const [response] = await speechClient.recognize(request);
    
    // Parse response into our manifest structure
    const manifest = [];
    let idCounter = 1;
    
    response.results.forEach((result) => {
      const alternative = result.alternatives[0];
      const wordsInfo = alternative.words;
      
      // Group words into segments (sentences/phrases). 
      // For simplicity, we can group them loosely based on pauses or just chunks.
      // Here, we'll create a single segment per result (often corresponds to a phrase/sentence)
      if (wordsInfo.length > 0) {
        const startTime = parseFloat(wordsInfo[0].startTime.seconds || 0) + 
                          (wordsInfo[0].startTime.nanos || 0) / 1e9;
        const endTime = parseFloat(wordsInfo[wordsInfo.length - 1].endTime.seconds || 0) + 
                        (wordsInfo[wordsInfo.length - 1].endTime.nanos || 0) / 1e9;
        
        manifest.push({
          id: idCounter++,
          startTime,
          endTime,
          text: alternative.transcript.trim(),
        });
      }
    });

    res.json({
      audioPath: filePath,
      manifest: manifest
    });

  } catch (error) {
    console.error('Error processing upload:', error);
    res.status(500).json({ error: 'Error processing upload', details: error.message });
  }
});

app.post('/api/render', async (req, res) => {
  try {
    const { audioPath, manifest } = req.body;
    
    if (!audioPath || !manifest) {
      return res.status(400).json({ error: 'Audio path and manifest are required' });
    }

    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ error: 'Audio file not found on server' });
    }

    const srtContent = generateSrt(manifest);
    const srtFilename = `subtitles_${Date.now()}.srt`;
    const srtPath = path.join(__dirname, 'uploads', srtFilename);
    fs.writeFileSync(srtPath, srtContent);

    const outputFilename = `lyric_video_${Date.now()}.mp4`;
    const outputPath = path.join(outputDir, outputFilename);

    console.log('Starting FFmpeg rendering...');

    // Need an absolute path for FFmpeg subtitles filter and we must escape backslashes on Windows, 
    // but on Linux we just need absolute path.
    const absoluteSrtPath = path.resolve(srtPath);

    ffmpeg()
      // Input 1: generate a solid background video, 720p, matching duration of audio
      .input('color=c=black:s=1280x720')
      .inputFormat('lavfi')
      // Input 2: the audio file
      .input(audioPath)
      // Stop encoding when the shortest stream ends (the audio)
      .outputOptions(['-shortest'])
      // Add subtitles
      // We must escape colons in the path for the subtitles filter if any exist, but on linux usually fine
      .videoFilters(`subtitles='${absoluteSrtPath}'`)
      .audioCodec('aac')
      .videoCodec('libx264')
      .on('end', () => {
        console.log('FFmpeg processing finished.');
        res.json({ 
          success: true, 
          videoUrl: `http://localhost:${port}/output/${outputFilename}`,
          videoPath: outputPath
        });
      })
      .on('error', (err) => {
        console.error('Error in FFmpeg processing:', err);
        res.status(500).json({ error: 'Error generating video', details: err.message });
      })
      .save(outputPath);

  } catch (error) {
    console.error('Error rendering video:', error);
    res.status(500).json({ error: 'Error rendering video', details: error.message });
  }
});

app.use('/output', express.static(path.join(__dirname, 'output')));

app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});
