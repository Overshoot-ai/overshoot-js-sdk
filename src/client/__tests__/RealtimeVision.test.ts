import { describe, it, expect } from "vitest";
import { RealtimeVision } from "../RealtimeVision";

describe("RealtimeVision", () => {
  describe("default apiUrl", () => {
    it("should construct successfully without apiUrl parameter", () => {
      expect(() => {
        new RealtimeVision({
          apiKey: "test-api-key",
          prompt: "test prompt",
          source: { type: "camera", cameraFacing: "user" },
          backend: "overshoot",
          model: "test-model",
          clipProcessing: {
            sampling_ratio: 0.5,
            clip_length_seconds: 5,
            delay_seconds: 2,
          },
          onResult: () => {},
        });
      }).not.toThrow();
    });

    it("should allow custom apiUrl override", () => {
      expect(() => {
        new RealtimeVision({
          apiUrl: "https://custom-cluster.example.com",
          apiKey: "test-api-key",
          prompt: "test prompt",
          source: { type: "camera", cameraFacing: "user" },
          backend: "overshoot",
          model: "test-model",
          clipProcessing: {
            sampling_ratio: 0.5,
            clip_length_seconds: 5,
            delay_seconds: 2,
          },
          onResult: () => {},
        });
      }).not.toThrow();
    });

    it("should reject empty string apiUrl", () => {
      expect(() => {
        new RealtimeVision({
          apiUrl: "",
          apiKey: "test-api-key",
          prompt: "test prompt",
          source: { type: "camera", cameraFacing: "user" },
          backend: "overshoot",
          model: "test-model",
          clipProcessing: {
            sampling_ratio: 0.5,
            clip_length_seconds: 5,
            delay_seconds: 2,
          },
          onResult: () => {},
        });
      }).toThrow("apiUrl must be a non-empty string");
    });

    it("should reject whitespace-only apiUrl", () => {
      expect(() => {
        new RealtimeVision({
          apiUrl: "   ",
          apiKey: "test-api-key",
          prompt: "test prompt",
          source: { type: "camera", cameraFacing: "user" },
          backend: "overshoot",
          model: "test-model",
          clipProcessing: {
            sampling_ratio: 0.5,
            clip_length_seconds: 5,
            delay_seconds: 2,
          },
          onResult: () => {},
        });
      }).toThrow("apiUrl must be a non-empty string");
    });
  });
});
