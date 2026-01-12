# Changelog

All notable changes to the Overshoot SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-12

### Added
- Initial release of the Overshoot SDK
- Real-time vision analysis with sub-second latency
- Support for camera and video file sources
- WebRTC-based video streaming
- API key authentication
- Structured output with JSON schema support
- Multiple backend support (Overshoot and Gemini models)
- Configurable processing parameters (sampling ratio, FPS, clip length, delay)
- Keepalive mechanism for long-running streams
- WebSocket-based result delivery
- Comprehensive error handling with custom error types
- TypeScript support with full type definitions
- Unit tests with Vitest
- Complete documentation and examples

### Features
- `RealtimeVision` class for easy stream management
- `StreamClient` for low-level API access
- Camera access with front/back camera selection
- Video file upload and looping support
- Dynamic prompt updates during streaming
- Feedback submission system
- Performance metrics (inference and total latency)
- Resource cleanup and error recovery

### Developer Experience
- Full TypeScript types
- Comprehensive JSDoc comments
- Multiple usage examples
- Error types for better error handling
- ESM and CommonJS support
- Source maps for debugging
