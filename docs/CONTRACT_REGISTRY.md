# Contract Registry — FHIR NOA Accelerator

## Purpose

The Contract Registry determines **which commercial/technical contract** applies to a downstream notification transaction. It is independent of Salesforce and Pega.

```
Decision + AdmissionEvent context → ContractRegistry.resolve() → Contract + Destination + Transformer key
```

## Contract Model

| Attribute | Description |
|-----------|-------------|
| `contractId` | Stable ID (e.g. `MEDICARE_NOA_V1`) |
| `name` | Display name |
| `payer` | Payer code / id |
| `product` | Product / LOB |
| `version` | Version number |
| `effectiveDate` / `expirationDate` | Applicability window |
| `payloadFormat` | e.g. `JSON`, `FHIR_BUNDLE` |
| `transport` | e.g. `REST`, `WEBHOOK`, `QUEUE` |
| `endpoint` | URL or logical endpoint key |
| `authenticationType` | e.g. `NONE`, `API_KEY`, `OAUTH2` (secrets via env) |
| `requiredFields` | List of destination field paths |
| `acknowledgementType` | e.g. `HTTP_200_BODY`, `ASYNC_CALLBACK` |
| `retryPolicy` | maxAttempts, backoff, etc. |
| `transformer` | Transformation definition key |
| `destinationId` | FK to destinations |
| `adapterKey` | `mock` \| `rest` \| `salesforce` \| `pega` \| … |
| `active` | Enable flag |

### Example

```
MEDICARE_NOA_V1
  Format: JSON
  Transport: REST
  Transformer: MEDICARE_NOA_V1_TRANSFORM
  Destination: configured endpoint / mock
  Adapter: mock | rest | salesforce | pega
```

## Destination Model

Separates “where” from “what contract”:

| Attribute | Description |
|-----------|-------------|
| `id` | UUID |
| `code` | e.g. `MOCK_PAYER`, `SF_NOA_INBOX`, `PEGA_NOA_CASE` |
| `name` | Display |
| `adapterKey` | Delivery adapter |
| `baseUrl` / `endpoint` | Target |
| `authConfigRef` | Env key names only — never secrets in DB |
| `active` | Enable flag |

## Selection Inputs

Routing/contract selection may consider:

- `payer` / `payerType`
- `product` / line of business
- `state` (facility or member — if present)
- `notificationType` (from Decision)
- `admission` / encounter class
- `contract` hints (optional overrides for demos)

## Selection Algorithm (POC)

1. Require Decision `SEND_NOA` (or equivalent).
2. Query active contract versions effective at as-of time matching:
   - `notificationType`
   - `payer` / `payerType`
   - optional product/state filters
3. If multiple matches → highest version / explicit priority field.
4. If none → processing state `NO_CONTRACT`, audit, no delivery.
5. Resolve linked Destination + Transformation definition.
6. Persist selection on Notification / Decision side-tables as needed.

## Vendor-Agnostic Demo

Same Decision, different contracts:

| Contract | Adapter | Purpose |
|----------|---------|---------|
| `MEDICARE_NOA_SF_V1` | `salesforce` (mock) | Demo A |
| `MEDICARE_NOA_PEGA_V1` | `pega` (mock) | Demo B |
| `MEDICARE_NOA_MOCK_V1` | `mock` | Golden path |

Core listener, `AdmissionEvent`, and rules engine remain unchanged. Only registry configuration differs (and seed/demo toggle).

## Contract Fields

`contract_fields` / required field lists support:

- Pre-transform validation of mapping completeness
- UI documentation of expected payload shape

POC: simple string paths; no complex schema language.

## Retry Policy (on Contract)

Example:

```json
{
  "maxAttempts": 3,
  "backoffMs": [1000, 5000, 15000],
  "deadLetterAfterMax": true
}
```

Delivery service reads policy from resolved contract — not hard-coded in adapters.

## Non-Goals

- Legal contract lifecycle management (amendments, signatures)
- EDI 837/835 full transaction sets
- Live Salesforce Connected App provisioning

## Testing

- Resolve known payer → expected contract
- Unknown payer → `NO_CONTRACT`
- Same decision → SF vs Pega contracts via configuration
