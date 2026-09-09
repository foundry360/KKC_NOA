# AWS Production Architecture — Target State

## Intent

The POC runs on **Next.js + Supabase + Vercel**. Production for a customer implementation is expected to land in an **AWS VPC**. This document describes the **target** architecture and how POC boundaries map to it.

**Do not implement this stack in the POC.** Preserve interfaces so infrastructure can be replaced.

## Target Topology

```
Internet / Partner Network
        │
        ▼
   AWS WAF
        │
        ▼
 API Gateway and/or ALB
        │
        ▼
 Application Services (ECS/EKS/Lambda — TBD)
        │
        ├──► SQS / EventBridge (async pipeline, retries)
        ├──► RDS PostgreSQL (private subnet)
        ├──► Secrets Manager
        ├──► CloudWatch Logs/Metrics/Alarms
        └──► KMS (encryption keys)
```

Optional: private Link/VPN for payer endpoints; S3 for large payload archival.

## Mapping POC → Production

| POC Concern | POC Implementation | Production Replacement |
|-------------|--------------------|------------------------|
| HTTP edge | Next.js Route Handlers on Vercel | API Gateway / ALB + service |
| Auth (admin) | Supabase Auth | Cognito / customer IdP |
| Auth (ingest) | API key header | mTLS, OAuth2, mutual certs |
| Database | Supabase Postgres | RDS PostgreSQL |
| Secrets | Vercel env | Secrets Manager |
| Sync pipeline | In-request orchestration | SQS worker consumers per stage or single worker |
| Delivery retries | In-process loop | SQS visibility timeout + DLQ |
| Logs | Logger abstraction | CloudWatch + SIEM |
| UI | Next.js on Vercel | CloudFront + same app or separate |
| Adapters | Mock/REST/SF/Pega stubs | Same ports; real SF/Pega connectors |

## What Must Stay Stable

These POC artifacts should survive migration with minimal change:

1. Domain types (`AdmissionEvent`, `Decision`, …)
2. Ports: repositories, `RulesEngine`, `ContractRegistry`, `TransformationEngine`, `DeliveryAdapter`, `AuditPort`
3. Lifecycle state machine and audit schema concepts
4. Contract / transform configuration model
5. Adapter keys and delivery attempt semantics

## What May Change Freely

- Next.js API route thin adapters → alternate HTTP frameworks
- Supabase client repositories → RDS + repository impl
- In-process pipeline → message-driven stages
- Vercel hosting → ECS/EKS

## Recommended Production Hardening (Checklist)

- [ ] Private RDS, encrypted, automated backups
- [ ] No PHI in CloudWatch; structured redaction
- [ ] WAF rules + rate limits on ingest
- [ ] Idempotent ingest (`Idempotency-Key` / Bundle identifier)
- [ ] DLQ monitoring and replay runbooks
- [ ] BAAs and HIPAA program controls
- [ ] Penetration test before go-live
- [ ] Customer-specific destination allowlists

## Decision Deferred

Exact compute choice (ECS vs EKS vs Lambda) is deferred until non-functional requirements (latency, throughput, ops model) are known. Domain isolation makes that choice non-blocking for the POC.
