export async function readFileAsArrayBuffer(file) {
  return file.arrayBuffer();
}

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function getFileExtension(filename) {
  return filename.toLowerCase().endsWith('.midi') ? 'midi' : 'mid';
}

export function buildZipFilename(sourceName) {
  const base = sourceName.replace(/\.[^.]+$/, '').trim() || 'midi-file';
  return `${base}-split-tracks.zip`;
}

