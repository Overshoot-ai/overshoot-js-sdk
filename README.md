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

  iceServers?: RTCIceServer[]; // Custom WebRTC ICE servers (uses Overshoot TURN servers by default, see RealtimeVision.ts)
}
```

### StreamSource

```typescript
type StreamSource =
  | { type: "camera"; cameraFacing: "user" | "environment" }
  | { type: "video"; file: File };
```

### Available Models

| Model                            | Description                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `Qwen/Qwen3-VL-30B-A3B-Instruct` | Default. Very fast and performant general-purpose vision-language model.             |
| `Qwen/Qwen3-VL-8B-Instruct`      | Similar latency to 30B. Particularly good at OCR and text extraction tasks.          |
| `OpenGVLab/InternVL3_5-30B-A3B`  | Excels at capturing visual detail. More verbose output, higher latency.              |

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

#### Configuration by Use Case

Different applications need different processing configurations:

**Real-time tracking** (low latency, frequent updates):

```typescript
processing: {
  sampling_ratio: 0.7,
  clip_length_seconds: 0.5,
  delay_seconds: 0.3,
}
```

**Event detection** (monitoring for specific occurrences):

```typescript
processing: {
  sampling_ratio: 0.2,
  clip_length_seconds: 5.0,
  delay_seconds: 5.0,
}
```

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
        items: { type: "string" },
      },
      count: { type: "integer" },
    },
    required: ["objects", "count"],
  },
  onResult: (result) => {
    const data = JSON.parse(result.result);
    console.log(`Found ${data.count} objects:`, data.objects);
  },
});
```

The model will return valid JSON matching your schema. If the model cannot produce valid output, `result.ok` will be `false` and `result.error` will contain details.

> **Note:** `result.result` is always a string. When using `outputSchema`, you must parse it with `JSON.parse()`.

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

### State and Memory

The SDK does not maintain memory or state between inference calls - each frame clip is processed independently. If your application needs to track state over time (e.g., counting repetitions, detecting transitions), implement this in your `onResult` callback:

```typescript
let lastPosition = "up";
let repCount = 0;

const vision = new RealtimeVision({
  // ...config
  onResult: (result) => {
    const data = JSON.parse(result.result);

    // Track state transitions externally
    if (lastPosition === "down" && data.position === "up") {
      repCount++;
    }
    lastPosition = data.position;
  },
});
```

For result deduplication (e.g., avoiding repeated announcements), track previous results and implement cooldown logic in your application code.

## Prompt Engineering

Prompt quality significantly affects results. Here are some tips:

**Be specific about output format:**

```typescript
prompt: "Count the people visible. Return only a number.";
```

**Include examples for complex tasks:**

```typescript
prompt: `Describe the primary action happening. Examples:
- "Person walking left"
- "Car turning right"
- "Dog sitting still"`;
```

**Request minimal output for lower latency:**

```typescript
prompt: "Is there a person in frame? Answer only 'yes' or 'no'.";
```

**Provide context when needed:**

```typescript
prompt: `You are monitoring a ${locationName}. Alert if you see: ${alertConditions.join(", ")}.`;
```

**Use JSON schema for structured data:**

```typescript
prompt: "Analyze the scene",
outputSchema: {
  type: "object",
  properties: {
    description: { type: "string" },
    alert: { type: "boolean" }
  },
  required: ["description", "alert"]
}
```

> **Note:** Prompt effectiveness varies by model. Test different approaches to find what works best for your use case.

## React Integration

When using the SDK in React applications, ensure proper cleanup:

```typescript
import { useEffect, useRef, useState } from "react";
import { RealtimeVision } from "@overshoot/sdk";

function VisionComponent() {
  const visionRef = useRef<RealtimeVision | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isRunning, setIsRunning] = useState(false);

  const startVision = async () => {
    const vision = new RealtimeVision({
      apiUrl: "https://cluster1.overshoot.ai/api/v0.2",
      apiKey: "your-api-key",
      prompt: "Describe what you see",
      onResult: (result) => {
        console.log(result.result);
      },
      onError: (error) => {
        console.error("Vision error:", error);
        setIsRunning(false);
      },
    });

    await vision.start();
    visionRef.current = vision;
    setIsRunning(true);

    // Attach stream to video element for preview
    const stream = vision.getMediaStream();
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      visionRef.current?.stop();
    };
  }, []);

  return (
    <div>
      <video ref={videoRef} autoPlay playsInline muted />
      <button onClick={startVision} disabled={isRunning}>
        Start
      </button>
      <button onClick={() => visionRef.current?.stop()} disabled={!isRunning}>
        Stop
      </button>
    </div>
  );
}
```

## Advanced: Custom Video Sources with StreamClient

For advanced use cases like streaming from a canvas, screen capture, or other custom sources, use `StreamClient` directly:

```typescript
import { StreamClient } from "@overshoot/sdk";

const client = new StreamClient({
  baseUrl: "https://cluster1.overshoot.ai/api/v0.2",
  apiKey: "your-api-key",
});

// Get stream from any source (canvas, screen capture, etc.)
const canvas = document.querySelector("canvas");
const stream = canvas.captureStream(30);
const videoTrack = stream.getVideoTracks()[0];

// Set up WebRTC connection
const peerConnection = new RTCPeerConnection({ iceServers: [...] }); // See default ice servers in RealtimeVison.ts file
peerConnection.addTrack(videoTrack, stream);

const offer = await peerConnection.createOffer();
await peerConnection.setLocalDescription(offer);

// Create stream on server
const response = await client.createStream({
  webrtc: { type: "offer", sdp: peerConnection.localDescription.sdp },
  processing: { sampling_ratio: 0.5, fps: 30, clip_length_seconds: 1.0, delay_seconds: 1.0 },
  inference: {
    prompt: "Analyze the content",
    backend: "overshoot",
    model: "Qwen/Qwen3-VL-30B-A3B-Instruct",
  },
});

await peerConnection.setRemoteDescription(response.webrtc);

// Connect WebSocket for results
const ws = client.connectWebSocket(response.stream_id);
ws.onopen = () => ws.send(JSON.stringify({ api_key: "your-api-key" }));
ws.onmessage = (event) => {
  const result = JSON.parse(event.data);
  console.log("Result:", result);
};
```

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
  result: string; // Model output (always a string - parse JSON if using outputSchema)
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
