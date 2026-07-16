/**
 * Stage 2 — ID card capture with an alignment guide.
 * Vanilla JS, matches your existing frontend stack (no framework).
 *
 * Usage: include a <video>, <canvas>, and a guide <div> in your HTML
 * (markup example at the bottom of this file), then:
 *
 *   const capture = new IdCapture({
 *     videoEl: document.getElementById('camera-preview'),
 *     canvasEl: document.getElementById('capture-canvas'),
 *     onCaptured: (blob) => { ... send blob to /api/ocr/verify ... }
 *   });
 *   capture.start();
 */
class IdCapture {
  constructor({ videoEl, canvasEl, onCaptured, onQualityWarning }) {
    this.video = videoEl;
    this.canvas = canvasEl;
    this.onCaptured = onCaptured;
    this.onQualityWarning = onQualityWarning || (() => {});
    this.stream = null;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } },
    });
    this.video.srcObject = this.stream;
    await this.video.play();
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  // Call this when the user taps "Capture". Crops to the guide frame
  // (assumes the guide box is ~85% width, ~55% height, centered —
  // matches the overlay in the CSS below) and runs basic quality checks
  // before handing back a blob.
  capture() {
    const ctx = this.canvas.getContext("2d");
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;

    const guideW = vw * 0.85;
    const guideH = vh * 0.55;
    const guideX = (vw - guideW) / 2;
    const guideY = (vh - guideH) / 2;

    this.canvas.width = guideW;
    this.canvas.height = guideH;
    ctx.drawImage(this.video, guideX, guideY, guideW, guideH, 0, 0, guideW, guideH);

    const quality = this._checkQuality(ctx, guideW, guideH);
    if (!quality.ok) {
      this.onQualityWarning(quality.reason);
      return null;
    }

    return new Promise((resolve) => {
      this.canvas.toBlob((blob) => {
        this.onCaptured(blob);
        resolve(blob);
      }, "image/jpeg", 0.92);
    });
  }

  // Cheap client-side checks so a bad shot gets caught before it's ever
  // uploaded — saves a round trip and lets the person retake immediately.
  _checkQuality(ctx, w, h) {
    if (w < 600 || h < 350) {
      return { ok: false, reason: "too_small" };
    }

    // Rough brightness check — average luminance across a sample grid.
    const imageData = ctx.getImageData(0, 0, w, h).data;
    let total = 0;
    let count = 0;
    for (let i = 0; i < imageData.length; i += 400) { // sample, don't scan every pixel
      const r = imageData[i], g = imageData[i + 1], b = imageData[i + 2];
      total += (r + g + b) / 3;
      count++;
    }
    const avgBrightness = total / count;

    if (avgBrightness < 60) return { ok: false, reason: "too_dark" };
    if (avgBrightness > 235) return { ok: false, reason: "too_bright_glare" };

    return { ok: true };
  }
}

/* ---------------------------------------------------------------------
   Example markup + CSS for the alignment guide overlay:

<div class="capture-wrapper">
  <video id="camera-preview" autoplay playsinline></video>
  <div class="guide-frame"></div>
  <p class="guide-hint">Fit your ID card inside the frame, flat and well-lit</p>
  <canvas id="capture-canvas" style="display:none;"></canvas>
  <button id="capture-btn">Capture ID</button>
</div>

<style>
.capture-wrapper { position: relative; width: 100%; max-width: 480px; margin: 0 auto; }
#camera-preview { width: 100%; border-radius: 8px; }
.guide-frame {
  position: absolute;
  top: 22.5%; left: 7.5%; width: 85%; height: 55%;
  border: 3px dashed #ffffffcc;
  border-radius: 12px;
  pointer-events: none;
  box-shadow: 0 0 0 2000px rgba(0,0,0,0.35);
}
.guide-hint {
  position: absolute; bottom: 8px; left: 0; right: 0;
  text-align: center; color: white; font-size: 13px;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
}
</style>
--------------------------------------------------------------------- */

// Quality warning messages — pass reason from onQualityWarning to this
// to show the person something actionable, not just "try again."
const QUALITY_MESSAGES = {
  too_small: "Move closer — the card needs to fill the frame.",
  too_dark: "It's too dark — find better lighting and try again.",
  too_bright_glare: "There's glare on the card — tilt it slightly and retake.",
};

export { IdCapture, QUALITY_MESSAGES };