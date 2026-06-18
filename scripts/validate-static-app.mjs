import { access, readFile } from 'node:fs/promises';

const requiredFiles = ['index.html', 'src/main.js', 'src/styles.css'];
await Promise.all(requiredFiles.map((file) => access(file)));

const html = await readFile('index.html', 'utf8');
const js = await readFile('src/main.js', 'utf8');

for (const selector of ['#liveVideo', '#recordVideo', '#stopRecording', '#analyzeVideo', '#annotatedVideo']) {
  if (!js.includes(selector)) throw new Error(`Missing required selector ${selector}`);
}

if (!html.includes('src/main.js')) throw new Error('index.html must load src/main.js');
if (!js.includes('MediaRecorder')) throw new Error('Recorder workflow must use MediaRecorder');
if (!js.includes('/api/predict')) throw new Error('Prediction workflow must call the model API endpoint');

console.log('Static CLIP-AUTT interface validation passed.');
