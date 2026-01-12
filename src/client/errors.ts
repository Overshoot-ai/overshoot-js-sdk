export class ApiError extends Error {
  readonly statusCode?: number;
  readonly requestId?: string;
  readonly details?: any;

  constructor(
    message: string,
    statusCode?: number,
    requestId?: string,
    details?: any,
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.requestId = requestId;
    this.details = details;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string, requestId?: string) {
    super(message, 401, requestId);
    this.name = "UnauthorizedError";
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, requestId?: string, details?: any) {
    super(message, 422, requestId, details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string, requestId?: string) {
    super(message, 404, requestId);
    this.name = "NotFoundError";
  }
}

export class NetworkError extends ApiError {
  readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = "NetworkError";
    this.cause = cause;
  }
}

export class ServerError extends ApiError {
  constructor(message: string, requestId?: string, details?: any) {
    super(message, 500, requestId, details);
    this.name = "ServerError";
  }
}
