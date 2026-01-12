# Overshoot SDK

A TypeScript SDK for real-time AI vision analysis on live video streams with sub-second latency.

## Installation

```bash
npm install overshoot
```

## Quick Start

### Using Camera

```typescript
import { RealtimeVision } from "overshoot";

const vision = new RealtimeVision({
  apiUrl: "https://api.overshoot.ai",
  apiKey: "your-api-key-here",
  prompt: "Read any visible text and return JSON: {text: string | null, confidence: number}",
  onResult: (result) => {
    console.log(result.result);
    console.log(`Latency: ${result.total_latency_ms}ms`);
  },
});

await vision.start();
// Camera is now streaming, results arrive ~1/second
await vision.stop();
```

### Using Video File

```typescript
import { RealtimeVision } from "overshoot";

const vision = new RealtimeVision({
  apiUrl: "https://api.overshoot.ai",
  apiKey: "your-api-key-here",
  prompt: "Detect all objects in the video and count them",
  source: {
    type: "video",
    file: videoFile, // File object from input element
  },
  onResult: (result) => {
    console.log(result.result);
  },
});

await vision.start();
```

## Features

- 🎥 **Real-time video analysis** - Sub-second latency (~300ms)
- 📹 **Multiple sources** - Camera or video file support
- 🤖 **AI-powered** - Uses state-of-the-art vision models
- 🔄 **Continuous inference** - ~1 result per second
- 📊 **Structured output** - JSON schema support
- 🔒 **Secure** - API key authentication
- 📱 **Cross-platform** - Works on mobile and desktop
- ⚡ **WebRTC-based** - Low latency streaming

## Documentation

For complete documentation, see the [SDK README](sdk/README.md).

## API Reference

### Constructor

```typescript
new RealtimeVision(config: RealtimeVisionConfig)
```

### Configuration

```typescript
interface RealtimeVisionConfig {
  apiUrl: string;              // Required: API endpoint
  apiKey: string;              // Required: API key
  prompt: string;              // Required: Task description
  onResult: (result) => void;  // Required: Result handler
  
  // Optional
  source?: StreamSource;       // Video source (camera or file)
  backend?: "overshoot" | "gemini";
  model?: string;
  outputSchema?: Record<string, any>;
  onError?: (error: Error) => void;
  processing?: {
    sampling_ratio?: number;
    fps?: number;
    clip_length_seconds?: number;
    delay_seconds?: number;
  };
}
```

### Methods

```typescript
await vision.start();                    // Start streaming
await vision.stop();                     // Stop and cleanup
await vision.updatePrompt(newPrompt);    // Change task while running
vision.getMediaStream();                 // Get MediaStream for preview
vision.getStreamId();                    // Get current stream ID
vision.isActive();                       // Check if running
```

## Examples

### Object Detection

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
  },
  onResult: (result) => {
    const data = JSON.parse(result.result);
    console.log("Found:", data.objects);
  },
});
```

### Text Reading (OCR)

```typescript
const vision = new RealtimeVision({
  apiUrl: "https://api.overshoot.ai",
  apiKey: "your-api-key",
  prompt: "Read any visible text",
  onResult: (result) => {
    console.log("Text:", result.result);
  },
});
```

### Video File Analysis

```typescript
const fileInput = document.querySelector('input[type="file"]');
const videoFile = fileInput.files[0];

const vision = new RealtimeVision({
  apiUrl: "https://api.overshoot.ai",
  apiKey: "your-api-key",
  prompt: "Count the number of people in each frame",
  source: {
    type: "video",
    file: videoFile,
  },
  onResult: (result) => {
    console.log("People count:", result.result);
  },
});
```

## Use Cases

- **Text/OCR reading** - Real-time text extraction
- **Safety monitoring** - PPE detection, hazard identification
- **Accessibility** - Scene description for visually impaired
- **Gesture control** - Hand gesture recognition
- **Document scanning** - Auto-capture when document aligned
- **Sports analysis** - Player tracking, form analysis
- **Video file analysis** - Analyze pre-recorded videos

## Error Handling

```typescript
const vision = new RealtimeVision({
  apiUrl: "https://api.overshoot.ai",
  apiKey: "your-api-key",
  prompt: "Detect objects",
  onResult: (result) => {
    console.log(result.result);
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
```

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run type-check

# Lint
npm run lint
```

## Publishing

This is a private package. To publish to npm:

1. Update version in `package.json`
2. Build the package: `npm run build`
3. Publish: `npm publish`

Or use GitHub Package Registry for private hosting.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For issues, questions, or feature requests, please open an issue on GitHub.
