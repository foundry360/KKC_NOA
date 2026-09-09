# Transform Engine — FHIR NOA Accelerator

## Purpose

Produce a **destination-specific payload** from the canonical `AdmissionEvent` using a contract-selected transformation definition.

```
FHIR → AdmissionEvent → Contract Transformer → Destination Payload
```

FHIR is not re-queried during transform for business fields; the canonical event is the source of truth. (Raw FHIR remains available for audit display.)

## Design Goals

- Keep the POC mapping engine **intentionally simple**
- Use explicit interfaces so a richer engine (JSONata, FHIR StructureMap, etc.) can replace the implementation later
- Store mappings as configuration (DB / versioned definitions), not hard-coded in adapters

## Transformation Model

| Attribute | Description |
|-----------|-------------|
| `id` / `code` | e.g. `MEDICARE_NOA_V1_TRANSFORM` |
| `name` | Display |
| `version` | Version |
| `sourceModel` | `AdmissionEvent` |
| `targetFormat` | `JSON` |
| `mappings` | List of field mappings |
| `active` | Enable flag |

### Field Mapping (POC)

```json
{
  "sourcePath": "encounter.period.start",
  "targetPath": "admissionDateTime",
  "required": true
}
```

```json
{
  "sourcePath": "patient.name.family",
  "targetPath": "patient.lastName",
  "required": true
}
```

Optional POC extensions:

- `defaultValue` if source missing and not required
- `transform`: limited set (`uppercase`, `dateIso`, `passthrough`)

### Example Destination Payload (Mock / REST)

```json
{
  "notificationType": "NOA",
  "admissionDateTime": "2026-09-09T14:30:00Z",
  "patient": {
    "lastName": "SYNTHETIC",
    "firstName": "ADA"
  },
  "encounterClass": "INPATIENT",
  "payerType": "MEDICARE",
  "correlationId": "NOA-20260909-000123"
}
```

Salesforce vs Pega transforms differ in **target field names/shape** only; source remains `AdmissionEvent`.

## Interface

```typescript
interface TransformationEngine {
  transform(
    event: AdmissionEvent,
    definition: TransformationDefinition
  ): Promise<TransformResult>;
}

interface TransformResult {
  payload: Record<string, unknown>;
  mappingTrace: Array<{
    sourcePath: string;
    targetPath: string;
    status: "MAPPED" | "MISSING" | "DEFAULT";
  }>;
}
```

On missing required field → `TRANSFORM_FAILED`, audit, no delivery.

## Separation from Routing

| Concern | Responsibility |
|---------|----------------|
| Routing | Destination, contract, which transformer, which adapter |
| Transform | Shape the payload bytes/object |

Adapters receive already-transformed payloads (plus metadata).

## Versioning

Immutable `transformation_versions` referenced by contracts and by notification records for replay/audit.

## UI Display (Event Detail)

Show three panes conceptually:

1. Source FHIR (raw, synthetic)
2. Canonical `AdmissionEvent`
3. Destination payload + mapping trace

## Non-Goals (POC)

- Bidirectional mapping
- Full FHIR StructureMap execution
- Graphical mapping designer
- Runtime custom JavaScript sandbox

## Testing

- Unit: path get/set, required field failures
- Contract tests: fixture AdmissionEvent + transform version → expected payload snapshot
- Exception: forced missing field → `TRANSFORM_FAILED`
