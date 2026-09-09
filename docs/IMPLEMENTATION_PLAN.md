# Implementation Plan — FHIR NOA Accelerator

## Current State

- **POC cascade Steps 1–11 complete.** Next.js app, in-memory runtime, Admin UI, and e2e golden path are in place.
- Architecture documentation foundation is in `/docs`.
- Runtime still uses process-local in-memory stores; Supabase schema exists for a later cutover.

## Documentation Created

| Document | Path |
|----------|------|
| POC Scope | `docs/POC_SCOPE.md` |
| Architecture | `docs/ARCHITECTURE.md` |
| Domain Model | `docs/DOMAIN_MODEL.md` |
| Domain Interfaces | `docs/DOMAIN_INTERFACES.md` |
| Database Schema | `docs/DATABASE_SCHEMA.md` |
| FHIR Model | `docs/FHIR_MODEL.md` |
| Rules Engine | `docs/RULE_ENGINE.md` |
| Contract Registry | `docs/CONTRACT_REGISTRY.md` |
| Transform Engine | `docs/TRANSFORM_ENGINE.md` |
| Delivery Architecture | `docs/DELIVERY_ARCHITECTURE.md` |
| Security | `docs/SECURITY.md` |
| AWS Production Target | `docs/AWS_PRODUCTION_ARCHITECTURE.md` |
| This plan | `docs/IMPLEMENTATION_PLAN.md` |

Deferred to Foundation/Ingestion: `docs/API_CONTRACT.md`.

## Cascade (Execute Sequentially)

### Step 3 — Foundation ✅

- Scaffold Next.js (App Router) + TypeScript + Vitest
- Folder structure per Architecture
- Supabase project config placeholders + `.env.example`
- Migrations from `DATABASE_SCHEMA.md`
- Domain types + ports (interfaces only / in-memory fakes for tests)
- `IdGenerator`, `Clock`, `Logger`, error types
- Auth wiring skeleton (Supabase Auth)
- Quality gate: typecheck, lint, unit tests for IDs/logger

### Step 4 — FHIR Ingestion ✅

- `POST /api/fhir/r4/events`
- Fixtures under `/fhir/fixtures`
- Validator + normalizer → `AdmissionEvent`
- Persist event + admission + audit stages through `NORMALIZED`
- Tests: FHIR → AdmissionEvent
- `API_CONTRACT.md`

### Step 5 — Rules ✅

- Condition evaluator + `ConfigurableRulesEngine`
- Seed `MEDICARE_INPATIENT_NOA` + `OUTPATIENT_NO_NOA`
- Persist executions + decisions
- `DefaultNoaPipeline`: FHIR → … → Decision
- Demo: AdmissionEvent → NOA Decision

### Step 6 — Contracts ✅

- Contract registry + destinations + stub transformers
- Seed Mock / Salesforce / Pega Medicare NOA contracts
- Routing after `SEND_NOA` → `ROUTED` (or `NO_CONTRACT`)
- Demo: Decision → Contract; SF/Pega via `X-Contract-Id`

### Step 7 — Transform ✅

- Simple field-mapping engine + Mock/SF/Pega mapping seeds
- Persist destination payload + mapping trace
- Pipeline through `TRANSFORMED` (or `TRANSFORM_FAILED`)
- Demo: AdmissionEvent → destination payload

### Step 8 — Delivery ✅

- Mock + REST adapters; Salesforce/Pega stubs wrapping Mock
- Delivery attempts, ack, in-process retry, dead letter
- Pipeline through `ACKNOWLEDGED`

### Step 9 — Salesforce / Pega Abstractions ✅

- Mock SF/Pega adapters (envelope wrappers; no live credentials)
- Dual-contract demo via `X-Contract-Id` without core engine changes

### Step 10 — Admin UI ✅

- Dashboard metrics from persisted records
- Events + Event Detail (full journey)
- Rules, Contracts, Transformations, Destinations, Deliveries, Audit

### Step 11 — End-to-End ✅

- Automated golden path + vendor routing + exception coverage (`tests/e2e`)

## Quality Gate (Every Step)

1. Tests pass  
2. `tsc` clean  
3. Lint clean  
4. Migrations apply  
5. App builds  
6. Docs updated if architecture shifted  
7. Short summary + risks  

## Engineering Assumptions (Locked for POC)

1. Sync in-process pipeline (no SQS yet).  
2. Correlation ID format `NOA-YYYYMMDD-######`.  
3. `NO_NOA_REQUIRED` stops before routing; state remains `EVALUATED`.  
4. Synthetic data only.  
5. Salesforce/Pega are mocks.  

## Next Action

**POC cascade Steps 1–11 are complete.** Persistence cutover: Supabase repositories are wired when service-role env is present (else in-memory).

Optional follow-ups:

- Apply migrations (`supabase db push`) against a linked project and verify Dashboard survives restart
- Playwright browser smoke tests
- Harden production controls per `SECURITY.md` / `AWS_PRODUCTION_ARCHITECTURE.md`
