const fs = require('fs');
const path = require('path');

let projectId = null;
let aiModel = null;

// Self-detect GCP Project ID from service-account-key.json
try {
  const keyPath = path.join(__dirname, '..', '..', 'service-account-key.json');
  if (fs.existsSync(keyPath)) {
    const keyData = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    projectId = keyData.project_id;
    console.log(`--> Theme Classifier detected GCP Project ID: ${projectId}`);
  }
} catch (e) {
  console.warn('Error reading project ID from service-account-key.json:', e.message);
}

// Initialize Vertex AI if project ID is resolved
if (projectId) {
  try {
    const { VertexAI } = require('@google-cloud/vertexai');
    const vertexAI = new VertexAI({ project: projectId, location: 'us-central1' });
    aiModel = vertexAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });
    console.log('--> Successfully initialized Vertex AI Generative Model.');
  } catch (err) {
    console.warn('Vertex AI SDK initialization failed:', err.message);
  }
}

/**
 * Classifies lyrical content and suggests a suitable dark, high-contrast background color.
 * Uses Gemini as primary strategy, and falling back to local heuristic mapping if unavailable.
 * 
 * @param {Array} manifest - Array of lyric segments [{text, startTime, endTime}]
 * @returns {Promise<Object>} { backgroundColor, themeName, explanation }
 */
async function classifyLyrics(manifest) {
  if (!manifest || manifest.length === 0) {
    return { backgroundColor: '#0f111a', themeName: 'Space Indigo', explanation: 'Default Elegant Theme' };
  }

  const lyricText = manifest.map(seg => seg.text).join(' ').trim();
  if (!lyricText || lyricText === '[Enter lyrics here]') {
    return { backgroundColor: '#0f111a', themeName: 'Space Indigo', explanation: 'Default Elegant Theme' };
  }

  // Curated premium preset themes
  const presets = {
    indigo: { backgroundColor: '#0f111a', themeName: 'Space Indigo', explanation: 'Elegant deep violet/indigo theme' },
    black: { backgroundColor: '#000000', themeName: 'Obsidian Black', explanation: 'Classic pure black theme' },
    navy: { backgroundColor: '#0b1528', themeName: 'Midnight Navy', explanation: 'Moody deep sea blue theme' },
    crimson: { backgroundColor: '#2a080c', themeName: 'Burgundy Wine', explanation: 'Intense deep crimson theme' },
    forest: { backgroundColor: '#021b11', themeName: 'Forest Zen', explanation: 'Dark organic green theme' },
    plum: { backgroundColor: '#1d0d24', themeName: 'Plum Dream', explanation: 'Rich mysterious plum purple theme' }
  };

  // 1. Primary AI Strategy: Google Gemini
  if (aiModel) {
    try {
      const prompt = `You are a professional lyric visualizer and styling designer.
Analyze the following song lyrics and suggest a single dark background color in HEX format that is highly thematically appropriate (e.g., moody, deep crimson, deep ocean blue, forest green, purple plum, etc.) based on the emotional, semantic, and imagery content.

CRITICAL RULE: The background color is used as a background for white subtitle text. Therefore, the color MUST be an extremely dark, low-luminance shade (hex brightness/luminance must be below 20%) to ensure that white subtitle text rendered on top remains perfectly readable, high-contrast, and web-accessible.

Return a JSON object in this exact schema:
{
  "backgroundColor": "#HEXCODE",
  "themeName": "A descriptive name of the theme style",
  "explanation": "A one-sentence explanation of why this color fits the song's lyrics"
}

Lyrics to analyze:
"${lyricText.substring(0, 3000)}"`;

      console.log('Sending lyrics to Gemini for thematic background classification...');
      const response = await aiModel.generateContent(prompt);
      const responseText = response.response.candidates[0].content.parts[0].text;
      
      const data = JSON.parse(responseText);
      if (data && data.backgroundColor && /^#[0-9a-fA-F]{6}$/.test(data.backgroundColor)) {
        console.log(`Gemini suggested color: ${data.backgroundColor} ("${data.themeName}") - ${data.explanation}`);
        return {
          backgroundColor: data.backgroundColor,
          themeName: data.themeName,
          explanation: data.explanation
        };
      }
    } catch (apiError) {
      console.warn('Gemini API classification failed, resorting to local fallback:', apiError.message);
    }
  }

  // 2. Fallback Heuristic Matcher: Local keyword scorer
  console.log('Running local regex-based keyword density classifier...');
  const textLower = lyricText.toLowerCase();

  const countWordMatches = (wordArray) => {
    let score = 0;
    wordArray.forEach(word => {
      const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
      const matches = textLower.match(regex);
      if (matches) {
        score += matches.length;
      }
    });
    return score;
  };

  const scores = {
    navy: countWordMatches(['blue', 'water', 'ocean', 'rain', 'cry', 'tears', 'cold', 'winter', 'ice', 'snow', 'sea', 'river', 'drown', 'sky', 'deep', 'wave', 'storm', 'ship', 'boat', 'lake', 'wet', 'pour', 'freeze']),
    crimson: countWordMatches(['fire', 'red', 'burn', 'blood', 'hot', 'flame', 'heat', 'warm', 'summer', 'hate', 'anger', 'passion', 'kill', 'devil', 'war', 'fight', 'bullet', 'gun', 'blaze', 'fever', 'hell']),
    forest: countWordMatches(['forest', 'green', 'nature', 'tree', 'leaf', 'grass', 'earth', 'wood', 'spring', 'calm', 'peace', 'garden', 'mountain', 'grow', 'wild', 'leaves', 'plant', 'woods', 'path', 'stone']),
    plum: countWordMatches(['dream', 'purple', 'violet', 'star', 'space', 'mystery', 'fantasy', 'magic', 'midnight', 'moon', 'night', 'sky', 'wonder', 'sleep', 'plum', 'shadow', 'shadows', 'dark', 'galaxy', 'universe', 'cosmic']),
    indigo: countWordMatches(['love', 'heart', 'kiss', 'sweet', 'soft', 'rose', 'happy', 'joy', 'smile', 'beautiful', 'beauty', 'light', 'together', 'forever', 'friend', 'friendship', 'sunshine', 'warmth', 'gold', 'golden'])
  };

  // Select category with highest density
  let bestPresetKey = 'indigo';
  let maxScore = 0;
  Object.keys(scores).forEach(key => {
    if (scores[key] > maxScore) {
      maxScore = scores[key];
      bestPresetKey = key;
    }
  });

  if (maxScore > 0) {
    const matchedPreset = presets[bestPresetKey];
    console.log(`Local match succeeded. Category: ${bestPresetKey} (score: ${maxScore}). Suggesting ${matchedPreset.backgroundColor}.`);
    return {
      ...matchedPreset,
      explanation: `Selected theme based on local density of matching lyric concepts.`
    };
  }

  console.log('No strong thematic words matched. Suggesting premium Space Indigo default.');
  return {
    ...presets.indigo,
    explanation: 'Standard premium background.'
  };
}

module.exports = { classifyLyrics };
