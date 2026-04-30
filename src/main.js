import JSZip from 'jszip';
import './style.css';
import { readFileAsArrayBuffer, triggerBlobDownload, getFileExtension, buildZipFilename } from './lib/fileUtils.js';
import { parseMidiFile, analyzeMidi, splitMidiToOutputs } from './lib/midiSplitter.js';

const fileInput = document.querySelector('#midi-file');
const dropZone = document.querySelector('#drop-zone');
const statusEl = document.querySelector('#status');
const trackListEl = document.querySelector('#track-list');
const downloadBtn = document.querySelector('#download-zip');
const resetAppBtn = document.querySelector('#reset-app');
const selectAllBtn = document.querySelector('#select-all');
const selectNoneBtn = document.querySelector('#select-none');
const resetNamesBtn = document.querySelector('#reset-names');
const globalNoteEl = document.querySelector('#global-note');

const state = { sourceFile:null, extension:'mid', parsedMidi:null, analysis:null, renameMap:new Map(), selected:new Set() };

function setStatus(message,type='info'){ statusEl.textContent=message; statusEl.className=`status ${type}`; }
function updateButtons(){ downloadBtn.disabled=!state.parsedMidi||state.selected.size===0; resetAppBtn.disabled=!state.parsedMidi; }
function clearTracks(){ trackListEl.innerHTML=''; globalNoteEl.textContent=''; updateButtons(); }
function resetApp(){ state.sourceFile=null; state.extension='mid'; state.parsedMidi=null; state.analysis=null; state.renameMap.clear(); state.selected.clear(); fileInput.value=''; clearTracks(); setStatus('Ready for another MIDI file.','info'); }
function formatChannels(ch){ return !ch.length?'No channels':ch.map(c=>`Ch ${c+1}`).join(', '); }
function renderTracks(){ trackListEl.innerHTML=''; const tracks=state.analysis?.exportableTracks??[]; if(!tracks.length){ setStatus('No exportable musical tracks were found in this MIDI file.','error'); updateButtons(); return; } tracks.forEach((track)=>{ const row=document.createElement('article'); row.className='track-row'; const checked=state.selected.has(track.index); const currentName=state.renameMap.get(track.index)??track.originalName; row.innerHTML=`<div class="row-top"><label><input type="checkbox" data-track-index="${track.index}" ${checked?'checked':''} /><span class="track-title">${track.originalName}</span></label></div><label class="name-label">Output name<input type="text" data-name-index="${track.index}" value="${currentName}" /></label><p class="meta">Track ${track.index+1} • ${track.noteCount} notes • ${formatChannels(track.channels)}</p>`; trackListEl.appendChild(row); }); updateButtons(); }
function hydrateStateFromAnalysis(){ state.renameMap.clear(); state.selected.clear(); state.analysis.exportableTracks.forEach((track)=>{ state.renameMap.set(track.index,track.originalName); state.selected.add(track.index); }); globalNoteEl.textContent=state.analysis.hasGlobalTrack?'Global conductor/tempo track detected. It will be included in each exported MIDI file.':'No separate global conductor track detected.'; }
async function handleFile(file){ if(!/\.(mid|midi)$/i.test(file.name)){ setStatus('Please upload a valid .mid or .midi file.','error'); clearTracks(); return; } try{ setStatus('Parsing MIDI file...','info'); state.sourceFile=file; state.extension=getFileExtension(file.name); const buffer=await readFileAsArrayBuffer(file); state.parsedMidi=parseMidiFile(buffer); state.analysis=analyzeMidi(state.parsedMidi); hydrateStateFromAnalysis(); renderTracks(); setStatus('MIDI parsed successfully. Adjust names or selection, then download ZIP.','success'); }catch{ resetApp(); setStatus('Could not parse this MIDI file. It may be invalid or corrupted.','error'); }}
fileInput.addEventListener('change',(e)=>{ const file=e.target.files?.[0]; if(file) handleFile(file); });
['dragenter','dragover'].forEach(n=>dropZone.addEventListener(n,(e)=>{ e.preventDefault(); dropZone.classList.add('dragging'); }));
['dragleave','drop'].forEach(n=>dropZone.addEventListener(n,(e)=>{ e.preventDefault(); dropZone.classList.remove('dragging'); }));
dropZone.addEventListener('drop',(e)=>{ const file=e.dataTransfer?.files?.[0]; if(file) handleFile(file); });
trackListEl.addEventListener('input',(e)=>{ const input=e.target; if(input.matches('input[type="text"][data-name-index]')) state.renameMap.set(Number(input.dataset.nameIndex),input.value); });
trackListEl.addEventListener('change',(e)=>{ const input=e.target; if(input.matches('input[type="checkbox"][data-track-index]')){ const index=Number(input.dataset.trackIndex); input.checked?state.selected.add(index):state.selected.delete(index); updateButtons(); }});
selectAllBtn.addEventListener('click',()=>{ (state.analysis?.exportableTracks??[]).forEach(t=>state.selected.add(t.index)); renderTracks(); });
selectNoneBtn.addEventListener('click',()=>{ state.selected.clear(); renderTracks(); });
resetNamesBtn.addEventListener('click',()=>{ (state.analysis?.exportableTracks??[]).forEach(t=>state.renameMap.set(t.index,t.originalName)); renderTracks(); });
resetAppBtn.addEventListener('click',resetApp);
downloadBtn.addEventListener('click',async()=>{ if(!state.parsedMidi||state.selected.size===0||!state.sourceFile) return; try{ downloadBtn.disabled=true; setStatus('Generating ZIP file...','info'); const outputs=splitMidiToOutputs(state.parsedMidi,state.renameMap,Array.from(state.selected),state.extension); if(!outputs.length){ setStatus('No valid tracks selected for export.','error'); updateButtons(); return; } const zip=new JSZip(); outputs.forEach(entry=>zip.file(entry.filename,entry.bytes)); const blob=await zip.generateAsync({type:'blob'}); triggerBlobDownload(blob,buildZipFilename(state.sourceFile.name)); setStatus(`ZIP downloaded with ${outputs.length} track file(s). Click \"Try another file\" to start over.`,'success'); resetAppBtn.disabled=false; }catch{ setStatus('Failed to generate ZIP. Please try again with a different MIDI file.','error'); }finally{ updateButtons(); }});
updateButtons();
