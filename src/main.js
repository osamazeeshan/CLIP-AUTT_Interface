const API_URL = window.CLIP_AUTT_PREDICT_API_URL || '/api/predict';
const LABELS = ['Pain', 'Stress', 'Neutral'];

const state = {
  stream: null,
  recorder: null,
  chunks: [],
  recordedBlob: null,
  recordedUrl: '',
  annotatedUrl: '',
  elapsed: 0,
  timer: null,
};

const els = {
  liveVideo: document.querySelector('#liveVideo'),
  previewVideo: document.querySelector('#previewVideo'),
  annotatedVideo: document.querySelector('#annotatedVideo'),
  livePlaceholder: document.querySelector('#livePlaceholder'),
  previewPlaceholder: document.querySelector('#previewPlaceholder'),
  annotatedPlaceholder: document.querySelector('#annotatedPlaceholder'),
  cameraError: document.querySelector('#cameraError'),
  statusText: document.querySelector('#statusText'),
  recordingTime: document.querySelector('#recordingTime'),
  recordingPill: document.querySelector('#recordingPill'),
  predictionBadge: document.querySelector('#predictionBadge'),
  turnOnCamera: document.querySelector('#turnOnCamera'),
  recordVideo: document.querySelector('#recordVideo'),
  stopRecording: document.querySelector('#stopRecording'),
  analyzeVideo: document.querySelector('#analyzeVideo'),
  predictionEmpty: document.querySelector('#predictionEmpty'),
  predictionResult: document.querySelector('#predictionResult'),
  predictionLabel: document.querySelector('#predictionLabel'),
  predictionMessage: document.querySelector('#predictionMessage'),
  scoreList: document.querySelector('#scoreList'),
};

function formatSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function setStatus(message) {
  els.statusText.textContent = message;
}

function setRecordingUi(isRecording) {
  els.recordVideo.disabled = !state.stream || isRecording;
  els.stopRecording.disabled = !isRecording;
  els.analyzeVideo.disabled = !state.recordedBlob || isRecording;
  els.recordingTime.hidden = !isRecording;
  els.recordingPill.hidden = !isRecording;
}

function updateTimer() {
  const text = formatSeconds(state.elapsed);
  els.recordingTime.textContent = `Recording time: ${text}`;
  els.recordingPill.textContent = `● Recording ${text}`;
}

async function turnOnCamera() {
  els.cameraError.hidden = true;
  setStatus('Requesting camera permission...');

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    els.liveVideo.srcObject = state.stream;
    els.livePlaceholder.hidden = true;
    els.turnOnCamera.disabled = true;
    els.recordVideo.disabled = false;
    setStatus('Camera is ready. Press Record Video when you are prepared.');
  } catch (error) {
    els.cameraError.textContent = `Camera error: ${error.message || 'Unable to access the camera.'}`;
    els.cameraError.hidden = false;
    setStatus('Camera permission was not granted.');
  }
}

function startRecording() {
  if (!state.stream) return;

  state.chunks = [];
  state.elapsed = 0;
  updateTimer();
  clearPrediction();
  setStatus('Recording video... press Stop when finished.');

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
  state.recorder = new MediaRecorder(state.stream, { mimeType });
  state.recorder.ondataavailable = (event) => {
    if (event.data.size > 0) state.chunks.push(event.data);
  };
  state.recorder.onstop = () => {
    state.recordedBlob = new Blob(state.chunks, { type: mimeType });
    if (state.recordedUrl) URL.revokeObjectURL(state.recordedUrl);
    state.recordedUrl = URL.createObjectURL(state.recordedBlob);
    els.previewVideo.src = state.recordedUrl;
    els.previewPlaceholder.hidden = true;
    els.analyzeVideo.disabled = false;
    setStatus('Recording saved. Review it, then choose Recognize Pain / Stress.');
  };

  state.recorder.start();
  setRecordingUi(true);
  state.timer = window.setInterval(() => {
    state.elapsed += 1;
    updateTimer();
  }, 1000);
}

function stopRecording() {
  state.recorder?.stop();
  state.recorder = null;
  window.clearInterval(state.timer);
  setRecordingUi(false);
}

function clearPrediction() {
  els.predictionEmpty.hidden = false;
  els.predictionResult.hidden = true;
  els.predictionBadge.hidden = true;
  els.annotatedPlaceholder.hidden = false;
  els.annotatedVideo.removeAttribute('src');
  els.annotatedVideo.load();
}

function renderPrediction(prediction) {
  const sortedScores = Object.entries(prediction.scores || {}).sort((a, b) => b[1] - a[1]);
  const topScore = sortedScores[0];

  els.predictionEmpty.hidden = true;
  els.predictionResult.hidden = false;
  els.predictionLabel.textContent = prediction.label;
  els.predictionMessage.textContent = prediction.message;
  els.scoreList.innerHTML = LABELS.map((label) => {
    const value = prediction.scores?.[label] || 0;
    return `<div class="score"><span>${label}</span><div><i style="width:${Math.round(value * 100)}%"></i></div><b>${Math.round(value * 100)}%</b></div>`;
  }).join('');

  if (topScore) {
    els.predictionBadge.textContent = `${topScore[0]} · ${Math.round(topScore[1] * 100)}%`;
    els.predictionBadge.hidden = false;
  }
}

async function analyzeRecording() {
  if (!state.recordedBlob) return;

  els.analyzeVideo.disabled = true;
  els.analyzeVideo.textContent = '⏳ Analyzing...';
  setStatus('Uploading video to the CLIP-AUTT prediction service...');

  const body = new FormData();
  body.append('video', state.recordedBlob, 'clip-autt-recording.webm');
  body.append('labels', JSON.stringify(LABELS));

  try {
    const response = await fetch(API_URL, { method: 'POST', body });
    if (!response.ok) throw new Error(`Prediction failed with HTTP ${response.status}`);
    const result = await response.json();
    renderPrediction({
      label: result.label || result.prediction || 'Unknown',
      scores: result.scores || result.probabilities || {},
      message: result.message || 'Video-level prediction completed.',
    });
    state.annotatedUrl = result.annotatedVideoUrl || state.recordedUrl;
    setStatus('Prediction complete. The result video is ready below.');
  } catch (error) {
    renderPrediction({
      label: 'Demo fallback',
      scores: { Pain: 0.12, Stress: 0.31, Neutral: 0.57 },
      message: `${error.message}. Connect window.CLIP_AUTT_PREDICT_API_URL or /api/predict to your CLIP-AUTT backend for live inference.`,
    });
    state.annotatedUrl = state.recordedUrl;
    setStatus('Could not reach the prediction service, so a demo result is shown.');
  } finally {
    els.annotatedVideo.src = state.annotatedUrl;
    els.annotatedPlaceholder.hidden = true;
    els.analyzeVideo.textContent = '▣ Recognize Pain / Stress';
    els.analyzeVideo.disabled = false;
  }
}

els.turnOnCamera.addEventListener('click', turnOnCamera);
els.recordVideo.addEventListener('click', startRecording);
els.stopRecording.addEventListener('click', stopRecording);
els.analyzeVideo.addEventListener('click', analyzeRecording);
