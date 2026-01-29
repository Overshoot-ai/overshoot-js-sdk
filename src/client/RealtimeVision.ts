import { StreamClient } from "./client";

import {
  type StreamInferenceResult,
  type StreamProcessingConfig,
  type StreamSource,
} from "./types";

/**
 * Default configuration values for RealtimeVision
 */
const DEFAULTS = {
  BACKEND: "overshoot" as const,
  MODEL: "Qwen/Qwen3-VL-30B-A3B-Instruct",
  SOURCE: { type: "camera", cameraFacing: "environment" } as const,
  SAMPLING_RATIO: 0.1,
  CLIP_LENGTH_SECONDS: 1.0,
  DELAY_SECONDS: 1.0,
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
  SAMPLING_RATIO: { min: 0, max: 1 },
  FPS: { min: 1, max: 120 },
  CLIP_LENGTH_SECONDS: { min: 0.1, max: 60 },
  DELAY_SECONDS: { min: 0, max: 60 },
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

export interface RealtimeVisionConfig {
  /**
   * Base URL for the API (e.g., "https://api.example.com")
   */
  apiUrl: string;

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
   * Video source configuration
   * Defaults to camera with environment facing if not specified
   */
  source?: StreamSource;

  /**
   * Model backend to use
   */
  backend?: "overshoot";

  /**
   * Model name to use for inference
   */
  model?: string;

  /**
   * Optional JSON schema for structured output
   */
  outputSchema?: Record<string, any>;

  /**
   * Called when a new inference result arrives (~1 per second)
   */
  onResult: (result: StreamInferenceResult) => void;

  /**
   * Called when an error occurs
   */
  onError?: (error: Error) => void;

  /**
   * Custom processing configuration
   * All fields are optional and will use defaults if not provided
   */
  processing?: {
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
  };

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
    this.client = new StreamClient({
      baseUrl: config.apiUrl,
      apiKey: config.apiKey,
    });
  }

  /**
   * Validate configuration values
   */
  private validateConfig(config: RealtimeVisionConfig): void {
    if (!config.apiUrl || typeof config.apiUrl !== "string") {
      throw new ValidationError("apiUrl is required and must be a string");
    }

    if (!config.apiKey || typeof config.apiKey !== "string") {
      throw new ValidationError("apiKey is required and must be a string");
    }

    if (!config.prompt || typeof config.prompt !== "string") {
      throw new ValidationError("prompt is required and must be a string");
    }

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
      } else {
        throw new ValidationError('source.type must be "camera" or "video"');
      }
    }

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
    if (!stream) {
      this.logger.warn("Stream is null, using fallback FPS");
      return DEFAULTS.FALLBACK_FPS;
    }

    const videoTracks = stream.getVideoTracks();
    if (!videoTracks || videoTracks.length === 0) {
      this.logger.warn("No video tracks found, using fallback FPS");
      return DEFAULTS.FALLBACK_FPS;
    }

    const videoTrack = videoTracks[0];
    if (!videoTrack) {
      this.logger.warn("First video track is null, using fallback FPS");
      return DEFAULTS.FALLBACK_FPS;
    }

    // For camera sources, get FPS from track settings
    if (source.type === "camera") {
      const settings = videoTrack.getSettings();
      const fps = settings.frameRate ?? DEFAULTS.FALLBACK_FPS;
      this.logger.debug("Detected camera FPS:", fps);
      return fps;
    }

    // For video file sources, try to get FPS from video element
    if (source.type === "video" && this.videoElement) {
      await new Promise<void>((resolve, reject) => {
        if (this.videoElement!.readyState >= 1) {
          resolve();
        } else {
          this.videoElement!.onloadedmetadata = () => resolve();
          this.videoElement!.onerror = () =>
            reject(new Error("Failed to load video metadata"));
        }
      });

      // For video files, use fallback FPS or user-specified config
      this.logger.debug("Using fallback FPS for video file");
      return DEFAULTS.FALLBACK_FPS;
    }

    return DEFAULTS.FALLBACK_FPS;
  }

  /**
   * Get processing configuration with defaults applied
   */
  private getProcessingConfig(detectedFps: number): StreamProcessingConfig {
    const userProcessing = this.config.processing || {};

    return {
      sampling_ratio: userProcessing.sampling_ratio ?? DEFAULTS.SAMPLING_RATIO,
      fps: userProcessing.fps ?? detectedFps,
      clip_length_seconds:
        userProcessing.clip_length_seconds ?? DEFAULTS.CLIP_LENGTH_SECONDS,
      delay_seconds: userProcessing.delay_seconds ?? DEFAULTS.DELAY_SECONDS,
    };
  }

  /**
   * Get the effective source configuration
   */
  private getSource(): StreamSource {
    return this.config.source ?? DEFAULTS.SOURCE;
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

      // Get FPS for the stream
      const detectedFps = await this.getStreamFps(this.mediaStream, source);

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

      // Create stream on server
      this.logger.debug("Creating stream on server");
      const response = await this.client.createStream({
        webrtc: {
          type: "offer",
          sdp: this.peerConnection.localDescription.sdp,
        },
        processing: this.getProcessingConfig(detectedFps),
        inference: {
          prompt: this.config.prompt,
          backend: this.config.backend ?? DEFAULTS.BACKEND,
          model: this.config.model ?? DEFAULTS.MODEL,
          output_schema_json: this.config.outputSchema,
        },
      });

      this.logger.debug("Backend response received:", {
        stream_id: response.stream_id,
        has_turn_servers: !!response.turn_servers,
      });

      // Set remote description
      await this.peerConnection.setRemoteDescription(response.webrtc);

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
