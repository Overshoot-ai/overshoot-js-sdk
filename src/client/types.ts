export type StreamSource =
  | { type: "camera"; cameraFacing: "user" | "environment" }
  | { type: "video"; file: File }
  | { type: "livekit"; url: string; token: string }
  | { type: "screen" };

export type WebRtcOffer = {
  type: "offer";
  sdp: string;
};

export type WebRtcAnswer = {
  type: "answer";
  sdp: string;
};

/**
 * Stream processing mode
 * - "clip": Video clip inference with frame bundling (for motion/temporal understanding)
 * - "frame": Single image inference at intervals (for static analysis)
 */
export type StreamMode = "clip" | "frame";

/**
 * Processing config for clip mode - video clips with frame bundling
 */
export type ClipProcessingConfig = {
  sampling_ratio: number;
  fps: number;
  clip_length_seconds?: number;
  delay_seconds?: number;
};

/**
 * Processing config for frame mode - single images at intervals
 */
export type FrameProcessingConfig = {
  interval_seconds: number;
};

/**
 * Union type for processing configuration
 * Mode is inferred if not specified:
 * - If interval_seconds is present → frame mode
 * - Otherwise → clip mode
 */
export type StreamProcessingConfig =
  | ClipProcessingConfig
  | FrameProcessingConfig;

/**
 * Model backend for inference
 */
export type ModelBackend = "overshoot" | "gemini";

export type StreamInferenceConfig = {
  prompt: string;
  backend: ModelBackend;
  model: string;
  output_schema_json?: Record<string, any>;
  /**
   * Max tokens per inference request. If omitted, the server defaults to
   * floor(128 × interval) where interval is delay_seconds or interval_seconds.
   * If provided, must satisfy: max_output_tokens / interval ≤ 128.
   */
  max_output_tokens?: number;
};

/**
 * Model availability status
 * - "unavailable": Model endpoint is not reachable (will reject requests)
 * - "ready": Model is healthy and performing well
 * - "degraded": Model is near capacity, expect higher latency
 * - "saturated": Model is at capacity and will reject new streams
 */
export type ModelStatus = "unavailable" | "ready" | "degraded" | "saturated";

export type ModelInfo = {
  model: string;
  ready: boolean;
  status: ModelStatus;
};

export type StreamClientMeta = {
  request_id?: string;
};

export type WebRTCSourceConfig = { type: "webrtc"; sdp: string };
export type LiveKitSourceConfig = { type: "livekit"; url: string; token: string };
export type SourceConfig = WebRTCSourceConfig | LiveKitSourceConfig;

export type StreamCreateRequest = {
  source: SourceConfig;
  mode?: StreamMode;
  processing: StreamProcessingConfig;
  inference: StreamInferenceConfig;
  client?: StreamClientMeta;
};

export type StreamCreateResponse = {
  stream_id: string;
  webrtc?: WebRtcAnswer;
  lease?: {
    ttl_seconds: number;
  };
  turn_servers?: RTCIceServer[];
};

export type StreamInferenceResult = {
  id: string;
  stream_id: string;
  mode: StreamMode;
  model_backend: ModelBackend;
  model_name: string;
  prompt: string;
  result: string; // normal string or parseable json string depending on the stream
  inference_latency_ms: number;
  total_latency_ms: number;
  ok: boolean;
  error: string | null;
};

export type StreamConfigResponse = {
  id: string;
  stream_id: string;
  prompt: string;
  backend: ModelBackend;
  model: string;
  output_schema_json?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
};

export type KeepaliveResponse = {
  status: "ok";
  stream_id: string;
  ttl_seconds: number;
};

export type StatusResponse = {
  status: "ok";
};

export type ErrorResponse = {
  error: string;
  message?: string;
  request_id?: string;
  details?: any;
};
