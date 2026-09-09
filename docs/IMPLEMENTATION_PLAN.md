# Implementation Plan — FHIR NOA Accelerator

## Current State

- Repository is **empty** (greenfield). No Next.js app, Supabase config, or existing UI.
- **No conflicts** with the target architecture.
- Architecture documentation foundation is in `/docs`.

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

### Step 6 — Contracts

- Registry + destinations + selection
- Seed mock / SF / Pega contracts
- Demo: Decision → Contract

### Step 7 — Transform

- Mapping engine + versions
- Demo: AdmissionEvent → destination payload

### Step 8 — Delivery

- `DeliveryService` + Mock + REST adapters
- Attempts, ack, retry, dead letter
- Demo: payload → downstream

### Step 9 — Salesforce / Pega Abstractions

- Mock SF/Pega adapters
- Dual-contract demo without core changes

### Step 10 — Admin UI

- Nav shell + Dashboard + lists
- **Event Detail** prioritized (full journey)

### Step 11 — End-to-End

- Automated golden path + exception tests
- Playwright smoke as appropriate

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

**Step 5 — Rules is complete.** Proceed to **Step 6 — Contracts**:

- Contract registry + destinations + selection
- Seed mock / SF / Pega contracts
- Demonstrate Decision → Contract
