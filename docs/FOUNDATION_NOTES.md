/**
 * Migration note (Foundation):
 * Column `references` renamed to `reference_map` in SQL to avoid the Postgres reserved keyword.
 * Domain `AuditEntry.references` maps to `reference_map` in persistence adapters.
 */
