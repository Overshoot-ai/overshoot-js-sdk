import { describe, it, expect, beforeEach, vi } from "vitest";
import { StreamClient } from "../client";
import { ValidationError, NotFoundError, NetworkError } from "../errors";

describe("StreamClient", () => {
  let client: StreamClient;

  beforeEach(() => {
    client = new StreamClient({
      baseUrl: "http://test.local",
      apiKey: "test-api-key",
    });
    vi.clearAllMocks();
  });

  describe("createStream", () => {
    it("should create stream successfully", async () => {
      const mockResponse = {
        stream_id: "test-id",
        webrtc: { type: "answer", sdp: "mock-sdp" },
        lease: { ttl_seconds: 300 },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.createStream({
        webrtc: { type: "offer", sdp: "test-sdp" },
        processing: { sampling_ratio: 0.5, fps: 30 },
        inference: {
          prompt: "test",
          backend: "overshoot",
          model: "test-model",
        },
      });

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        "http://test.local/streams",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("should throw ValidationError on 422", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          error: "validation_error",
          message: "Invalid input",
          request_id: "req-123",
        }),
      });

      await expect(
        client.createStream({
          webrtc: { type: "offer", sdp: "" },
          processing: { sampling_ratio: 0.5, fps: 30 },
          inference: { prompt: "test", backend: "overshoot", model: "test" },
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("renewLease", () => {
    it("should renew lease successfully", async () => {
      const mockResponse = {
        status: "ok",
        stream_id: "test-id",
        ttl_seconds: 300,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.renewLease("test-id");

      expect(result).toEqual(mockResponse);
    });

    it("should throw NotFoundError on 404", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          error: "stream_not_found",
          message: "Stream not found",
        }),
      });

      await expect(client.renewLease("invalid-id")).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("error handling", () => {
    it("should throw NetworkError on fetch failure", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network failed"));

      await expect(client.renewLease("test-id")).rejects.toThrow(NetworkError);
    });
  });

  describe("connectWebSocket", () => {
    it("should create WebSocket with correct URL", () => {
      const ws = client.connectWebSocket("test-id");
      expect(ws.url).toBe("ws://test.local/ws/streams/test-id");
    });

    it("should handle https to wss conversion", () => {
      const secureClient = new StreamClient({
        baseUrl: "https://test.local",
        apiKey: "test-api-key",
      });
      const ws = secureClient.connectWebSocket("test-id");
      expect(ws.url).toBe("wss://test.local/ws/streams/test-id");
    });
  });
});
