# CLIP-AUTT Interface

A lightweight browser interface for recording a face video from the webcam and sending it to a CLIP-AUTT-style model backend for video-level **Pain**, **Stress**, or **Neutral** recognition.

The page asks the user to enable their camera, records a short webcam clip, uploads the clip to a prediction endpoint, and then displays both the recorded clip and the annotated recognition playback returned by the backend.

## Features

- Camera permission prompt and live webcam preview.
- Bottom controls for:
  - turning on the camera,
  - recording a video,
  - stopping the recording,
  - recognizing pain/stress from the recorded video.
- Uploads the recorded video as `FormData` to a prediction API.
- Shows video-level prediction scores for Pain, Stress, and Neutral.
- Displays an annotated output video when the backend returns an `annotatedVideoUrl`.
- Runs as a dependency-free static web app using Python's built-in HTTP server.

## Project structure

```text
.
├── index.html                     # Main web page markup
├── package.json                   # Convenience scripts
├── scripts/
│   └── validate-static-app.mjs    # Lightweight static workflow validator
└── src/
    ├── main.js                    # Camera, recording, upload, and prediction UI logic
    └── styles.css                 # Responsive page styling
```

## Prerequisites

- A modern browser that supports:
  - `navigator.mediaDevices.getUserMedia`,
  - `MediaRecorder`,
  - `FormData` uploads.
- Python 3 for local static serving.
- Node.js if you want to run the validation script with `npm run build`.
- A CLIP-AUTT model backend that accepts a video upload and returns JSON.

> Camera access usually requires the page to be served from `localhost` or HTTPS. Opening `index.html` directly from the filesystem may prevent camera permissions in some browsers.

## Run the interface locally

From the repository root:

```bash
npm start
```

This runs:

```bash
python3 -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

## Validate the static app

Run:

```bash
npm run build
```

The build command does not bundle assets. It runs `scripts/validate-static-app.mjs`, which checks that the required files exist and that the core recording/prediction hooks are present.

## Connect your CLIP-AUTT backend

By default, the frontend sends predictions to:

```text
/api/predict
```

You can override this by defining `window.CLIP_AUTT_PREDICT_API_URL` before `src/main.js` loads. For example, add this script tag in `index.html` before the existing module script:

```html
<script>
  window.CLIP_AUTT_PREDICT_API_URL = 'http://localhost:8000/predict';
</script>
<script type="module" src="src/main.js"></script>
```

## Expected prediction request

When the user clicks **Recognize Pain / Stress**, the frontend sends a `POST` request with `multipart/form-data`:

| Field | Description |
| --- | --- |
| `video` | The recorded webcam clip as `clip-autt-recording.webm`. |
| `labels` | JSON string containing `['Pain', 'Stress', 'Neutral']`. |

## Expected prediction response

The frontend expects JSON similar to this:

```json
{
  "label": "Neutral",
  "scores": {
    "Pain": 0.12,
    "Stress": 0.31,
    "Neutral": 0.57
  },
  "message": "Video-level prediction completed.",
  "annotatedVideoUrl": "http://localhost:8000/outputs/annotated-recording.mp4"
}
```

Supported response aliases:

- `prediction` may be used instead of `label`.
- `probabilities` may be used instead of `scores`.
- `annotatedVideoUrl` is optional. If it is missing, the frontend replays the original recorded clip in the recognition playback panel.

## Backend implementation notes

The referenced model repository is [CLIP-AUTT](https://github.com/osamazeeshan/CLIP-AUTT). This frontend does not run the model directly in the browser. You should expose the model from a backend service that:

1. accepts the uploaded video,
2. runs the CLIP-AUTT video-level inference pipeline,
3. optionally creates an annotated video with face bounding boxes and labels,
4. returns the JSON response described above.

For local development, make sure your backend allows CORS requests from `http://localhost:5173` if it runs on a different port.

## Troubleshooting

### The camera does not open

- Serve the app from `http://localhost:5173` or HTTPS.
- Check that the browser has permission to use the camera.
- Close other apps that may be using the webcam.

### Prediction shows a demo fallback

The UI displays a demo fallback prediction when the prediction endpoint cannot be reached or returns an error. Confirm that:

- your backend is running,
- the endpoint URL matches `/api/predict` or `window.CLIP_AUTT_PREDICT_API_URL`,
- CORS is configured if the backend is on a different origin,
- the backend returns valid JSON.

### Annotated video does not appear

- Confirm the backend returns `annotatedVideoUrl`.
- Confirm that the URL is reachable by the browser.
- If the annotated video is served from another origin, configure that server to allow browser access.
