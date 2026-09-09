import type { DeliveryAdapter } from "@/src/domain/ports";
import type {
  DeliveryRequest,
  DeliveryResult,
} from "@/src/domain/delivery/delivery";

const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Real HTTP POST delivery. Endpoint from destination or REST_DESTINATION_URL.
 */
export class RestDeliveryAdapter implements DeliveryAdapter {
  readonly key = "rest";

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly defaultUrl = process.env.REST_DESTINATION_URL,
    private readonly defaultApiKey = process.env.REST_DESTINATION_API_KEY
  ) {}

  async send(request: DeliveryRequest): Promise<DeliveryResult> {
    const url = request.destination.endpoint || this.defaultUrl;
    if (!url || url.startsWith("mock://")) {
      return {
        success: false,
        errorCode: "MISSING_ENDPOINT",
        errorMessage: "REST destination URL is not configured",
        retryable: false,
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Correlation-Id": request.correlationId,
      ...(request.headers ?? {}),
    };

    const apiKeyEnv = request.destination.authConfig?.apiKeyEnv;
    const apiKey =
      (apiKeyEnv ? process.env[apiKeyEnv] : undefined) || this.defaultApiKey;
    if (apiKey) {
      headers["X-API-Key"] = apiKey;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await this.fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(request.payload),
        signal: controller.signal,
      });

      const text = await response.text();
      const summary = text.slice(0, 500);

      if (response.ok) {
        let ackId: string | undefined;
        try {
          const parsed = JSON.parse(text) as { ackId?: string; id?: string };
          ackId = parsed.ackId ?? parsed.id;
        } catch {
          // non-JSON body is fine
        }

        return {
          success: true,
          statusCode: response.status,
          acknowledgement: {
            acknowledgedAt: new Date().toISOString(),
            ackId,
            rawSummary: summary.slice(0, 200),
          },
          responseBodySummary: summary,
        };
      }

      return {
        success: false,
        statusCode: response.status,
        errorCode: "HTTP_ERROR",
        errorMessage: `Downstream HTTP ${response.status}`,
        retryable: response.status >= 500 || response.status === 429,
        responseBodySummary: summary,
      };
    } catch (error) {
      const aborted =
        error instanceof Error &&
        (error.name === "AbortError" || error.message.includes("abort"));
      return {
        success: false,
        errorCode: aborted ? "TIMEOUT" : "NETWORK_ERROR",
        errorMessage: aborted
          ? "Downstream request timed out"
          : error instanceof Error
            ? error.message
            : "Network error",
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
