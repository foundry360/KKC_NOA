import type { DeliveryAdapter } from "@/src/domain/ports";
import type {
  DeliveryRequest,
  DeliveryResult,
} from "@/src/domain/delivery/delivery";
import { MockDeliveryAdapter } from "@/src/adapters/mock/mock-delivery-adapter";

/**
 * Salesforce adapter stub — wraps Mock with a Salesforce-shaped envelope.
 * No live Salesforce credentials required for the POC.
 */
export class SalesforceDeliveryAdapter implements DeliveryAdapter {
  readonly key = "salesforce";

  constructor(private readonly inner: MockDeliveryAdapter = new MockDeliveryAdapter()) {}

  async send(request: DeliveryRequest): Promise<DeliveryResult> {
    const enveloped: DeliveryRequest = {
      ...request,
      payload: {
        attributes: { type: "NOA_Notification__c" },
        ...request.payload,
        SourceSystem__c: "FHIR_NOA_ACCELERATOR",
      },
      destination: {
        ...request.destination,
        // Keep simulation knobs; force mock transport for POC
        endpoint: request.destination.endpoint ?? "mock://salesforce/noa",
      },
    };
    const result = await this.inner.send(enveloped);
    if (result.acknowledgement) {
      return {
        ...result,
        acknowledgement: {
          ...result.acknowledgement,
          ackId:
            result.acknowledgement.ackId?.replace("ACK-MOCK", "ACK-SF") ??
            result.acknowledgement.ackId,
          rawSummary: "salesforce mock acknowledgement",
        },
      };
    }
    return result;
  }
}
