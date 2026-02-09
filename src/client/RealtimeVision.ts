import { StreamClient } from "./client";
import { DEFAULT_API_URL } from "./constants";

import {
  type StreamInferenceResult,
  type StreamProcessingConfig,
  type StreamSource,
  type StreamMode,
  type ClipProcessingConfig,
  type FrameProcessingConfig,
  type ModelBackend,
  type SourceConfig,
} from "./types";

/**
 * Default configuration values for RealtimeVision
 * Only includes fallback FPS and ICE servers - all other values must be explicitly provided
 */
const DEFAULTS = {
  FALLBACK_FPS: 30,
  ICE_SERVERS: [
    {
      urls: "turn:turn.overshoot.ai:3478?transport=udp",
      username: "1769538895:c66a907c-61f4-4ec2-93a6-9d6b932776bb",
      credential: "Fu9L4CwyYZvsOLc+23psVAo3i/Y=",
    },
    {
      urls: "turn:turn.overshoot.ai:3478?transport=tcp",
      username: "1769538895:c66a907c-61f4-4ec2-93a6-9d6b932776bb",
      credential: "Fu9L4CwyYZvsOLc+23psVAo3i/Y=",
    },
    {
      urls: "turns:turn.overshoot.ai:443?transport=udp",
      username: "1769538895:c66a907c-61f4-4ec2-93a6-9d6b932776bb",
      credential: "Fu9L4CwyYZvsOLc+23psVAo3i/Y=",
    },
    {
      urls: "turns:turn.overshoot.ai:443?transport=tcp",
      username: "1769538895:c66a907c-61f4-4ec2-93a6-9d6b932776bb",
      credential: "Fu9L4CwyYZvsOLc+23psVAo3i/Y=",
    },
  ] as RTCIceServer[],
} as const;

/**
 * Validation constraints
 */
const CONSTRAINTS = {
  // Clip mode constraints
  SAMPLING_RATIO: { min: 0, max: 1 },
  FPS: { min: 1, max: 120 },
  CLIP_LENGTH_SECONDS: { min: 0.1, max: 60 },
  DELAY_SECONDS: { min: 0, max: 60 },
  // Frame mode constraints
  INTERVAL_SECONDS: { min: 0.1, max: 60 },
} as const;

/**
 * Logger utility for controlled logging
 */
class Logger {
  private debugEnabled: boolean;

  constructor(debugEnabled: boolean = false) {
    this.debugEnabled = debugEnabled;
  }

  debug(...args: any[]): void {
    if (this.debugEnabled) {
      console.log("[RealtimeVision Debug]", ...args);
    }
  }

  info(...args: any[]): void {
    console.log("[RealtimeVision]", ...args);
  }

  warn(...args: any[]): void {
    console.warn("[RealtimeVision]", ...args);
  }

  error(...args: any[]): void {
    console.error("[RealtimeVision]", ...args);
  }
}

/**
 * Clip mode processing configuration
 */
export interface ClipModeProcessing {
  /**
   * Sampling ratio (0-1). Controls what fraction of frames are processed.
   */
  sampling_ratio?: number;
  /**
   * Frames per second (1-120)
   */
  fps?: number;
  /**
   * Clip length in seconds (0.1-60)
   */
  clip_length_seconds?: number;
  /**
   * Delay in seconds (0-60)
   */
  delay_seconds?: number;
}

/**
 * Frame mode processing configuration
 */
export interface FrameModeProcessing {
  /**
   * Interval between frame captures in seconds (0.1-60)
   */
  interval_seconds?: number;
}

export interface RealtimeVisionConfig {
  /**
   * Base URL for the API (e.g., "https://api.example.com")
   * Defaults to "https://api.overshoot.ai/" if not provided
   */
  apiUrl?: string;

  /**
   * API key for authentication
   * Required for all API requests
   */
  apiKey: string;

  /**
   * The prompt/task to run on window segments of the stream.
   * This runs continuously (at a defined window interval).
   *
   * Examples:
   * - "Read any visible text"
   * - "Detect objects and return as JSON array"
   * - "Describe facial expression"
   */
  prompt: string;

  /**
   * Video source configuration (REQUIRED)
   * Available types:
   * - "camera": { type: "camera", cameraFacing: "user" | "environment" }
   * - "video": { type: "video", file: File }
   * - "screen": { type: "screen" }
   * - "livekit": { type: "livekit", url: string, token: string }
   */
  source: StreamSource;

  /**
   * Model backend to use (REQUIRED)
   * Available options: "overshoot", "gemini"
   */
  backend: ModelBackend;

  /**
   * Model name to use for inference (REQUIRED)
   * Example: "Qwen/Qwen3-VL-30B-A3B-Instruct"
   */
  model: string;

  /**
   * Optional JSON schema for structured output
   */
  outputSchema?: Record<string, any>;

  /**
   * Called when a new inference result arrives
   */
  onResult: (result: StreamInferenceResult) => void;

  /**
   * Called when an error occurs
   */
  onError?: (error: Error) => void;

  /**
   * Processing mode
   * - "clip": Video clip inference with frame bundling (for motion/temporal understanding)
   * - "frame": Single image inference at intervals (for static analysis)
   *
   * If not specified, mode is inferred from processing config:
   * - If interval_seconds is present → frame mode
   * - Otherwise → clip mode (default)
   */
  mode?: StreamMode;

  /**
   * Clip mode processing configuration (REQUIRED for clip mode)
   * Must include: sampling_ratio, clip_length_seconds, delay_seconds
   * Used when mode is "clip" or not specified (default)
   */
  clipProcessing?: ClipModeProcessing;

  /**
   * Frame mode processing configuration (REQUIRED for frame mode)
   * Must include: interval_seconds
   * Used when mode is "frame"
   */
  frameProcessing?: FrameModeProcessing;

  /**
   * @deprecated Use `clipProcessing` instead. This property will be removed in a future version.
   * Legacy processing configuration (clip mode only)
   */
  processing?: ClipModeProcessing;

  /**
   * ICE servers for WebRTC connection
   * If not provided, uses default TURN servers
   */
  iceServers?: RTCIceServer[];

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class RealtimeVision {
  private config: RealtimeVisionConfig;
  private client: StreamClient;
  private logger: Logger;

  private mediaStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private webSocket: WebSocket | null = null;
  private streamId: string | null = null;
  private keepaliveInterval: number | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private canvasAnimationFrameId: number | null = null;

  private isRunning = false;

  constructor(config: RealtimeVisionConfig) {
    this.validateConfig(config);
    this.config = config;
    this.logger = new Logger(config.debug ?? false);

    // Warn about deprecated processing property
    if (config.processing) {
      this.logger.warn(
        'The "processing" config option is deprecated. Use "clipProcessing" instead.',
      );
    }

    // Use provided apiUrl if it's a non-empty string, otherwise use default
    const apiUrl = config.apiUrl?.trim() || DEFAULT_API_URL;

    this.client = new StreamClient({
      baseUrl: apiUrl,
      apiKey: config.apiKey,
    });
  }

  /**
   * Validate configuration values
   */
  private validateConfig(config: RealtimeVisionConfig): void {
    // Validate apiUrl if provided
    if (config.apiUrl !== undefined) {
      if (typeof config.apiUrl !== "string" || config.apiUrl.trim() === "") {
        throw new ValidationError("apiUrl must be a non-empty string");
      }
    }

    if (!config.apiKey || typeof config.apiKey !== "string") {
      throw new ValidationError("apiKey is required and must be a string");
    }

    if (!config.prompt || typeof config.prompt !== "string") {
      throw new ValidationError("prompt is required and must be a string");
    }

    // Require backend
    if (!config.backend) {
      throw new ValidationError(
        'backend is required. Available options: "overshoot", "gemini"',
      );
    }
    if (config.backend !== "overshoot" && config.backend !== "gemini") {
      throw new ValidationError(
        'backend must be "overshoot" or "gemini". Provided: ' + config.backend,
      );
    }

    // Require model
    if (!config.model || typeof config.model !== "string") {
      throw new ValidationError(
        "model is required and must be a non-empty string. Example: \"Qwen/Qwen3-VL-30B-A3B-Instruct\"",
      );
    }

    // Require source
    if (!config.source) {
      throw new ValidationError(
        'source is required. Available types: "camera" (with cameraFacing: "user" | "environment"), "video" (with file: File), "screen", "livekit" (with url and token)',
      );
    }

    if (config.mode && config.mode !== "clip" && config.mode !== "frame") {
      throw new ValidationError('mode must be "clip" or "frame"');
    }

    // Validate source type and its required fields
    if (config.source) {
      if (config.source.type === "camera") {
        if (
          config.source.cameraFacing !== "user" &&
          config.source.cameraFacing !== "environment"
        ) {
          throw new ValidationError(
            'cameraFacing must be "user" or "environment"',
          );
        }
      } else if (config.source.type === "video") {
        if (!(config.source.file instanceof File)) {
          throw new ValidationError("video source must provide a File object");
        }
      } else if (config.source.type === "livekit") {
        if (!config.source.url || typeof config.source.url !== "string") {
          throw new ValidationError(
            "livekit source url is required and must be a non-empty string",
          );
        }
        if (!config.source.token || typeof config.source.token !== "string") {
          throw new ValidationError(
            "livekit source token is required and must be a non-empty string",
          );
        }
      } else if (config.source.type === "screen") {
        // Check browser support at validation time
        if (!navigator.mediaDevices?.getDisplayMedia) {
          throw new ValidationError(
            "Screen sharing is not supported in this browser. getDisplayMedia API is required.",
          );
        }
      } else {
        throw new ValidationError(
          'source.type must be "camera", "video", "livekit", or "screen"',
        );
      }
    }

    // Validate clip mode processing config
    if (config.clipProcessing?.sampling_ratio !== undefined) {
      const ratio = config.clipProcessing.sampling_ratio;
      if (
        ratio < CONSTRAINTS.SAMPLING_RATIO.min ||
        ratio > CONSTRAINTS.SAMPLING_RATIO.max
      ) {
        throw new ValidationError(
          `sampling_ratio must be between ${CONSTRAINTS.SAMPLING_RATIO.min} and ${CONSTRAINTS.SAMPLING_RATIO.max}`,
        );
      }
    }

    if (config.clipProcessing?.fps !== undefined) {
      const fps = config.clipProcessing.fps;
      if (fps < CONSTRAINTS.FPS.min || fps > CONSTRAINTS.FPS.max) {
        throw new ValidationError(
          `fps must be between ${CONSTRAINTS.FPS.min} and ${CONSTRAINTS.FPS.max}`,
        );
      }
    }

    if (config.clipProcessing?.clip_length_seconds !== undefined) {
      const clip = config.clipProcessing.clip_length_seconds;
      if (
        clip < CONSTRAINTS.CLIP_LENGTH_SECONDS.min ||
        clip > CONSTRAINTS.CLIP_LENGTH_SECONDS.max
      ) {
        throw new ValidationError(
          `clip_length_seconds must be between ${CONSTRAINTS.CLIP_LENGTH_SECONDS.min} and ${CONSTRAINTS.CLIP_LENGTH_SECONDS.max}`,
        );
      }
    }

    if (config.clipProcessing?.delay_seconds !== undefined) {
      const delay = config.clipProcessing.delay_seconds;
      if (
        delay < CONSTRAINTS.DELAY_SECONDS.min ||
        delay > CONSTRAINTS.DELAY_SECONDS.max
      ) {
        throw new ValidationError(
          `delay_seconds must be between ${CONSTRAINTS.DELAY_SECONDS.min} and ${CONSTRAINTS.DELAY_SECONDS.max}`,
        );
      }
    }

    // Validate frame mode processing config
    if (config.frameProcessing?.interval_seconds !== undefined) {
      const interval = config.frameProcessing.interval_seconds;
      if (
        interval < CONSTRAINTS.INTERVAL_SECONDS.min ||
        interval > CONSTRAINTS.INTERVAL_SECONDS.max
      ) {
        throw new ValidationError(
          `interval_seconds must be between ${CONSTRAINTS.INTERVAL_SECONDS.min} and ${CONSTRAINTS.INTERVAL_SECONDS.max}`,
        );
      }
    }

    // Validate deprecated processing config (same as clipProcessing)
    if (config.processing?.sampling_ratio !== undefined) {
      const ratio = config.processing.sampling_ratio;
      if (
        ratio < CONSTRAINTS.SAMPLING_RATIO.min ||
        ratio > CONSTRAINTS.SAMPLING_RATIO.max
      ) {
        throw new ValidationError(
          `sampling_ratio must be between ${CONSTRAINTS.SAMPLING_RATIO.min} and ${CONSTRAINTS.SAMPLING_RATIO.max}`,
        );
      }
    }

    if (config.processing?.fps !== undefined) {
      const fps = config.processing.fps;
      if (fps < CONSTRAINTS.FPS.min || fps > CONSTRAINTS.FPS.max) {
        throw new ValidationError(
          `fps must be between ${CONSTRAINTS.FPS.min} and ${CONSTRAINTS.FPS.max}`,
        );
      }
    }

    if (config.processing?.clip_length_seconds !== undefined) {
      const clip = config.processing.clip_length_seconds;
      if (
        clip < CONSTRAINTS.CLIP_LENGTH_SECONDS.min ||
        clip > CONSTRAINTS.CLIP_LENGTH_SECONDS.max
      ) {
        throw new ValidationError(
          `clip_length_seconds must be between ${CONSTRAINTS.CLIP_LENGTH_SECONDS.min} and ${CONSTRAINTS.CLIP_LENGTH_SECONDS.max}`,
        );
      }
    }

    if (config.processing?.delay_seconds !== undefined) {
      const delay = config.processing.delay_seconds;
      if (
        delay < CONSTRAINTS.DELAY_SECONDS.min ||
        delay > CONSTRAINTS.DELAY_SECONDS.max
      ) {
        throw new ValidationError(
          `delay_seconds must be between ${CONSTRAINTS.DELAY_SECONDS.min} and ${CONSTRAINTS.DELAY_SECONDS.max}`,
        );
      }
    }
  }

  /**
   * Create media stream from the configured source
   */
  private async createMediaStream(source: StreamSource): Promise<MediaStream> {
    this.logger.debug("Creating media stream from source:", source.type);

    switch (source.type) {
      case "camera":
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: source.cameraFacing } },
          audio: false,
        });

      case "video":
        const video = document.createElement("video");
        video.src = URL.createObjectURL(source.file);
        video.muted = true;
        video.loop = true;
        video.playsInline = true;

        this.logger.debug("Loading video file:", source.file.name);

        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Video loading timeout after 10 seconds"));
          }, 10000);

          video.onloadedmetadata = () => {
            clearTimeout(timeout);
            this.logger.debug("Video metadata loaded");
            resolve();
          };

          video.onerror = (e) => {
            clearTimeout(timeout);
            this.logger.error("Video loading error:", e);
            reject(new Error("Failed to load video file"));
          };

          if (video.readyState >= 1) {
            clearTimeout(timeout);
            resolve();
          }
        });

        await video.play();
        this.logger.debug("Video playback started");

        let stream: MediaStream;

        // Check if captureStream is supported (Chrome, Firefox)
        if (typeof video.captureStream === "function") {
          this.logger.debug("Using native video.captureStream()");
          stream = video.captureStream();
        } else {
          // Safari fallback: use canvas to capture the video stream
          this.logger.debug(
            "captureStream not supported, using canvas fallback for Safari",
          );

          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            throw new Error("Failed to get canvas 2D context");
          }

          // Draw video frames to canvas continuously
          const drawFrame = () => {
            if (!video.paused && !video.ended) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              this.canvasAnimationFrameId = requestAnimationFrame(drawFrame);
            }
          };
          drawFrame();

          // Capture stream from canvas (30 fps)
          stream = canvas.captureStream(30);
          this.canvasElement = canvas;
        }

        if (!stream) {
          throw new Error("Failed to capture video stream");
        }

        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length === 0) {
          throw new Error("Video stream has no video tracks");
        }

        this.videoElement = video;
        return stream;

      case "screen":
        try {
          this.logger.debug("Requesting screen share...");

          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 },
            },
            audio: false,
          });

          const videoTracks = screenStream.getVideoTracks();
          if (videoTracks.length === 0) {
            throw new Error("Screen capture stream has no video tracks");
          }

          const screenTrack = videoTracks[0];

          // CRITICAL: Handle user clicking "Stop Sharing" in browser chrome
          screenTrack.onended = () => {
            this.logger.info("Screen sharing stopped by user");
            this.handleFatalError(
              new Error("Screen sharing was stopped by the user"),
            );
          };

          this.logger.debug("Screen capture started successfully");
          return screenStream;

        } catch (error: any) {
          // User cancelled the picker
          if (error.name === "NotAllowedError") {
            throw new Error(
              "Screen sharing permission denied. User must allow screen capture to proceed.",
            );
          }
          throw new Error(
            `Failed to capture screen: ${error.message || "Unknown error"}`,
          );
        }

      default:
        throw new Error(`Unknown source type: ${(source as any).type}`);
    }
  }

  /**
   * Get FPS from media stream
   */
  private async getStreamFps(
    stream: MediaStream | null,
    source: StreamSource,
  ): Promise<number> {
    const fallback = (): number => DEFAULTS.FALLBACK_FPS;

    if (!stream) {
      this.logger.warn("Stream is null, using fallback FPS");
      return fallback();
    }

    const videoTracks = stream.getVideoTracks();
    if (!videoTracks || videoTracks.length === 0) {
      this.logger.warn("No video tracks found, using fallback FPS");
      return fallback();
    }

    const videoTrack = videoTracks[0];
    if (!videoTrack) {
      this.logger.warn("First video track is null, using fallback FPS");
      return fallback();
    }

    // For camera sources, get FPS from track settings
    if (source.type === "camera") {
      const settings = videoTrack.getSettings();
      const raw = settings.frameRate ?? 0;
      const fps =
        typeof raw === "number" && raw > 0 ? raw : DEFAULTS.FALLBACK_FPS;
      this.logger.debug("Detected camera FPS:", fps);
      return Math.round(fps);
    }

    // For screen sources, get FPS from track settings (same as camera)
    if (source.type === "screen") {
      const settings = videoTrack.getSettings();
      const raw = settings.frameRate ?? 0;
      const fps =
        typeof raw === "number" && raw > 0 ? raw : DEFAULTS.FALLBACK_FPS;
      this.logger.debug("Detected screen capture FPS:", fps);
      return Math.round(fps);
    }

    // For video file sources, try to get FPS from the captured stream track
    if (source.type === "video") {
      // Ensure video metadata is loaded before reading settings
      if (this.videoElement) {
        await new Promise<void>((resolve, reject) => {
          if (this.videoElement!.readyState >= 1) {
            resolve();
          } else {
            this.videoElement!.onloadedmetadata = () => resolve();
            this.videoElement!.onerror = () =>
              reject(new Error("Failed to load video metadata"));
          }
        });
      }

      const settings = videoTrack.getSettings();
      this.logger.debug("Video file settings:", settings);
      const raw = settings.frameRate ?? 0;
      if (typeof raw === "number" && raw > 0) {
        this.logger.debug("Detected video file FPS:", raw);
        return Math.round(raw);
      }

      this.logger.debug(
        "Could not detect video file FPS, using fallback:",
        DEFAULTS.FALLBACK_FPS,
      );
      return fallback();
    }

    return fallback();
  }

  /**
   * Determine the stream mode from config
   * - If explicitly set, use that
   * - If frameProcessing.interval_seconds is set, use frame mode
   * - Otherwise, default to clip mode
   */
  private getMode(): StreamMode {
    if (this.config.mode) {
      return this.config.mode;
    }

    // Infer mode from processing config
    if (this.config.frameProcessing?.interval_seconds !== undefined) {
      return "frame";
    }

    return "clip";
  }

  /**
   * Get processing configuration - requires explicit values
   */
  private getProcessingConfig(detectedFps: number): StreamProcessingConfig {
    const mode = this.getMode();

    if (mode === "frame") {
      if (!this.config.frameProcessing?.interval_seconds) {
        throw new ValidationError(
          `frameProcessing.interval_seconds is required for frame mode. Must be between ${CONSTRAINTS.INTERVAL_SECONDS.min} and ${CONSTRAINTS.INTERVAL_SECONDS.max} seconds.`,
        );
      }
      return {
        interval_seconds: this.config.frameProcessing.interval_seconds,
      } as FrameProcessingConfig;
    }

    // Clip mode - use clipProcessing, fall back to deprecated processing
    const clipConfig = this.config.clipProcessing || this.config.processing;

    if (!clipConfig) {
      throw new ValidationError(
        `clipProcessing is required for clip mode. Must include: sampling_ratio (${CONSTRAINTS.SAMPLING_RATIO.min}-${CONSTRAINTS.SAMPLING_RATIO.max}), clip_length_seconds (${CONSTRAINTS.CLIP_LENGTH_SECONDS.min}-${CONSTRAINTS.CLIP_LENGTH_SECONDS.max}s), delay_seconds (${CONSTRAINTS.DELAY_SECONDS.min}-${CONSTRAINTS.DELAY_SECONDS.max}s)`,
      );
    }

    if (clipConfig.sampling_ratio === undefined) {
      throw new ValidationError(
        `clipProcessing.sampling_ratio is required for clip mode. Must be between ${CONSTRAINTS.SAMPLING_RATIO.min} and ${CONSTRAINTS.SAMPLING_RATIO.max}.`,
      );
    }

    if (clipConfig.clip_length_seconds === undefined) {
      throw new ValidationError(
        `clipProcessing.clip_length_seconds is required for clip mode. Must be between ${CONSTRAINTS.CLIP_LENGTH_SECONDS.min} and ${CONSTRAINTS.CLIP_LENGTH_SECONDS.max} seconds.`,
      );
    }

    if (clipConfig.delay_seconds === undefined) {
      throw new ValidationError(
        `clipProcessing.delay_seconds is required for clip mode. Must be between ${CONSTRAINTS.DELAY_SECONDS.min} and ${CONSTRAINTS.DELAY_SECONDS.max} seconds.`,
      );
    }

    return {
      sampling_ratio: clipConfig.sampling_ratio,
      fps: clipConfig.fps ?? detectedFps,
      clip_length_seconds: clipConfig.clip_length_seconds,
      delay_seconds: clipConfig.delay_seconds,
    } as ClipProcessingConfig;
  }

  /**
   * Get the source configuration (now required, no defaults)
   */
  private getSource(): StreamSource {
    // Source is now required and validated in validateConfig
    return this.config.source!;
  }

  /**
   * Start the vision stream
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("Vision stream already running");
    }

    try {
      const source = this.getSource();
      this.logger.debug("Starting stream with source type:", source.type);

      const mode = this.getMode();
      let sourceConfig: SourceConfig;

      if (source.type === "livekit") {
        // LiveKit path: no local media or WebRTC setup needed
        sourceConfig = { type: "livekit", url: source.url, token: source.token };
      } else {
        // WebRTC path: camera or video file
        if (source.type === "video") {
          this.logger.debug("Video file:", {
            name: source.file.name,
            size: source.file.size,
            type: source.file.type,
          });

          if (!source.file || !(source.file instanceof File)) {
            throw new Error("Invalid video file");
          }
        }

        // Create media stream
        this.mediaStream = await this.createMediaStream(source);
        const videoTrack = this.mediaStream.getVideoTracks()[0];
        if (!videoTrack) {
          throw new Error("No video track available");
        }

        // Set up WebRTC peer connection
        const iceServers = this.config.iceServers ?? DEFAULTS.ICE_SERVERS;
        this.logger.debug("Creating peer connection with ICE servers");
        this.peerConnection = new RTCPeerConnection({ iceServers });

        // Set up ICE logging
        this.peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            this.logger.debug("ICE candidate:", {
              type: event.candidate.type,
              protocol: event.candidate.protocol,
            });
          } else {
            this.logger.debug("ICE gathering complete");
          }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
          this.logger.debug(
            "ICE connection state:",
            this.peerConnection?.iceConnectionState,
          );
        };

        this.peerConnection.addTrack(videoTrack, this.mediaStream);

        // Create and set local offer
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

        if (!this.peerConnection.localDescription) {
          throw new Error("Failed to create local description");
        }

        sourceConfig = {
          type: "webrtc",
          sdp: this.peerConnection.localDescription.sdp,
        };
      }

      // Get FPS — use fallback for LiveKit since there's no local stream
      const detectedFps =
        source.type === "livekit"
          ? DEFAULTS.FALLBACK_FPS
          : await this.getStreamFps(this.mediaStream, source);

      // Create stream on server
      this.logger.debug("Creating stream on server with mode:", mode);
      const response = await this.client.createStream({
        source: sourceConfig,
        mode,
        processing: this.getProcessingConfig(detectedFps),
        inference: {
          prompt: this.config.prompt,
          backend: this.config.backend!,
          model: this.config.model!,
          output_schema_json: this.config.outputSchema,
        },
      });

      this.logger.debug("Backend response received:", {
        stream_id: response.stream_id,
        has_turn_servers: !!response.turn_servers,
      });

      // Set remote description (only for WebRTC sources)
      if (response.webrtc && this.peerConnection) {
        await this.peerConnection.setRemoteDescription(response.webrtc);
      }

      this.streamId = response.stream_id;
      this.logger.info("Stream started:", this.streamId);

      // Set up keepalive
      this.setupKeepalive(response.lease?.ttl_seconds);

      // Connect WebSocket for results
      this.setupWebSocket(response.stream_id);

      this.isRunning = true;
    } catch (error) {
      await this.handleFatalError(error);
      throw error;
    }
  }

  /**
   * Set up keepalive interval with error handling
   */
  private setupKeepalive(ttlSeconds: number | undefined): void {
    if (!ttlSeconds) {
      return;
    }

    const intervalMs = (ttlSeconds / 2) * 1000;
    this.logger.debug("Setting up keepalive with interval:", intervalMs, "ms");

    this.keepaliveInterval = window.setInterval(async () => {
      try {
        if (this.streamId) {
          await this.client.renewLease(this.streamId);
          this.logger.debug("Lease renewed");
        }
      } catch (error) {
        this.logger.error("Keepalive failed:", error);
        const keepaliveError = new Error(
          `Keepalive failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        await this.handleFatalError(keepaliveError);
      }
    }, intervalMs);
  }

  /**
   * Set up WebSocket connection with error handling
   */
  private setupWebSocket(streamId: string): void {
    this.logger.debug("Connecting WebSocket for stream:", streamId);
    this.webSocket = this.client.connectWebSocket(streamId);

    this.webSocket.onopen = () => {
      this.logger.debug("WebSocket connected");
      if (this.webSocket) {
        this.webSocket.send(JSON.stringify({ api_key: this.config.apiKey }));
      }
    };

    this.webSocket.onmessage = (event) => {
      try {
        const result: StreamInferenceResult = JSON.parse(event.data);
        this.config.onResult(result);
      } catch (error) {
        const parseError = new Error(
          `Failed to parse WebSocket message: ${error instanceof Error ? error.message : String(error)}`,
        );
        this.handleNonFatalError(parseError);
      }
    };

    this.webSocket.onerror = () => {
      this.logger.error("WebSocket error occurred");
      const error = new Error("WebSocket error occurred");
      this.handleFatalError(error);
    };

    this.webSocket.onclose = (event) => {
      if (this.isRunning) {
        if (event.code === 1008) {
          this.logger.error("WebSocket authentication failed");
          const error = new Error(
            "WebSocket authentication failed: Invalid or revoked API key",
          );
          this.handleFatalError(error);
        } else {
          this.logger.warn("WebSocket closed unexpectedly:", event.code);
          const error = new Error("WebSocket closed unexpectedly");
          this.handleFatalError(error);
        }
      } else {
        this.logger.debug("WebSocket closed");
      }
    };
  }

  /**
   * Handle non-fatal errors (report but don't stop stream)
   */
  private handleNonFatalError(error: Error): void {
    this.logger.warn("Non-fatal error:", error.message);
    if (this.config.onError) {
      this.config.onError(error);
    }
  }

  /**
   * Handle fatal errors (stop stream and report)
   */
  private async handleFatalError(error: unknown): Promise<void> {
    this.logger.error("Fatal error:", error);
    await this.cleanup();
    this.isRunning = false;

    const normalizedError =
      error instanceof Error ? error : new Error(String(error));

    if (this.config.onError) {
      this.config.onError(normalizedError);
    }
  }

  /**
   * Update the prompt/task while stream is running
   */
  async updatePrompt(prompt: string): Promise<void> {
    if (!this.isRunning || !this.streamId) {
      throw new Error("Vision stream not running");
    }

    if (!prompt || typeof prompt !== "string") {
      throw new ValidationError("prompt must be a non-empty string");
    }

    this.logger.debug("Updating prompt");
    await this.client.updatePrompt(this.streamId, prompt);
    this.logger.info("Prompt updated");
  }

  /**
   * Stop the vision stream and clean up resources
   */
  async stop(): Promise<void> {
    this.logger.info("Stopping stream");
    await this.cleanup();
    this.isRunning = false;
  }

  /**
   * Get the current stream ID
   */
  getStreamId(): string | null {
    return this.streamId;
  }

  /**
   * Get the media stream (for displaying video preview)
   */
  getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  /**
   * Check if the stream is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  private async cleanup(): Promise<void> {
    this.logger.debug("Cleaning up resources");

    // Close stream on server (triggers final billing)
    if (this.streamId) {
      try {
        await this.client.closeStream(this.streamId);
        this.logger.debug("Stream closed on server");
      } catch (error) {
        // Log but don't throw - we still want to clean up local resources
        this.logger.warn(
          "Failed to close stream on server:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    if (this.keepaliveInterval) {
      window.clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }

    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.canvasAnimationFrameId) {
      cancelAnimationFrame(this.canvasAnimationFrameId);
      this.canvasAnimationFrameId = null;
    }

    if (this.canvasElement) {
      this.canvasElement.remove();
      this.canvasElement = null;
    }

    if (this.videoElement) {
      this.videoElement.pause();
      URL.revokeObjectURL(this.videoElement.src);
      this.videoElement.remove();
      this.videoElement = null;
    }

    this.streamId = null;
    this.logger.debug("Cleanup complete");
  }
}
