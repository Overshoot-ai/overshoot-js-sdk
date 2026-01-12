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
      urls: ["turn:34.63.114.235:3478"],
      username: "demo",
      credential: "demo-password",
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
  RATING: { min: 1, max: 5 },
} as const;

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
  backend?: "gemini" | "overshoot";

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
   * @deprecated Use source instead. This will be removed in a future version.
   * Camera facing mode
   */
  cameraFacing?: "user" | "environment";

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
   * If not provided, uses Google's public STUN server
   */
  iceServers?: RTCIceServer[];
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

  private mediaStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private webSocket: WebSocket | null = null;
  private streamId: string | null = null;
  private keepaliveInterval: number | null = null;
  private videoElement: HTMLVideoElement | null = null;

  private isRunning = false;

  constructor(config: RealtimeVisionConfig) {
    this.validateConfig(config);
    this.config = config;
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
    console.log("createMediaStream called with source:", source);

    switch (source.type) {
      case "camera":
        console.log("Using camera source");
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: source.cameraFacing } },
          audio: false,
        });

      case "video":
        console.log("Using video file source");
        const video = document.createElement("video");
        video.src = URL.createObjectURL(source.file);
        video.muted = true;
        video.loop = true;
        video.playsInline = true; // Important for mobile

        console.log("Loading video file:", source.file.name);

        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Video loading timeout after 10 seconds"));
          }, 10000);

          video.onloadedmetadata = () => {
            clearTimeout(timeout);
            console.log("Video metadata loaded, readyState:", video.readyState);
            resolve();
          };

          video.onerror = (e) => {
            clearTimeout(timeout);
            console.error("Video loading error:", e);
            reject(new Error("Failed to load video file"));
          };

          // Also try to load in case metadata is already loaded
          if (video.readyState >= 1) {
            clearTimeout(timeout);
            console.log("Video metadata already loaded");
            resolve();
          }
        });

        console.log("Starting video playback");
        await video.play();
        console.log("Video playing, readyState:", video.readyState);

        // Try to capture stream
        let stream: MediaStream | null = null;
        try {
          stream = video.captureStream();
          console.log("captureStream() returned:", stream);
        } catch (e) {
          console.error("captureStream() error:", e);
          throw new Error(`Failed to capture video stream: ${e}`);
        }

        if (!stream) {
          throw new Error("captureStream() returned null or undefined");
        }

        // Ensure the stream has video tracks
        const videoTracks = stream.getVideoTracks();
        console.log("Video tracks:", videoTracks.length);

        if (videoTracks.length === 0) {
          throw new Error("Video stream has no video tracks");
        }

        this.videoElement = video;
        console.log("Video file source ready");
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
      console.warn("Stream is null, using fallback FPS");
      return DEFAULTS.FALLBACK_FPS;
    }

    const videoTracks = stream.getVideoTracks();
    if (!videoTracks || videoTracks.length === 0) {
      console.warn("No video tracks found, using fallback FPS");
      return DEFAULTS.FALLBACK_FPS;
    }

    const videoTrack = videoTracks[0];
    if (!videoTrack) {
      console.warn("First video track is null, using fallback FPS");
      return DEFAULTS.FALLBACK_FPS;
    }

    // For camera sources, get FPS from track settings
    if (source.type === "camera") {
      const settings = videoTrack.getSettings();
      return settings.frameRate ?? DEFAULTS.FALLBACK_FPS;
    }

    // For video file sources, try to get FPS from video element
    if (source.type === "video" && this.videoElement) {
      // Wait for video metadata to load
      await new Promise<void>((resolve, reject) => {
        if (this.videoElement!.readyState >= 1) {
          resolve();
        } else {
          this.videoElement!.onloadedmetadata = () => resolve();
          this.videoElement!.onerror = () =>
            reject(new Error("Failed to load video metadata"));
        }
      });

      // For video files, we can't reliably get FPS from the element
      // Use fallback FPS or let user specify in config
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
    // Handle deprecated cameraFacing property
    if (this.config.cameraFacing && !this.config.source) {
      return {
        type: "camera",
        cameraFacing: this.config.cameraFacing,
      };
    }

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
      // Get media stream from configured source
      const source = this.getSource();
      console.log("Starting with source:", source.type);

      // CRITICAL DEBUG: Check if File object exists for video sources
      if (source.type === "video") {
        console.log("Video source file:", source.file);
        console.log("File is instance of File:", source.file instanceof File);
        console.log("File name:", source.file?.name);
        console.log("File size:", source.file?.size);

        if (!source.file) {
          throw new Error("Video source has no file!");
        }
        if (!(source.file instanceof File)) {
          throw new Error("Video source.file is not a File object!");
        }
      }

      this.mediaStream = await this.createMediaStream(source);
      console.log("mediaStream after createMediaStream:", this.mediaStream);

      // Get FPS for the stream
      const detectedFps = await this.getStreamFps(this.mediaStream, source);
      console.log("Detected FPS:", detectedFps);

      if (!this.mediaStream) {
        throw new Error("mediaStream is null after getMediaStream");
      }

      const videoTrack = this.mediaStream.getVideoTracks()[0];
      console.log("Video track:", videoTrack);

      if (!videoTrack) {
        throw new Error("No video track available");
      }

      // Set up WebRTC peer connection
      const iceServers = this.config.iceServers ?? DEFAULTS.ICE_SERVERS;
      this.peerConnection = new RTCPeerConnection({ iceServers });

      this.peerConnection.addTrack(videoTrack, this.mediaStream);

      // Create and set local offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      if (!this.peerConnection.localDescription) {
        throw new Error("Failed to create local description");
      }

      // Create stream on server (with API key authentication)
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

      // Set remote description
      await this.peerConnection.setRemoteDescription(response.webrtc);

      this.streamId = response.stream_id;

      // Set up keepalive (with API key authentication)
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
    this.keepaliveInterval = window.setInterval(async () => {
      try {
        if (this.streamId) {
          await this.client.renewLease(this.streamId);
        }
      } catch (error) {
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
    this.webSocket = this.client.connectWebSocket(streamId);

    this.webSocket.onopen = () => {
      // Send API key as first message for authentication
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
      const error = new Error("WebSocket error occurred");
      this.handleFatalError(error);
    };

    this.webSocket.onclose = (event) => {
      if (this.isRunning) {
        // Check if closed due to authentication failure
        if (event.code === 1008) {
          const error = new Error(
            "WebSocket authentication failed: Invalid or revoked API key",
          );
          this.handleFatalError(error);
        } else {
          const error = new Error("WebSocket closed unexpectedly");
          this.handleFatalError(error);
        }
      }
    };
  }

  /**
   * Handle non-fatal errors (report but don't stop stream)
   */
  private handleNonFatalError(error: Error): void {
    if (this.config.onError) {
      this.config.onError(error);
    }
  }

  /**
   * Handle fatal errors (stop stream and report)
   */
  private async handleFatalError(error: unknown): Promise<void> {
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

    await this.client.updatePrompt(this.streamId, prompt);
  }

  /**
   * Stop the vision stream and clean up resources
   */
  async stop(): Promise<void> {
    await this.cleanup();
    this.isRunning = false;
  }

  /**
   * Submit feedback for the stream
   */
  async submitFeedback(feedback: {
    rating: number;
    category: string;
    feedback?: string;
  }): Promise<void> {
    if (!this.streamId) {
      throw new Error("No active stream");
    }

    if (
      feedback.rating < CONSTRAINTS.RATING.min ||
      feedback.rating > CONSTRAINTS.RATING.max
    ) {
      throw new ValidationError(
        `rating must be between ${CONSTRAINTS.RATING.min} and ${CONSTRAINTS.RATING.max}`,
      );
    }

    if (!feedback.category || typeof feedback.category !== "string") {
      throw new ValidationError("category must be a non-empty string");
    }

    await this.client.submitFeedback(this.streamId, {
      rating: feedback.rating,
      category: feedback.category,
      feedback: feedback.feedback ?? "",
    });
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

    if (this.videoElement) {
      this.videoElement.pause();
      URL.revokeObjectURL(this.videoElement.src);
      this.videoElement.remove();
      this.videoElement = null;
    }

    this.streamId = null;
  }
}
