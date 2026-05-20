function formatTime(seconds) {
  const date = new Date(0);
  date.setSeconds(Math.floor(seconds));
  date.setMilliseconds((seconds % 1) * 1000);
  const iso = date.toISOString(); // e.g. "1970-01-01T00:00:12.345Z"
  const timePart = iso.substr(11, 12); // "00:00:12.345"
  return timePart.replace('.', ','); // SRT format uses comma for milliseconds: "00:00:12,345"
}

function generateSrt(manifest) {
  let srtContent = '';
  
  manifest.forEach((segment, index) => {
    const seq = index + 1;
    const start = formatTime(segment.startTime);
    const end = formatTime(segment.endTime);
    
    srtContent += `${seq}\n`;
    srtContent += `${start} --> ${end}\n`;
    srtContent += `${segment.text}\n\n`;
  });
  
  return srtContent;
}

module.exports = { generateSrt };
