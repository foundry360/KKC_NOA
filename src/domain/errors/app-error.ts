export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    options?: { statusCode?: number; details?: Record<string, unknown>; cause?: unknown }
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.statusCode = options?.statusCode ?? 500;
    this.details = options?.details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, { statusCode: 400, details });
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("NOT_FOUND", message, { statusCode: 404, details });
    this.name = "NotFoundError";
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("CONFIGURATION_ERROR", message, { statusCode: 500, details });
    this.name = "ConfigurationError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
