import { randomUUID } from "node:crypto";
import type { DeliveryAdapter } from "@/src/domain/ports";
import type {
  DeliveryRequest,
  DeliveryResult,
} from "@/src/domain/delivery/delivery";

/**
 * Simulates a payer endpoint. Supports failure simulation via destination.simulation.
 */
export class MockDeliveryAdapter implements DeliveryAdapter {
  readonly key = "mock";

  private readonly attemptCounts = new Map<string, number>();

  async send(request: DeliveryRequest): Promise<DeliveryResult> {
    const sim = request.destination.simulation;
    const key = `${request.notificationId}:${request.destination.code}`;
    const prior = this.attemptCounts.get(key) ?? 0;
    const attemptIndex = prior + 1;
    this.attemptCounts.set(key, attemptIndex);

    if (sim?.timeout) {
      return {
        success: false,
        errorCode: "TIMEOUT",
        errorMessage: "Simulated downstream timeout",
        retryable: true,
      };
    }

    if (sim?.failAttempts && attemptIndex <= sim.failAttempts) {
      return {
        success: false,
        statusCode: sim.statusCode ?? 500,
        errorCode: "DOWNSTREAM_ERROR",
        errorMessage: `Simulated HTTP ${sim.statusCode ?? 500}`,
        retryable: true,
        responseBodySummary: '{"error":"simulated"}',
      };
    }

    const ackId = `ACK-MOCK-${randomUUID().slice(0, 8).toUpperCase()}`;
    return {
      success: true,
      statusCode: 200,
      acknowledgement: {
        acknowledgedAt: new Date().toISOString(),
        ackId,
        rawSummary: "mock acknowledgement",
      },
      responseBodySummary: `{"ackId":"${ackId}"}`,
    };
  }

  reset(): void {
    this.attemptCounts.clear();
  }
}
