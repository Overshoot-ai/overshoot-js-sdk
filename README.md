# Overshoot SDK

> **⚠️ Alpha Release**: This is an alpha version (0.1.0-alpha.0). The API may change in future versions.

TypeScript SDK for real-time AI vision analysis on live video streams.

## Installation

```bash
npm install overshoot@alpha
```

Or install a specific alpha version:

```bash
npm install overshoot@0.1.0-alpha.0
```

## Quick Start

### Camera Source

```typescript
import { RealtimeVision } from "overshoot";

const vision = new RealtimeVision({
  apiUrl: "https://api.overshoot.ai",
  apiKey: "your-api-key-here",
  prompt:
    "Read any visible text and return JSON: {text: string | null, confidence: number}",
  onResult: (result) => {
    console.log(result.result);
    console.log(`Latency: ${result.total_latency_ms}ms`);
  },
});

await vision.start();
```

### Video File Source

```typescript
const vision = new RealtimeVision({
  apiUrl: "https://api.overshoot.ai",
  apiKey: "your-api-key-here",
  prompt: "Detect all objects in the video and count them",
  source: {
    type: "video",
    file: videoFile, // File object from <input type="file">
  },
  onResult: (result) => {
    console.log(result.result);
  },
});

await vision.start();
```

## Configuration

### RealtimeVisionConfig

```typescript
interface RealtimeVisionConfig {
  // Required
  apiUrl: string; // API endpoint
  apiKey: string; // API key for authentication
  prompt: string; // Task description for the model
  onResult: (result: StreamInferenceResult) => void;

  // Optional
  source?: StreamSource; // Video source (default: environment-facing camera)
  backend?: "overshoot" | "gemini"; // Model backend (default: "overshoot")
  model?: string; // Model name (default: "Qwen/Qwen3-VL-30B-A3B-Instruct")
  outputSchema?: Record<string, any>; // JSON schema for structured output
  onError?: (error: Error) => void;
  debug?: boolean; // Enable debug logging (default: false)

  processing?: {
    fps?: number; // Actual source frames per second (1-120)
    sampling_ratio?: number; // Fraction of frames to process (0-1, default: 0.1)
    clip_length_seconds?: number; // Size of each clip that the VLM infers on (0.1-60, default: 1.0)
    delay_seconds?: number; // Shift between clips (0-60, default: 1.0)
  };

  iceServers?: RTCIceServer[]; // Custom WebRTC ICE servers
}
```

### StreamSource

```typescript
type StreamSource =
  | { type: "camera"; cameraFacing: "user" | "environment" }
  | { type: "video"; file: File };
```

## API Methods

```typescript
// Lifecycle
await vision.start(); // Start the video stream
await vision.stop(); // Stop and cleanup resources

// Runtime control
await vision.updatePrompt(newPrompt); // Update task while running

// State access
vision.getMediaStream(); // Get MediaStream for video preview
vision.getStreamId(); // Get current stream ID
vision.isActive(); // Check if stream is running
```

## Examples

### Object Detection with Structured Output

```typescript
const vision = new RealtimeVision({
  apiUrl: "https://api.overshoot.ai",
  apiKey: "your-api-key",
  prompt: "Detect objects and return JSON: {objects: string[], count: number}",
  outputSchema: {
    type: "object",
    properties: {
      objects: { type: "array", items: { type: "string" } },
      count: { type: "integer" },
    },
    required: ["objects", "count"],
  },
  onResult: (result) => {
    const data = JSON.parse(result.result);
    console.log(`Found ${data.count} objects:`, data.objects);
  },
});

await vision.start();
```

### Text Recognition (OCR)

```typescript
const vision = new RealtimeVision({
  apiUrl: "https://api.overshoot.ai",
  apiKey: "your-api-key",
  prompt: "Read all visible text in the image",
  onResult: (result) => {
    console.log("Text:", result.result);
  },
});

await vision.start();
```

### Video Preview Display

```typescript
const vision = new RealtimeVision({
  apiUrl: "https://api.overshoot.ai",
  apiKey: "your-api-key",
  prompt: "Describe what you see",
  onResult: (result) => console.log(result.result),
});

await vision.start();

// Attach to video element for preview
const videoElement = document.querySelector("video");
const stream = vision.getMediaStream();
if (stream) {
  videoElement.srcObject = stream;
}
```

### Dynamic Prompt Updates

```typescript
const vision = new RealtimeVision({
  apiUrl: "https://api.overshoot.ai",
  apiKey: "your-api-key",
  prompt: "Count people",
  onResult: (result) => console.log(result.result),
});

await vision.start();

// Change task without restarting stream
await vision.updatePrompt("Detect vehicles instead");
```

### Debug Mode

```typescript
const vision = new RealtimeVision({
  apiUrl: "https://api.overshoot.ai",
  apiKey: "your-api-key",
  prompt: "Detect objects",
  debug: true, // Enable detailed logging
  onResult: (result) => console.log(result.result),
});

await vision.start();
// Console will show detailed connection and processing logs
```

## Error Handling

```typescript
const vision = new RealtimeVision({
  apiUrl: "https://api.overshoot.ai",
  apiKey: "your-api-key",
  prompt: "Detect objects",
  onResult: (result) => {
    if (result.ok) {
      console.log("Success:", result.result);
    } else {
      console.error("Inference error:", result.error);
    }
  },
  onError: (error) => {
    if (error.name === "UnauthorizedError") {
      console.error("Invalid API key");
    } else if (error.name === "NetworkError") {
      console.error("Network error:", error.message);
    } else {
      console.error("Error:", error);
    }
  },
});

try {
  await vision.start();
} catch (error) {
  console.error("Failed to start:", error);
}
```

## Result Format

The `onResult` callback receives a `StreamInferenceResult` object:

```typescript
interface StreamInferenceResult {
  id: string; // Result ID
  stream_id: string; // Stream ID
  model_backend: "gemini" | "overshoot";
  model_name: string; // Model used
  prompt: string; // Task that was run
  result: string; // Model output (text or JSON string)
  inference_latency_ms: number; // Model inference time
  total_latency_ms: number; // End-to-end latency
  ok: boolean; // Success status
  error: string | null; // Error message if failed
}
```

## Use Cases

- Real-time text extraction and OCR
- Safety monitoring (PPE detection, hazard identification)
- Accessibility tools (scene description)
- Gesture recognition and control
- Document scanning and alignment detection
- Sports and fitness form analysis
- Video file content analysis

## Error Types

The SDK provides specific error classes for different failure modes:

- `ValidationError` - Invalid configuration or parameters
- `UnauthorizedError` - Invalid or revoked API key
- `NotFoundError` - Stream or resource not found
- `NetworkError` - Network connectivity issues
- `ServerError` - Server-side errors
- `ApiError` - General API errors

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test
npm run test:watch

# Type check
npm run type-check

# Lint
npm run lint
```

## Browser Compatibility

Requires browsers with support for:

- WebRTC (RTCPeerConnection)
- MediaStream API
- WebSocket
- Modern JavaScript (ES2020+)

Supported browsers: Chrome 80+, Firefox 75+, Safari 14+, Edge 80+

## Feedback

As this is an alpha release, we welcome your feedback! Please report issues or suggestions through GitHub issues.

## License

MIT
