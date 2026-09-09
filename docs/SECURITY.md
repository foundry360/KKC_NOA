# Security — FHIR NOA Accelerator

## POC Security Requirements

| Control | POC Approach |
|---------|----------------|
| Authentication | Supabase Auth for Admin UI; API caller auth via key/header or Supabase JWT (document chosen pattern in API_CONTRACT) |
| Authorization | RLS on tenant-scoped tables where appropriate; service role only on server |
| Secrets | Environment variables (Vercel/Supabase); never commit secrets |
| Transport | HTTPS (Vercel); local HTTP only for development |
| Data | Synthetic patient data only — **no real PHI** |
| Logging | No PHI in application logs; prefer `eventId` / `correlationId` |
| Audit | Append-only `audit_events` for significant stages |
| API patterns | Validate content-type, size limits, auth on ingest |

## Explicit Non-Claim

**This POC is not production HIPAA compliant.** It demonstrates architecture and controls that can be hardened.

## PHI Handling Rules (POC)

1. Fixtures use clearly synthetic names (e.g. `SYNTHETIC`, `ADA LOVELACE-TEST`).
2. Do not copy payload bodies into `console.log` / APM without redaction.
3. Audit `detail` fields store structural metadata and IDs, not full clinical narratives unless already synthetic and needed for demo UI (prefer UI reading from DB with auth).
4. Error messages returned to clients are generic; details stay in secured audit/error tables.

## Secrets Layout (Illustrative)

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FHIR_INGEST_API_KEY=
REST_DESTINATION_URL=
REST_DESTINATION_API_KEY=
```

Destination auth config in DB references **env var names**, not secret values.

## Row Level Security (POC Intent)

- Enable RLS on user-facing tables.
- Policies: authenticated admin users can read operational data; writes to ingest path use server-side service role after API key check.
- Exact policies refined during Foundation; avoid leaving tables world-readable with anon key.

## Production Security Additions

Documented targets (not implemented in POC):

| Control | Production |
|---------|------------|
| Identity | AWS IAM, workforce IdP (SAML/OIDC), least privilege |
| Secrets | AWS Secrets Manager / SSM; rotation |
| Encryption | KMS for RDS, S3, app secrets; TLS everywhere |
| Network | VPC, private subnets, no public DB, security groups |
| Edge | WAF, API Gateway auth, rate limiting |
| Logging | Centralized CloudWatch / SIEM; PHI-aware redaction |
| Compliance | BAA with vendors, HIPAA risk analysis, audit retention, access reviews |
| App | Penetration testing, dependency scanning, threat modeling |

See [AWS_PRODUCTION_ARCHITECTURE.md](./AWS_PRODUCTION_ARCHITECTURE.md).

## Threat Notes (Lightweight)

| Threat | Mitigation (POC → Prod) |
|--------|-------------------------|
| Unauthenticated ingest | API key → mTLS / OAuth2 client credentials |
| Data exfiltration via logs | Redaction + prod log controls |
| Secret leak in repo | Env-only + pre-commit secret scan (recommended) |
| Adapter SSRF | Allowlisted destinations in prod |
| Replay | Correlation + idempotency keys (prod enhancement) |

## Incident / Audit

Every significant stage writes an audit record (see Domain Model). Retention policy for production TBD with customer; POC retains in Postgres indefinitely for demo.
