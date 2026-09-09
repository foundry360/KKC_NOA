# FHIR NOA Accelerator

Healthcare **integration and orchestration** proof of concept for Notification of Admission (NOA).

```
FHIR In → Validation → Canonical Event → Rules → Decision
  → Routing → Contract → Transform → Delivery → Ack → Audit
```

Salesforce and Pega are **delivery adapters**, not the platform core.

## Documentation

Architecture contracts live in [`docs/`](./docs/):

- [POC Scope](./docs/POC_SCOPE.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Domain Model](./docs/DOMAIN_MODEL.md)
- [Implementation Plan](./docs/IMPLEMENTATION_PLAN.md)

## Stack (POC)

- Next.js (App Router) + TypeScript
- Supabase PostgreSQL + Auth
- Vitest
- Vercel-ready; domain layer portable to AWS

## Getting started

```bash
cp .env.example .env.local
npm install
npm run dev
```

```bash
npm run quality   # typecheck + lint + tests
```

Apply database migrations with the Supabase CLI when a project is linked:

```bash
supabase db push
# or: supabase migration up
```

## Current cascade status

**Steps 1–11 complete** for the POC definition of done.

Golden path: FHIR → validate → normalize → rules → decide → route → transform → deliver → acknowledge → audit.

Vendor-agnostic: same event → Salesforce or Pega via `X-Contract-Id` only.

## Security note

Synthetic data only. This POC is **not** HIPAA compliant. See [SECURITY.md](./docs/SECURITY.md).
