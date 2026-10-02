-- Payer-specific contract profile dimensions + profile JSON.
-- Supports published-payer requirement profiles (not negotiated contracts).

alter table contracts
  add column if not exists payer_brand text;

alter table contracts
  add column if not exists state_code text;

alter table contracts
  add column if not exists source_type text;

alter table contract_versions
  add column if not exists profile jsonb not null default '{}'::jsonb;

comment on column contracts.payer_brand is
  'Payer brand / legal name for specificity matching (e.g. Aetna).';
comment on column contracts.source_type is
  'PUBLISHED_PAYER_REQUIREMENT_PROFILE | PROVIDER_PAYER_CONTRACT | GENERIC_PAYER_TYPE';
comment on column contract_versions.profile is
  'Operational HOW metadata: windows, channels, provenance (not legal contract text).';
