import { describe, it, expect, vi, beforeEach } from "vitest";
import { RealtimeVision, type RealtimeVisionConfig } from "./RealtimeVision";

/**
 * Helper to build a valid base config. Uses livekit source to avoid
 * browser media API requirements (navigator.mediaDevices etc.).
 */
function baseConfig(
  overrides: Partial<RealtimeVisionConfig> = {},
): RealtimeVisionConfig {
  return {
    apiKey: "test-key",
    prompt: "test prompt",
    model: "test-model",
    source: { type: "livekit", url: "wss://test.example.com", token: "tok" },
    onResult: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Validation tests
// ---------------------------------------------------------------------------
describe("RealtimeVision validation", () => {
  // -- target_fps valid cases -----------------------------------------------
  it("accepts target_fps within range", () => {
    expect(
      () =>
        new RealtimeVision(
          baseConfig({ clipProcessing: { target_fps: 10, clip_length_seconds: 3 } }),
        ),
    ).not.toThrow();
  });

  it("accepts target_fps at min boundary", () => {
    expect(
      () =>
        new RealtimeVision(
          baseConfig({ clipProcessing: { target_fps: 1, clip_length_seconds: 3 } }),
        ),
    ).not.toThrow();
  });

  it("accepts target_fps at max boundary", () => {
    expect(
      () =>
        new RealtimeVision(
          baseConfig({ clipProcessing: { target_fps: 30, clip_length_seconds: 3 } }),
        ),
    ).not.toThrow();
  });

  // -- target_fps range errors ----------------------------------------------
  it("rejects target_fps below min", () => {
    expect(
      () =>
        new RealtimeVision(
          baseConfig({ clipProcessing: { target_fps: 0 } }),
        ),
    ).toThrow("target_fps must be between 1 and 30");
  });

  it("rejects target_fps above max", () => {
    expect(
      () =>
        new RealtimeVision(
          baseConfig({ clipProcessing: { target_fps: 31 } }),
        ),
    ).toThrow("target_fps must be between 1 and 30");
  });

  // -- minimum frames per clip constraint -----------------------------------
  it("rejects target_fps * clip_length_seconds < 3", () => {
    expect(
      () =>
        new RealtimeVision(
          baseConfig({
            clipProcessing: { target_fps: 2, clip_length_seconds: 1 },
          }),
        ),
    ).toThrow("target_fps * clip_length_seconds must be >= 3");
  });

  it("accepts target_fps * clip_length_seconds == 3 (boundary)", () => {
    expect(
      () =>
        new RealtimeVision(
          baseConfig({
            clipProcessing: { target_fps: 3, clip_length_seconds: 1 },
          }),
        ),
    ).not.toThrow();
  });

  it("uses default clip_length_seconds for min-frames check when not provided", () => {
    // default clip_length_seconds is 0.5, so target_fps=5 → 5*0.5=2.5 < 3
    expect(
      () =>
        new RealtimeVision(
          baseConfig({ clipProcessing: { target_fps: 5 } }),
        ),
    ).toThrow("target_fps * clip_length_seconds must be >= 3");
  });

  it("accepts target_fps=6 with default clip_length_seconds (6*0.5=3)", () => {
    expect(
      () =>
        new RealtimeVision(
          baseConfig({ clipProcessing: { target_fps: 6 } }),
        ),
    ).not.toThrow();
  });

  // -- mutual exclusion -----------------------------------------------------
  it("rejects target_fps combined with fps", () => {
    expect(
      () =>
        new RealtimeVision(
          baseConfig({
            clipProcessing: { target_fps: 10, fps: 30, clip_length_seconds: 3 },
          }),
        ),
    ).toThrow("Cannot provide both target_fps and fps/sampling_ratio");
  });

  it("rejects target_fps combined with sampling_ratio", () => {
    expect(
      () =>
        new RealtimeVision(
          baseConfig({
            clipProcessing: {
              target_fps: 10,
              sampling_ratio: 0.5,
              clip_length_seconds: 3,
            },
          }),
        ),
    ).toThrow("Cannot provide both target_fps and fps/sampling_ratio");
  });

  it("rejects target_fps combined with both fps and sampling_ratio", () => {
    expect(
      () =>
        new RealtimeVision(
          baseConfig({
            clipProcessing: {
              target_fps: 10,
              fps: 30,
              sampling_ratio: 0.5,
              clip_length_seconds: 3,
            },
          }),
        ),
    ).toThrow("Cannot provide both target_fps and fps/sampling_ratio");
  });

  // -- legacy params still work ---------------------------------------------
  it("accepts legacy fps + sampling_ratio", () => {
    expect(
      () =>
        new RealtimeVision(
          baseConfig({
            clipProcessing: { fps: 30, sampling_ratio: 0.5 },
          }),
        ),
    ).not.toThrow();
  });

  it("rejects legacy sampling_ratio out of range", () => {
    expect(
      () =>
        new RealtimeVision(
          baseConfig({
            clipProcessing: { sampling_ratio: 1.5 },
          }),
        ),
    ).toThrow("sampling_ratio must be between 0 and 1");
  });

  it("rejects legacy fps out of range", () => {
    expect(
      () =>
        new RealtimeVision(
          baseConfig({
            clipProcessing: { fps: 200 },
          }),
        ),
    ).toThrow("fps must be between 1 and 120");
  });

  // -- clip_length_seconds and delay_seconds --------------------------------
  it("rejects clip_length_seconds out of range", () => {
    expect(
      () =>
        new RealtimeVision(
          baseConfig({
            clipProcessing: { target_fps: 10, clip_length_seconds: 100 },
          }),
        ),
    ).toThrow("clip_length_seconds must be between 0.1 and 60");
  });

  it("rejects delay_seconds out of range", () => {
    expect(
      () =>
        new RealtimeVision(
          baseConfig({
            clipProcessing: { target_fps: 10, clip_length_seconds: 3, delay_seconds: 100 },
          }),
        ),
    ).toThrow("delay_seconds must be between 0 and 60");
  });

  // -- no config (defaults) -------------------------------------------------
  it("accepts no clipProcessing (uses defaults)", () => {
    expect(() => new RealtimeVision(baseConfig())).not.toThrow();
  });

  // -- deprecated processing field ------------------------------------------
  it("accepts target_fps via deprecated processing field", () => {
    expect(
      () =>
        new RealtimeVision(
          baseConfig({
            processing: { target_fps: 10, clip_length_seconds: 3 },
          }),
        ),
    ).not.toThrow();
  });

  it("rejects mutual exclusion via deprecated processing field", () => {
    expect(
      () =>
        new RealtimeVision(
          baseConfig({
            processing: { target_fps: 10, fps: 30, clip_length_seconds: 3 },
          }),
        ),
    ).toThrow("Cannot provide both target_fps and fps/sampling_ratio");
  });
});

// ---------------------------------------------------------------------------
// Processing config output tests
// ---------------------------------------------------------------------------
describe("RealtimeVision processing config", () => {
  let createStreamSpy: ReturnType<typeof vi.fn>;
  let connectWebSocketSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createStreamSpy = vi.fn().mockResolvedValue({
      stream_id: "test-stream-id",
      lease: { ttl_seconds: 30 },
    });

    connectWebSocketSpy = vi.fn().mockReturnValue({
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
      close: vi.fn(),
      send: vi.fn(),
    });
  });

  async function getProcessingPayload(
    configOverrides: Partial<RealtimeVisionConfig> = {},
  ) {
    const vision = new RealtimeVision(baseConfig(configOverrides));

    // Replace the internal client methods
    const client = (vision as any).client;
    client.createStream = createStreamSpy;
    client.connectWebSocket = connectWebSocketSpy;

    await vision.start();

    const callArgs = createStreamSpy.mock.calls[0][0];
    return callArgs.processing;
  }

  it("sends target_fps format by default (no clipProcessing)", async () => {
    const processing = await getProcessingPayload();

    expect(processing).toEqual({
      target_fps: 6,
      clip_length_seconds: 0.5,
      delay_seconds: 0.5,
    });
    expect(processing).not.toHaveProperty("fps");
    expect(processing).not.toHaveProperty("sampling_ratio");
  });

  it("sends explicit target_fps", async () => {
    const processing = await getProcessingPayload({
      clipProcessing: { target_fps: 10, clip_length_seconds: 3, delay_seconds: 1 },
    });

    expect(processing).toEqual({
      target_fps: 10,
      clip_length_seconds: 3,
      delay_seconds: 1,
    });
    expect(processing).not.toHaveProperty("fps");
    expect(processing).not.toHaveProperty("sampling_ratio");
  });

  it("sends legacy format when fps is provided", async () => {
    const processing = await getProcessingPayload({
      clipProcessing: { fps: 30, sampling_ratio: 0.5 },
    });

    expect(processing).toEqual({
      fps: 30,
      sampling_ratio: 0.5,
      clip_length_seconds: 0.5,
      delay_seconds: 0.5,
    });
    expect(processing).not.toHaveProperty("target_fps");
  });

  it("sends legacy format when only sampling_ratio is provided", async () => {
    const processing = await getProcessingPayload({
      clipProcessing: { sampling_ratio: 0.6 },
    });

    // fps falls back to FALLBACK_FPS (30) for livekit sources
    expect(processing).toEqual({
      fps: 30,
      sampling_ratio: 0.6,
      clip_length_seconds: 0.5,
      delay_seconds: 0.5,
    });
    expect(processing).not.toHaveProperty("target_fps");
  });

  it("fills in defaults for missing target_fps fields", async () => {
    const processing = await getProcessingPayload({
      clipProcessing: { target_fps: 15, clip_length_seconds: 2 },
    });

    expect(processing).toEqual({
      target_fps: 15,
      clip_length_seconds: 2,
      delay_seconds: 0.5, // default
    });
  });

  it("sends frame mode config unchanged", async () => {
    const processing = await getProcessingPayload({
      mode: "frame",
      frameProcessing: { interval_seconds: 1.0 },
    });

    expect(processing).toEqual({
      interval_seconds: 1.0,
    });
  });
});
