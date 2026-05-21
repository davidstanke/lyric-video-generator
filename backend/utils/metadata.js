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
 * Helper to clean up titles, removing artifact suffixes (duplicates, copy numbers, quality tags, etc.)
 * @param {string} name - The raw string to clean
 * @param {boolean} isMetadata - If true, applies less aggressive cleaning (preserves tags like (Remix))
 * @returns {string} Cleaned name
 */
function cleanName(name, isMetadata = false) {
  if (!name) return '';
  
  let cleaned = name;

  if (!isMetadata) {
    // Strip extension (e.g. .mp3, .wav, .m4a)
    const extIdx = cleaned.lastIndexOf('.');
    if (extIdx !== -1) {
      cleaned = cleaned.substring(0, extIdx);
    }

    // Remove common leading patterns (e.g., track numbers like "01 - ", "12. ", "05 ")
    cleaned = cleaned.replace(/^\d+[\s.-]+/, '');
  }

  // Replace underscores and multiple dashes with spaces
  cleaned = cleaned.replace(/_/g, ' ');
  cleaned = cleaned.replace(/-+/g, '-');

  // Strip duplicate/copy suffixes like (1), [1], (copy), (copy 1), - Copy
  cleaned = cleaned.replace(/\s*[([（【]\s*(copy|copy\s+\d+|\d+)\s*[)\]）】]\s*$/gi, '');
  cleaned = cleaned.replace(/\s*-\s*copy\s*$/gi, '');

  if (!isMetadata) {
    // Strip common video/audio suffixes in brackets or parentheses like (Official Video), (Lyrics), (Audio), [HQ], [HD]
    cleaned = cleaned.replace(/\s*[([（【]\s*(official\s+(video|audio|lyric\s+video|music\s+video)|lyric\s+video|official|lyrics|hq|hd|remix|cover|128kbps|320kbps)\s*[)\]）】]\s*$/gi, '');
    
    // Strip trailing hyphens followed by quality / extra attributes (e.g. - 128kbps)
    cleaned = cleaned.replace(/\s*-\s*(128kbps|320kbps|official\s+video|official\s+audio|lyrics|hq|hd|remix|cover)\s*$/gi, '');
  }

  // Clean up trailing and leading dashes, underscores, and extra spacing
  cleaned = cleaned.replace(/^[\s-_]+|[\s-_]+$/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Ensure the first character is capitalized if it's a letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  } else {
    cleaned = 'Untitled Track';
  }

  return cleaned;
}

/**
 * Helper to convert a string to Title Case, keeping standard minor words lowercase
 * unless they are the first or last word.
 * @param {string} str 
 * @returns {string}
 */
function toTitleCase(str) {
  if (!str) return '';

  // If the string is completely UPPERCASE, convert it to lowercase first
  // to avoid preserving screaming all-caps words (like "WAKE ME UP")
  if (str === str.toUpperCase()) {
    str = str.toLowerCase();
  }

  const lowercaseWords = new Set([
    'a', 'an', 'the',
    'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
    'at', 'by', 'in', 'of', 'on', 'to', 'with', 'from', 'into', 'onto', 'as', 'than', 'vs', 'v'
  ]);

  // Split by whitespace
  const words = str.split(/\s+/);
  
  const titleCasedWords = words.map((word, idx) => {
    if (!word) return '';

    // Handle compound words/hyphens (e.g. "well-known")
    if (word.includes('-')) {
      const parts = word.split('-');
      return parts
        .map((subword, subIdx) => {
          if (!subword) return '';
          const isFirstOrLast = (idx === 0 && subIdx === 0) || (idx === words.length - 1 && subIdx === parts.length - 1);
          const cleanSubword = subword.toLowerCase();
          if (lowercaseWords.has(cleanSubword) && !isFirstOrLast) {
            return cleanSubword;
          }
          // Preserve all-caps acronyms (e.g., "NASA")
          if (subword === subword.toUpperCase() && subword.match(/^[A-Z]{2,}$/)) {
            return subword;
          }
          return subword.charAt(0).toUpperCase() + subword.slice(1).toLowerCase();
        })
        .join('-');
    }

    const cleanWord = word.toLowerCase();
    const isFirstOrLast = idx === 0 || idx === words.length - 1;

    // Check if it's a lowercase word and not first/last
    if (lowercaseWords.has(cleanWord) && !isFirstOrLast) {
      return cleanWord;
    }

    // Preserve all-caps acronyms (e.g., "NASA")
    if (word === word.toUpperCase() && word.match(/^[A-Z]{2,}$/)) {
      return word;
    }

    // Otherwise, capitalize first letter, lowercase the rest
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  return titleCasedWords.join(' ');
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
  
  let titleVal = titleKey ? tags[titleKey].trim() : '';
  let artistVal = artistKey ? tags[artistKey].trim() : '';
  
  if (titleVal && artistVal) {
    // Clean metadata tags from duplicates like (1)
    titleVal = cleanName(titleVal, true);
    artistVal = cleanName(artistVal, true);
    return {
      guessedTitle: `${artistVal} - ${titleVal}`,
      duration
    };
  } else if (titleVal) {
    titleVal = cleanName(titleVal, true);
    return {
      guessedTitle: titleVal,
      duration
    };
  }
  
  // 2. Fallback: Clean up the original file name
  const nameToClean = originalName || path.basename(filePath);
  const cleanedFileTitle = cleanName(nameToClean, false);
  
  return {
    guessedTitle: toTitleCase(cleanedFileTitle),
    duration
  };
}

module.exports = {
  probeAudio,
  guessTitle,
  toTitleCase
};
