# Delivery Adapters

Adapters implement `DeliveryAdapter` from `src/domain/ports`.  
The domain layer never imports Salesforce or Pega SDKs.

| Key | Implementation | POC behavior |
|-----|----------------|--------------|
| `mock` | `MockDeliveryAdapter` | Simulated payer + ack; failure simulation knobs |
| `rest` | `RestDeliveryAdapter` | Real HTTP POST to configured URL |
| `salesforce` | `SalesforceDeliveryAdapter` | Mock with SF-shaped envelope (`NOA_Notification__c`) |
| `pega` | `PegaDeliveryAdapter` | Mock with Pega case envelope |

## Vendor-agnostic proof

Same inbound FHIR Bundle → same `AdmissionEvent` → same `SEND_NOA` decision.

Only contract / transform / adapter change:

```bash
# Mock (default)
curl -X POST http://localhost:3000/api/fhir/r4/events \
  -H "Content-Type: application/fhir+json" \
  --data @fhir/fixtures/admission-medicare-inpatient.json

# Salesforce
curl -X POST http://localhost:3000/api/fhir/r4/events \
  -H "Content-Type: application/fhir+json" \
  -H "X-Contract-Id: MEDICARE_NOA_SF_V1" \
  --data @fhir/fixtures/admission-medicare-inpatient.json

# Pega
curl -X POST http://localhost:3000/api/fhir/r4/events \
  -H "Content-Type: application/fhir+json" \
  -H "X-Contract-Id: MEDICARE_NOA_PEGA_V1" \
  --data @fhir/fixtures/admission-medicare-inpatient.json
```

Expect `adapterKey` / `ackId` prefixes: `mock`/`ACK-MOCK`, `salesforce`/`ACK-SF`, `pega`/`ACK-PEGA`.
