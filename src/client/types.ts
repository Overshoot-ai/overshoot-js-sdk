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

export type StreamProcessingConfig = {
  sampling_ratio: number;
  fps: number;
  clip_length_seconds?: number;
  delay_seconds?: number;
};

export type StreamInferenceConfig = {
  prompt: string;
  backend: "gemini" | "overshoot";
  model: string;
  output_schema_json?: Record<string, any>;
};

export type StreamClientMeta = {
  request_id?: string;
};

export type StreamCreateRequest = {
  webrtc: WebRtcOffer;
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
};

export type StreamInferenceResult = {
  id: string;
  stream_id: string;
  model_backend: "gemini" | "overshoot";
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
  backend: "gemini" | "overshoot";
  model: string;
  output_schema_json?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
};

export type FeedbackCreateRequest = {
  rating: number;
  category: string;
  feedback?: string;
};

export type FeedbackResponse = {
  id: string;
  stream_id: string;
  rating: number;
  category: string;
  feedback: string;
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
