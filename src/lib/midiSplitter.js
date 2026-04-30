import { parseMidi, writeMidi } from 'midi-file';

const CHANNEL_EVENT_TYPES = new Set([
  'noteOn',
  'noteOff',
  'noteAftertouch',
  'controller',
  'programChange',
  'channelAftertouch',
  'pitchBend',
  'sysEx',
  'endSysEx'
]);

export function parseMidiFile(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  return parseMidi(bytes);
}

export function hasChannelEvents(track) {
  return track.some((event) => CHANNEL_EVENT_TYPES.has(event.type));
}

export function isLikelyGlobalTrack(track, index) {
  if (index !== 0) return false;
  if (hasChannelEvents(track)) return false;

  return track.some((event) => event.type === 'meta' && event.subtype !== 'endOfTrack');
}

export function getTrackName(track, fallback = 'Untitled Track') {
  const found = track.find((event) => event.type === 'meta' && event.subtype === 'trackName' && typeof event.text === 'string');
  return (found?.text || fallback).trim() || fallback;
}

function collectChannels(track) {
  const channels = new Set();
  track.forEach((event) => {
    if (typeof event.channel === 'number') channels.add(event.channel);
  });
  return Array.from(channels).sort((a, b) => a - b);
}

function countNotes(track) {
  return track.reduce((sum, event) => sum + (event.type === 'noteOn' && event.velocity > 0 ? 1 : 0), 0);
}

export function analyzeMidi(parsedMidi) {
  const tracks = parsedMidi.tracks ?? [];
  const hasGlobalTrack = tracks.length > 0 && isLikelyGlobalTrack(tracks[0], 0);

  const exportableTracks = tracks
    .map((track, index) => ({ track, index }))
    .filter(({ track, index }) => !(hasGlobalTrack && index === 0) && hasChannelEvents(track))
    .map(({ track, index }) => ({
      index,
      originalName: getTrackName(track, `Track ${index + 1}`),
      noteCount: countNotes(track),
      channels: collectChannels(track)
    }));

  return {
    hasGlobalTrack,
    globalTrackIndex: hasGlobalTrack ? 0 : null,
    ticksPerBeat: parsedMidi.header?.ticksPerBeat,
    exportableTracks
  };
}

export function sanitizeFilename(name) {
  const cleaned = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  return cleaned || 'Untitled Track';
}

export function upsertTrackName(track, newName) {
  const cloned = structuredClone(track);
  const targetName = newName.trim();
  const idx = cloned.findIndex((event) => event.type === 'meta' && event.subtype === 'trackName');

  if (idx >= 0) {
    cloned[idx].text = targetName;
  } else {
    cloned.unshift({ deltaTime: 0, type: 'meta', subtype: 'trackName', text: targetName });
  }

  return cloned;
}

export function ensureSingleEndOfTrack(track) {
  const withoutEnd = track.filter((event) => !(event.type === 'meta' && event.subtype === 'endOfTrack'));
  withoutEnd.push({ deltaTime: 0, type: 'meta', subtype: 'endOfTrack' });
  return withoutEnd;
}

function dedupeFilenames(bases) {
  const seen = new Map();
  return bases.map((base) => {
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

export function splitMidiToOutputs(parsedMidi, renameMap, selectedTrackIndexes, extension) {
  const analysis = analyzeMidi(parsedMidi);
  const tracksByIndex = new Map(analysis.exportableTracks.map((t) => [t.index, t]));
  const selected = selectedTrackIndexes.filter((idx) => tracksByIndex.has(idx));
  const safeExt = extension === 'midi' ? 'midi' : 'mid';

  const prepared = selected.map((index) => {
    const info = tracksByIndex.get(index);
    const rawName = (renameMap.get(index) ?? '').trim() || info.originalName;
    const outputName = sanitizeFilename(rawName);
    return { index, info, outputName };
  });

  const dedupedNames = dedupeFilenames(prepared.map((item) => item.outputName));

  return prepared.map((item, i) => {
    const outputName = dedupedNames[i];
    const srcTrack = parsedMidi.tracks[item.index];
    const musicalTrack = ensureSingleEndOfTrack(upsertTrackName(srcTrack, outputName));

    let outTracks;
    let format;

    if (analysis.hasGlobalTrack) {
      const globalTrack = ensureSingleEndOfTrack(structuredClone(parsedMidi.tracks[0]));
      outTracks = [globalTrack, musicalTrack];
      format = 1;
    } else {
      outTracks = [musicalTrack];
      format = 0;
    }

    const midiOut = {
      header: {
        format,
        numTracks: outTracks.length,
        ticksPerBeat: parsedMidi.header.ticksPerBeat
      },
      tracks: outTracks
    };

    return {
      index: item.index,
      originalName: item.info.originalName,
      outputName,
      filename: `${outputName}.${safeExt}`,
      bytes: writeMidi(midiOut),
      noteCount: item.info.noteCount,
      channels: item.info.channels
    };
  });
}

