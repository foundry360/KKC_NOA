import type { DeliveryAdapter } from "@/src/domain/ports";
import type {
  DeliveryRequest,
  DeliveryResult,
} from "@/src/domain/delivery/delivery";
import { MockDeliveryAdapter } from "@/src/adapters/mock/mock-delivery-adapter";

/**
 * Pega adapter stub — wraps Mock with a Pega-shaped case envelope.
 * No live Pega credentials required for the POC.
 */
export class PegaDeliveryAdapter implements DeliveryAdapter {
  readonly key = "pega";

  constructor(private readonly inner: MockDeliveryAdapter = new MockDeliveryAdapter()) {}

  async send(request: DeliveryRequest): Promise<DeliveryResult> {
    const enveloped: DeliveryRequest = {
      ...request,
      payload: {
        caseType: "NotificationOfAdmission",
        content: request.payload,
        source: "FHIR_NOA_ACCELERATOR",
      },
      destination: {
        ...request.destination,
        endpoint: request.destination.endpoint ?? "mock://pega/noa",
      },
    };
    const result = await this.inner.send(enveloped);
    if (result.acknowledgement) {
      return {
        ...result,
        acknowledgement: {
          ...result.acknowledgement,
          ackId:
            result.acknowledgement.ackId?.replace("ACK-MOCK", "ACK-PEGA") ??
            result.acknowledgement.ackId,
          rawSummary: "pega mock acknowledgement",
        },
      };
    }
    return result;
  }
}
