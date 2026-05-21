const { execSync } = require('child_process');
const path = require('path');

/**
 * Runs ffprobe to extract duration and format tags (metadata) from an audio file.
 * @param {string} filePath - Absolute path to the audio file on disk
 * @returns {object} { duration: number, tags: object }
 */
function probeAudio(filePath) {
  try {
    const stdout = execSync(
      `ffprobe -v quiet -print_format json -show_entries format=duration:format_tags "${filePath}"`
    ).toString();
    const data = JSON.parse(stdout);
    
    const duration = parseFloat(data.format?.duration || 0);
    const tags = data.format?.tags || {};
    
    return { duration, tags };
  } catch (error) {
    console.error('Error probing audio with ffprobe:', error);
    return { duration: 0, tags: {} };
  }
}

/**
 * Guesses a high-quality song title based on ffprobe tags or a cleaned file name fallback.
 * @param {string} filePath - Absolute path to the file on disk
 * @param {string} originalName - Original name of the uploaded file (e.g. from req.file.originalname)
 * @returns {object} { guessedTitle: string, duration: number }
 */
function guessTitle(filePath, originalName) {
  const { duration, tags } = probeAudio(filePath);
  
  // 1. Try extracting from metadata tags (case-insensitive keys)
  const keys = Object.keys(tags);
  const titleKey = keys.find(k => k.toLowerCase() === 'title');
  const artistKey = keys.find(k => k.toLowerCase() === 'artist');
  
  const titleVal = titleKey ? tags[titleKey].trim() : '';
  const artistVal = artistKey ? tags[artistKey].trim() : '';
  
  if (titleVal && artistVal) {
    return {
      guessedTitle: `${artistVal} - ${titleVal}`,
      duration
    };
  } else if (titleVal) {
    return {
      guessedTitle: titleVal,
      duration
    };
  }
  
  // 2. Fallback: Clean up the original file name
  const nameToClean = originalName || path.basename(filePath);
  let name = nameToClean;
  
  // Strip extension (e.g. .mp3, .wav)
  const extIdx = name.lastIndexOf('.');
  if (extIdx !== -1) {
    name = name.substring(0, extIdx);
  }
  
  // Remove common leading patterns (e.g., track numbers like "01 - ", "12. ", "05 ")
  name = name.replace(/^\d+[\s.-]+/, '');
  
  // Replace underscores and multiple dashes with spaces
  name = name.replace(/_/g, ' ');
  name = name.replace(/-+/g, '-'); // keep single hyphens for artist-title splits, but clean up spacing
  
  // Clean up excess white space
  name = name.replace(/\s+/g, ' ').trim();
  
  // Ensure the first character is capitalized if it's a letter
  if (name.length > 0) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  } else {
    name = 'Untitled Track';
  }
  
  return {
    guessedTitle: name,
    duration
  };
}

module.exports = {
  probeAudio,
  guessTitle
};
