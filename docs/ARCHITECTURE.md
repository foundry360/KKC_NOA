# Architecture — FHIR NOA Accelerator

## Overview

The FHIR NOA Accelerator is a healthcare **event orchestration platform**. It receives FHIR-based admission events at the edge, converts them to a vendor-agnostic canonical model, applies configurable rules and contracts, and delivers destination-specific notifications through pluggable adapters.

```
FHIR In
  → Validation
  → Canonical Event
  → Rules
  → Decision
  → Routing
  → Contract
  → Transformation
  → Delivery
  → Acknowledgement
  → Audit
```

## Critical Principle: Downstream Agnostic

Salesforce and Pega are **delivery adapters / destination systems**. They are not the core of the platform.

Business logic must **not** depend on Salesforce or Pega. Destinations may include:

- Salesforce, Pega, other payer platforms
- FHIR servers, REST APIs, webhooks, event queues
- Future adapters

Only **contract**, **transformation**, and **delivery adapter** change when routing to a different downstream system.

## Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Admin UI (Next.js)                                         │
│  Dashboard · Events · Rules · Contracts · … · Audit         │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Integration Layer                                          │
│  FHIR listener · auth · correlation · content-type · capture│
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Domain Layer (pure TypeScript — no Supabase/SF/Pega)       │
│  AdmissionEvent · Rules · Decisions · Contracts · Routing   │
│  Transformations · Lifecycle · Ports/Interfaces             │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Application Services                                       │
│  Normalization · Decisioning · Routing · Transform · Audit  │
└─────────────────────────────────────────────────────────────┘
┌──────────────────────┐  ┌───────────────────────────────────┐
│  Delivery Adapters   │  │  Persistence Adapters             │
│  Mock · REST · SF*   │  │  Supabase/Postgres repositories   │
│  Pega* · FHIR · …    │  │  (implement domain ports)         │
└──────────────────────┘  └───────────────────────────────────┘
```

\* Salesforce / Pega: mock implementations in POC.

### Layer Responsibilities

| Layer | Owns | Must Not Own |
|-------|------|--------------|
| **Integration** | Receive FHIR, validate edge concerns, correlation IDs, inbound metadata | NOA business rules, contract selection |
| **Domain** | Canonical events, rules, decisions, routing concepts, contracts, transforms (interfaces) | Supabase, Vercel, Salesforce, Pega SDKs |
| **Services** | Orchestrate pipeline stages, call ports | Hard-coded destinations or mappings in handlers |
| **Delivery** | Transport-specific send + ack parsing | Business rules |
| **Persistence** | Store events, rules, audit, deliveries | Domain decision logic |

## Event Lifecycle

Primary path:

```
RECEIVED → VALIDATED → NORMALIZED → EVALUATED → ROUTED
  → TRANSFORMED → DELIVERED → ACKNOWLEDGED
```

Exception / alternate states:

```
VALIDATION_FAILED | RULE_REJECTED | NO_CONTRACT |
TRANSFORM_FAILED | DELIVERY_FAILED | RETRY_PENDING | DEAD_LETTER
```

Rules:

- Never silently discard an event.
- Every transition is audited with `correlationId` + `eventId`.
- Processing state is explicit and queryable.

## Processing Pipeline (Orchestration)

Conceptual service flow (names illustrative):

1. **FhirIngestionService** — accept request, correlate, persist raw, validate
2. **NormalizationService** — FHIR Bundle → `AdmissionEvent`
3. **RulesEngine** — evaluate active rules → `Decision`
4. **RoutingEngine** — decision + event context → destination + contract + transformer + adapter key
5. **TransformationService** — `AdmissionEvent` + mapping → destination payload
6. **DeliveryService** — adapter `send()`, attempts, ack, retry/dead-letter
7. **AuditService** — append-only stage records

API route handlers call orchestration services only; they do not embed rules or mappings.

## Technology (POC)

| Concern | Choice |
|---------|--------|
| Frontend / API | Next.js (App Router) + TypeScript |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Hosting | Vercel |
| Tests | Vitest (unit/integration/contract), Playwright (e2e) |

### Portability Constraint

Domain and application services must not hard-code Vercel or Supabase. Persistence and auth are behind interfaces so production can move to:

```
AWS VPC → API Gateway/ALB → App Services → SQS → RDS Postgres
         → Secrets Manager → CloudWatch → KMS → WAF
```

See `AWS_PRODUCTION_ARCHITECTURE.md` for the migration target (design-only in POC).

## Repository Structure

```
/app                          # Next.js App Router (UI + API routes)
  /dashboard
  /events
  /rules
  /contracts
  /transformations
  /destinations
  /deliveries
  /audit
  /api/fhir/r4/events

/src
  /domain                     # Types, entities, ports, pure logic
    /events
    /admission
    /rules
    /decisions
    /contracts
    /transformations
    /routing
    /delivery
  /services                   # Pipeline orchestration
    /fhir
    /normalization
    /decisioning
    /routing
    /transformation
    /delivery
    /audit
  /adapters
    /fhir
    /rest
    /salesforce
    /pega
    /mock
  /infrastructure             # Supabase clients, repo implementations
  /schemas
  /types
  /utils

/fhir/fixtures
/fhir/profiles
/rules/examples
/contracts/examples
/transformations/examples

/supabase/migrations
/supabase/seed

/tests/unit
/tests/integration
/tests/contract
/tests/e2e

/docs
```

## Correlation & Traceability

Every transaction carries:

- `eventId` (UUID)
- `correlationId` (human-readable, e.g. `NOA-20260909-000123`)
- `timestamp`
- `processingState`

All services forward `correlationId`. The Event Detail UI reconstructs the full journey from persisted stages + audit.

## Logging

- Structured application logging via an abstraction (swapable for CloudWatch later).
- **No PHI in logs** — use IDs and synthetic labels only.
- Audit table is the system of record for stage history; logs are operational.

## Security (Summary)

POC: Supabase Auth, RLS where appropriate, env-based secrets, HTTPS via Vercel, synthetic data.

Production additions documented in `SECURITY.md` and `AWS_PRODUCTION_ARCHITECTURE.md`.

**Do not claim the POC is HIPAA compliant.**

## Architectural Non-Negotiables

1. FHIR is an **edge format**, not the internal model.
2. Domain does not depend on Supabase, Salesforce, or Pega.
3. Rules are configurable and versioned — not hard-coded in routes/UI.
4. Contracts and destinations are registry-driven.
5. Routing is separate from transformation.
6. Delivery is adapter-based.
7. Every stage is auditable; failures are explicit.
8. Architecture changes require documentation updates first.

## Related Documents

- [POC_SCOPE.md](./POC_SCOPE.md)
- [DOMAIN_MODEL.md](./DOMAIN_MODEL.md)
- [FHIR_MODEL.md](./FHIR_MODEL.md)
- [RULE_ENGINE.md](./RULE_ENGINE.md)
- [CONTRACT_REGISTRY.md](./CONTRACT_REGISTRY.md)
- [TRANSFORMATION_ENGINE.md](./TRANSFORMATION_ENGINE.md)
- [DELIVERY_ARCHITECTURE.md](./DELIVERY_ARCHITECTURE.md)
- [SECURITY.md](./SECURITY.md)
- [API_CONTRACT.md](./API_CONTRACT.md)
- [AWS_PRODUCTION_ARCHITECTURE.md](./AWS_PRODUCTION_ARCHITECTURE.md)
