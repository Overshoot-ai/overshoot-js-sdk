import type {
  StreamCreateRequest,
  StreamCreateResponse,
  KeepaliveResponse,
  StreamConfigResponse,
  FeedbackCreateRequest,
  FeedbackResponse,
  StatusResponse,
  ErrorResponse,
} from "./types";
import {
  ApiError,
  ValidationError,
  NotFoundError,
  NetworkError,
  ServerError,
  UnauthorizedError,
} from "./errors";

type ClientConfig = {
  baseUrl: string;
  apiKey: string;
};

export class StreamClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: ClientConfig) {
    if (!config.apiKey || typeof config.apiKey !== "string") {
      throw new Error("apiKey is required and must be a string");
    }

    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();

    // Log outgoing cookies
    console.log("[Cookie Debug] Outgoing request:", {
      url,
      method: options.method || "GET",
      cookies: document.cookie,
      hasCookie: document.cookie.includes("media-gateway-route"),
    });

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...options.headers,
        },
      });

      // Log incoming cookies from response
      const setCookie = response.headers.get("set-cookie");
      console.log("[Cookie Debug] Response received:", {
        url,
        status: response.status,
        setCookieHeader: setCookie,
        allCookiesNow: document.cookie,
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json().catch(() => ({
          error: "unknown_error",
          message: response.statusText,
        }));

        const message = errorData.message || errorData.error;

        if (response.status === 401) {
          throw new UnauthorizedError(
            message || "Invalid or revoked API key",
            errorData.request_id,
          );
        }
        if (response.status === 422 || response.status === 400) {
          throw new ValidationError(
            message,
            errorData.request_id,
            errorData.details,
          );
        }
        if (response.status === 404) {
          throw new NotFoundError(message, errorData.request_id);
        }
        if (response.status >= 500) {
          throw new ServerError(
            message,
            errorData.request_id,
            errorData.details,
          );
        }

        throw new ApiError(
          message,
          response.status,
          errorData.request_id,
          errorData.details,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        throw new NetworkError(`Network error: ${error.message}`, error);
      }

      throw new NetworkError("Unknown network error");
    }
  }
  async createStream(
    request: StreamCreateRequest,
  ): Promise<StreamCreateResponse> {
    return this.request<StreamCreateResponse>("/streams", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async renewLease(streamId: string): Promise<KeepaliveResponse> {
    return this.request<KeepaliveResponse>(`/streams/${streamId}/keepalive`, {
      method: "POST",
    });
  }

  async updatePrompt(
    streamId: string,
    prompt: string,
  ): Promise<StreamConfigResponse> {
    return this.request<StreamConfigResponse>(
      `/streams/${streamId}/config/prompt`,
      {
        method: "PATCH",
        body: JSON.stringify({ prompt }),
      },
    );
  }

  async submitFeedback(
    streamId: string,
    feedback: FeedbackCreateRequest,
  ): Promise<StatusResponse> {
    return this.request<StatusResponse>(`/streams/${streamId}/feedback`, {
      method: "POST",
      body: JSON.stringify(feedback),
    });
  }

  async getAllFeedback(): Promise<FeedbackResponse[]> {
    return this.request<FeedbackResponse[]>("/streams/feedback", {
      method: "GET",
    });
  }

  connectWebSocket(streamId: string): WebSocket {
    const wsUrl = this.baseUrl
      .replace("http://", "ws://")
      .replace("https://", "wss://");
    return new WebSocket(`${wsUrl}/ws/streams/${streamId}`);
  }

  /**
   * Health check endpoint (for testing, uses internal port if available)
   * Note: This endpoint may not be available via the main API
   */
  async healthCheck(): Promise<string> {
    const url = `${this.baseUrl}/healthz`;
    const response = await fetch(url, {
      credentials: "include", // ← ADD THIS HERE TOO
    });
    return response.text();
  }
}
