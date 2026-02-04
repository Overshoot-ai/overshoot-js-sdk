export type StreamSource =
  | { type: "camera"; cameraFacing: "user" | "environment" }
  | { type: "video"; file: File };

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
};

export type StreamClientMeta = {
  request_id?: string;
};

export type StreamCreateRequest = {
  webrtc: WebRtcOffer;
  mode?: StreamMode;
  processing: StreamProcessingConfig;
  inference: StreamInferenceConfig;
  client?: StreamClientMeta;
};

export type StreamCreateResponse = {
  stream_id: string;
  webrtc: WebRtcAnswer;
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
