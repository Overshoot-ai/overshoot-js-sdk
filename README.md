# Overshoot SDK

> **Warning: Alpha Release**: This is an alpha version (0.1.0-alpha.3). The API may change in future versions.

TypeScript SDK for real-time AI vision analysis on live video streams.

## Installation

```bash
npm install @overshoot/sdk@alpha
```

Or install a specific alpha version:

```bash
npm install @overshoot/sdk@0.1.0-alpha.3
```

## Quick Start

### Camera Source

```typescript
import { RealtimeVision } from "@overshoot/sdk";

const vision = new RealtimeVision({
  apiUrl: "https://cluster1.overshoot.ai/api/v0.2",
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
  apiUrl: "https://cluster1.overshoot.ai/api/v0.2",
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

> **Note:** Video files automatically loop continuously until you call `stop()`.

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
  backend?: "overshoot"; // Model backend (default: "overshoot")
  model?: string; // Model name (see Available Models below)
  outputSchema?: Record<string, any>; // JSON schema for structured output
  onError?: (error: Error) => void;
  debug?: boolean; // Enable debug logging (default: false)

  processing?: {
    fps?: number; // Source frames per second (1-120, auto-detected for cameras)
    sampling_ratio?: number; // Fraction of frames to process (0-1, default: 0.1)
    clip_length_seconds?: number; // Duration of each clip sent to the model (0.1-60, default: 1.0)
    delay_seconds?: number; // Interval between inference runs (0-60, default: 1.0)
  };

  iceServers?: RTCIceServer[]; // Custom WebRTC ICE servers (uses Overshoot TURN servers by default)
}
```

### StreamSource

```typescript
type StreamSource =
  | { type: "camera"; cameraFacing: "user" | "environment" }
  | { type: "video"; file: File };
```

### Available Models

| Model | Description |
|-------|-------------|
| `Qwen/Qwen3-VL-30B-A3B-Instruct` | Default. General-purpose vision-language model with strong performance across tasks. |

More models coming soon. Contact us for specific model requirements.

### Processing Parameters Explained

The processing parameters control how video frames are sampled and sent to the model:

- **`fps`**: The frame rate of your video source. Auto-detected for camera streams; defaults to 30 for video files.
- **`sampling_ratio`**: What fraction of frames to include in each clip (0.1 = 10% of frames).
- **`clip_length_seconds`**: Duration of video captured for each inference (e.g., 1.0 = 1 second of video).
- **`delay_seconds`**: How often inference runs (e.g., 1.0 = one inference per second).

**Example:** With `fps=30`, `clip_length_seconds=1.0`, `sampling_ratio=0.1`:
- Each clip captures 1 second of video (30 frames at 30fps)
- 10% of frames are sampled = 3 frames sent to the model
- If `delay_seconds=1.0`, you get ~1 inference result per second

### Structured Output (JSON Schema)

Use `outputSchema` to constrain the model's output to a specific JSON structure. The schema follows [JSON Schema](https://json-schema.org/) specification.

```typescript
const vision = new RealtimeVision({
  apiUrl: "https://cluster1.overshoot.ai/api/v0.2",
  apiKey: "your-api-key",
  prompt: "Detect objects and return structured data",
  outputSchema: {
    type: "object",
    properties: {
      objects: {
        type: "array",
        items: { type: "string" }
      },
      count: { type: "integer" }
    },
    required: ["objects", "count"]
  },
  onResult: (result) => {
    const data = JSON.parse(result.result);
    console.log(`Found ${data.count} objects:`, data.objects);
  },
});
```

The model will return valid JSON matching your schema. If the model cannot produce valid output, `result.ok` will be `false` and `result.error` will contain details.

## API Methods

```typescript
// Lifecycle
await vision.start(); // Start the video stream
await vision.stop(); // Stop and cleanup resources

// Runtime control
await vision.updatePrompt(newPrompt); // Update task while running

// State access
vision.getMediaStream(); // Get MediaStream for video preview (null if not started)
vision.getStreamId(); // Get current stream ID (null if not started)
vision.isActive(); // Check if stream is running
```

## Stream Lifecycle

### Keepalive

Streams have a server-side lease (typically 300 seconds). The SDK automatically sends keepalive requests to maintain the connection. If the keepalive fails (e.g., network issues), the stream will stop and `onError` will be called.

You don't need to manage keepalives manually - just call `start()` and the SDK handles the rest.

## Examples

### Object Detection with Structured Output

```typescript
const vision = new RealtimeVision({
  apiUrl: "https://cluster1.overshoot.ai/api/v0.2",
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
  apiUrl: "https://cluster1.overshoot.ai/api/v0.2",
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
  apiUrl: "https://cluster1.overshoot.ai/api/v0.2",
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
  apiUrl: "https://cluster1.overshoot.ai/api/v0.2",
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
  apiUrl: "https://cluster1.overshoot.ai/api/v0.2",
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
  apiUrl: "https://cluster1.overshoot.ai/api/v0.2",
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
  model_backend: "overshoot";
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
