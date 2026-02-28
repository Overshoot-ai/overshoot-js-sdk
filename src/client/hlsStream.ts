/**
 * HLS stream capture — creates a MediaStream from an HLS source
 * by decoding into a hidden video element and capturing frames via canvas.
 */

interface HlsStreamResult {
  stream: MediaStream;
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hls: any | null;
  animationFrameId: number;
}

export async function createHlsStream(url: string): Promise<HlsStreamResult> {
  // Create video element offscreen with real dimensions so browsers
  // keep the media pipeline alive (opacity:0/1px causes throttling)
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  Object.assign(video.style, {
    position: "fixed",
    left: "-9999px",
    top: "-9999px",
    width: "640px",
    height: "360px",
    pointerEvents: "none",
  });
  document.body.appendChild(video);

  // Prefer HLS.js for consistent behavior on hidden/offscreen elements.
  // Native HLS (Safari) may deprioritize decoding for hidden videos.
  const Hls = (await import("hls.js")).default;
  let hlsInstance = null;

  if (Hls.isSupported()) {
    const hls = new Hls({
      startLevel: 0,
      maxBufferLength: 5,
      maxMaxBufferLength: 10,
      capLevelToPlayerSize: true,
    });
    hlsInstance = hls;
    hls.loadSource(url);
    hls.attachMedia(video);

    await new Promise<void>((resolve, reject) => {
      hls.on(Hls.Events.MANIFEST_PARSED, () => resolve());
      hls.on(Hls.Events.ERROR, (_e: any, data: any) => {
        if (data.fatal) reject(new Error(`HLS fatal error: ${data.type}`));
      });
    });
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = url;
  } else {
    video.remove();
    throw new Error("HLS is not supported in this browser");
  }

  // Wait for metadata
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("HLS stream load timeout after 15 seconds"));
    }, 15000);

    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      resolve();
    };
    video.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Failed to load HLS stream"));
    };
    if (video.readyState >= 1) {
      clearTimeout(timeout);
      resolve();
    }
  });

  await video.play();

  // Auto-resume if the browser pauses the hidden video
  const resumePlayback = () => {
    if (video.paused && !video.ended) {
      video.play().catch(() => {});
    }
  };
  video.addEventListener("canplay", resumePlayback);
  video.addEventListener("canplaythrough", resumePlayback);

  // Canvas capture — draw video frames and produce a MediaStream
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get canvas 2D context");
  }

  let animationFrameId = 0;
  const drawFrame = () => {
    if (!video.paused && !video.ended && video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    animationFrameId = requestAnimationFrame(drawFrame);
  };
  drawFrame();

  const stream = canvas.captureStream(30);

  if (!stream || stream.getVideoTracks().length === 0) {
    throw new Error("Failed to capture HLS stream");
  }

  return {
    stream,
    video,
    canvas,
    hls: hlsInstance,
    animationFrameId,
  };
}
