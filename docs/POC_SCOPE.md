# POC Scope — FHIR NOA Accelerator

## Purpose

This document defines what is **in scope** and **out of scope** for the FHIR NOA Accelerator proof of concept. It is the guardrail against scope creep.

## Product Positioning

This is an **integration and orchestration accelerator**, not a single-platform NOA application.

**Architectural value:** FHIR interoperability + configurable decisioning + contract management + transformation + downstream orchestration.

- **NOA** is the first use case.
- **Salesforce** and **Pega** are downstream destinations (adapters), not platform cores.
- The accelerator must be reusable across payer and healthcare environments.

## In Scope

### Core Pipeline

1. Receive FHIR R4 Bundle admission events via `POST /api/fhir/r4/events`
2. Validate FHIR payloads (structure + required resources for NOA)
3. Normalize to canonical `AdmissionEvent`
4. Evaluate configurable business rules
5. Produce explicit NOA decision
6. Route to destination via Contract Registry
7. Transform to destination-specific payload
8. Deliver via adapters (Mock, REST; Salesforce/Pega as mocks)
9. Record acknowledgement
10. Full audit trail and correlation ID traceability

### Data & Persistence

- Supabase PostgreSQL with migrations and seed data
- Synthetic PHI only
- Event lifecycle state machine
- Retry / dead-letter tracking for delivery failures

### Admin UI

- Dashboard (metrics from real data)
- Events list + Event Detail (primary demo surface)
- Rules, Contracts, Transformations, Destinations, Deliveries, Audit views
- Professional but intentionally simple; pipeline correctness over polish

### Demonstrations

1. **Golden path:** FHIR → full pipeline → mock ack → audit visible in UI
2. **Vendor-agnostic routing:** Same FHIR/canonical/decision → Contract A (Salesforce) vs Contract B (Pega)
3. **Exception scenarios:** Invalid FHIR, missing data, NOA not required, unknown payer, missing contract, transform failure, timeout, HTTP error, retry, dead letter (automated tests)

### Documentation

Architecture, domain model, FHIR model, rules, contracts, transform, delivery, security, AWS production target, this scope doc.

### Testing

Unit, integration, contract, and e2e tests for the golden path and exception scenarios.

## Out of Scope (POC)

| Area | Exclusion |
|------|-----------|
| Full FHIR server | No resource CRUD, search, CapabilityStatement as a server |
| Live Salesforce / Pega | No real credentials or live API calls |
| Production HIPAA compliance | Design for it; do not claim POC is HIPAA compliant |
| Full AWS stack | No VPC, API Gateway, SQS, Secrets Manager, etc. in POC |
| Enterprise mapping language | Simple field-path mappings only |
| Advanced rules DSL | Structured conditions/actions; not a general-purpose BPM engine |
| Multi-tenant SaaS productization | Single-tenant POC assumptions OK |
| Real PHI / production data | Synthetic fixtures only |
| Notification of Discharge / Eligibility / Prior Auth / etc. | Architecture must allow; implementation deferred |
| Complex RBAC / clinical workflows | Basic Supabase Auth + RLS patterns |
| High-availability / multi-region | Not required for POC |

## Explicit Engineering Assumptions

1. **Monorepo Next.js app** — App Router; API routes as the integration edge; domain logic in `/src`.
2. **Supabase** used for Auth + Postgres; domain layer depends on ports/interfaces, not Supabase client APIs.
3. **Synchronous processing for POC** — Pipeline runs in-request (or short-lived server work). Async queue (SQS) is a production evolution, not a POC requirement.
4. **Correlation ID** format example: `NOA-YYYYMMDD-######` (configurable generator).
5. **One primary FHIR profile** — Admission Bundle with MessageHeader, Patient, Encounter, Coverage, Organization, Practitioner.
6. **Mock downstream** returns a deterministic acknowledgement suitable for demo and tests.
7. **Seed data** includes example rules, contracts, transformations, and destinations for Medicare inpatient NOA golden path + Salesforce/Pega alternate routing.

## Success Criteria (Definition of Done)

The POC is complete when:

1. A synthetic FHIR admission event enters the platform.
2. The system validates → normalizes → evaluates → decides → routes → selects contract → transforms → delivers → acknowledges → audits.
3. The Admin UI shows the complete journey on Event Detail.
4. The same event can target Salesforce or Pega by changing contract/destination/adapter configuration only — **without** modifying the FHIR listener, canonical model, or core rules engine.

## Change Control

If implementation requires expanding or reducing this scope:

1. Document the change here.
2. Note the architectural impact.
3. Proceed only after the docs reflect the decision.
