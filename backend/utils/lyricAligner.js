/**
 * Advanced Word-Level Lyric Alignment and Resegmentation Engine
 */

/**
 * Normalizes a word for comparison by converting to lowercase and stripping punctuation.
 */
function normalizeWord(word) {
  if (!word) return '';
  return word.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Set of extremely common stop words to ignore during anchor match confirmation,
 * unless no other match can be found.
 */
const COMMON_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
  'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about',
  'i', 'you', 'he', 'she', 'they', 'it', 'we', 'me', 'him', 'her', 'us',
  'my', 'your', 'his', 'their', 'our', 'this', 'that', 'these', 'those'
]);

/**
 * Aligns custom pasted lyrics (line-by-line) with a chronological stream of transcribed words from STT.
 * 
 * @param {string[]} pastedLines - Array of lines of lyrics pasted by the user.
 * @param {Array<{word: string, startTime: number, endTime: number}>} transcribedWords - Chronological list of transcribed words with timestamps.
 * @returns {Array<{id: number, startTime: number, endTime: number, text: string}>|null} Aligned lyric segments, or null if alignment fails validation.
 */
function alignLyrics(pastedLines, transcribedWords) {
  if (!pastedLines || pastedLines.length === 0) return [];
  if (!transcribedWords || transcribedWords.length === 0) {
    console.log('Lyric Align: No transcribed words available for alignment.');
    return null;
  }

  // 1. Flatten the pasted lines into individual words, keeping track of their line & word indices
  const pastedWords = [];
  pastedLines.forEach((line, lineIdx) => {
    const lineWords = line.split(/\s+/).filter(Boolean);
    lineWords.forEach((word, wordIdx) => {
      pastedWords.push({
        word: normalizeWord(word),
        originalWord: word,
        lineIdx,
        wordIdx
      });
    });
  });

  if (pastedWords.length === 0) {
    console.log('Lyric Align: Pasted lyrics contain no words.');
    return [];
  }

  const T = transcribedWords.length;
  const P = pastedWords.length;
  const assignedTimings = new Array(P).fill(null);

  console.log(`Lyric Align: Aligning ${P} pasted words with ${T} transcribed words.`);

  // 2. Perform localized anchor matching
  let directAnchorCount = 0;
  pastedWords.forEach((pw, pIdx) => {
    if (!pw.word) return;

    // Determine the proportional target index in the transcribed stream
    const targetTIdx = Math.round((pIdx * T) / P);
    const searchWindow = 10; // search up to 10 words left/right
    let bestMatchIdx = -1;
    let bestDist = Infinity;

    for (let offset = -searchWindow; offset <= searchWindow; offset++) {
      const tIdx = targetTIdx + offset;
      if (tIdx >= 0 && tIdx < T) {
        const tw = transcribedWords[tIdx];
        if (normalizeWord(tw.word) === pw.word) {
          const dist = Math.abs(offset);
          if (dist < bestDist) {
            bestDist = dist;
            bestMatchIdx = tIdx;
          }
        }
      }
    }

    if (bestMatchIdx !== -1) {
      assignedTimings[pIdx] = {
        startTime: transcribedWords[bestMatchIdx].startTime,
        endTime: transcribedWords[bestMatchIdx].endTime,
        isAnchor: true
      };
      
      // Count direct anchors (preferring non-stop words for validation score)
      if (!COMMON_STOP_WORDS.has(pw.word)) {
        directAnchorCount++;
      }
    }
  });

  // Calculate anchor match rate relative to total pasted words
  // (We use a subset of non-stop-word matches to ensure alignment quality)
  const nonStopPastedWordsCount = pastedWords.filter(pw => !COMMON_STOP_WORDS.has(pw.word)).length || 1;
  const matchRate = directAnchorCount / nonStopPastedWordsCount;
  console.log(`Lyric Align: Word-level non-stop anchor match rate: ${(matchRate * 100).toFixed(1)}% (${directAnchorCount}/${nonStopPastedWordsCount})`);

  // If match rate is extremely low (under 15%), alignment is highly likely to be erroneous/scrambled
  if (matchRate < 0.15) {
    console.log('Lyric Align: Match rate is below 15% threshold. Declaring auto-alignment invalid.');
    return null;
  }

  // 3. Linearly interpolate/extrapolate timings for unassigned words
  for (let i = 0; i < P; i++) {
    if (assignedTimings[i] !== null) continue;

    // Find nearest left anchor
    let leftIdx = -1;
    for (let l = i - 1; l >= 0; l--) {
      if (assignedTimings[l] !== null) {
        leftIdx = l;
        break;
      }
    }

    // Find nearest right anchor
    let rightIdx = -1;
    for (let r = i + 1; r < P; r++) {
      if (assignedTimings[r] !== null) {
        rightIdx = r;
        break;
      }
    }

    let start, end;
    if (leftIdx !== -1 && rightIdx !== -1) {
      // Interpolate between left and right anchors
      const leftTime = assignedTimings[leftIdx].endTime;
      const rightTime = assignedTimings[rightIdx].startTime;
      const fraction = (i - leftIdx) / (rightIdx - leftIdx);
      
      start = leftTime + (rightTime - leftTime) * fraction;
      end = start + 0.2; // assume short 200ms default duration
    } else if (leftIdx !== -1) {
      // Extrapolate to the right
      const lastTime = assignedTimings[leftIdx].endTime;
      start = lastTime + (i - leftIdx) * 0.4; // space by 400ms
      end = start + 0.3;
    } else if (rightIdx !== -1) {
      // Extrapolate to the left
      const firstTime = assignedTimings[rightIdx].startTime;
      start = Math.max(0, firstTime - (rightIdx - i) * 0.4);
      end = start + 0.3;
    } else {
      // Complete backup fallback (should not occur since match rate >= 15%)
      start = 0;
      end = 0;
    }

    assignedTimings[i] = { startTime: start, endTime: end, isAnchor: false };
  }

  // 4. Regroup word-level timings back into the original pasted lines structure
  const resultLines = pastedLines.map((lineText, lineIdx) => {
    const lineWordIndices = [];
    pastedWords.forEach((pw, pIdx) => {
      if (pw.lineIdx === lineIdx) {
        lineWordIndices.push(pIdx);
      }
    });

    if (lineWordIndices.length === 0) {
      return null;
    }

    const firstWordIdx = lineWordIndices[0];
    const lastWordIdx = lineWordIndices[lineWordIndices.length - 1];

    const startTime = assignedTimings[firstWordIdx].startTime;
    const endTime = assignedTimings[lastWordIdx].endTime;

    // Safety: ensure startTime is strictly less than or equal to endTime
    const cleanStart = parseFloat(Math.max(0, startTime).toFixed(2));
    const cleanEnd = parseFloat(Math.max(cleanStart + 0.1, endTime).toFixed(2));

    return {
      startTime: cleanStart,
      endTime: cleanEnd,
      text: lineText.trim()
    };
  }).filter(Boolean);

  // 5. Add sequence IDs
  const finalized = resultLines.map((line, idx) => ({
    id: idx + 1,
    ...line
  }));

  return resolveManifestOverlaps(finalized);
}

/**
 * Resolves overlapping segments in a manifest, ensuring consecutive non-overlapping timings.
 * If segment A and segment B overlap, the end of A is clipped to B's start time.
 * If this reduces A's duration below 0.1s, A's start time is pushed backward to maintain a 0.1s minimum duration.
 * This push is propagated recursively backward if A's start time now overlaps with a preceding segment.
 */
function resolveManifestOverlaps(manifest) {
  if (!manifest || manifest.length === 0) return [];
  
  // Sort by startTime to ensure chronological order
  const sorted = [...manifest].map(seg => ({ ...seg })).sort((a, b) => a.startTime - b.startTime);
  
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    
    if (current.endTime > next.startTime) {
      // Overlap detected: clip end time of current segment
      current.endTime = parseFloat(next.startTime.toFixed(2));
      
      // If current segment duration is now less than 0.1s, push startTime backward
      if (parseFloat((current.endTime - current.startTime).toFixed(2)) < 0.1) {
        current.startTime = parseFloat(Math.max(0, current.endTime - 0.1).toFixed(2));
        
        // Propagate backward
        let j = i;
        while (j > 0 && sorted[j - 1].endTime > sorted[j].startTime) {
          sorted[j - 1].endTime = parseFloat(sorted[j].startTime.toFixed(2));
          if (parseFloat((sorted[j - 1].endTime - sorted[j - 1].startTime).toFixed(2)) < 0.1) {
            sorted[j - 1].startTime = parseFloat(Math.max(0, sorted[j - 1].endTime - 0.1).toFixed(2));
          }
          j--;
        }
      }
    }
  }
  
  // Re-map IDs after sorting to maintain consecutive sequence numbering
  return sorted.map((seg, idx) => ({
    ...seg,
    id: idx + 1
  }));
}

module.exports = { alignLyrics, resolveManifestOverlaps };
