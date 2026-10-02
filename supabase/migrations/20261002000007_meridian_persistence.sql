-- Meridian Clinical (mock EMR) persistence. Separate from NOA's tables: this
-- stands in for the hospital EMR's own database. Records are stored as jsonb
-- documents with indexed lookup columns. Synthetic/demo data only.
-- RLS enabled with no policies: service role (Next.js server) only.

create table if not exists public.meridian_patients (
  id text primary key,
  mrn text not null unique,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meridian_encounters (
  id text primary key,
  patient_id text not null references public.meridian_patients (id) on delete cascade,
  status text not null,
  admitted_at timestamptz not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meridian_encounters_patient_idx
  on public.meridian_encounters (patient_id, admitted_at desc);

create table if not exists public.meridian_fhir_events (
  id text primary key,
  patient_id text not null,
  encounter_id text not null,
  created_at timestamptz not null,
  data jsonb not null
);
create index if not exists meridian_fhir_events_encounter_idx
  on public.meridian_fhir_events (encounter_id);
create index if not exists meridian_fhir_events_patient_idx
  on public.meridian_fhir_events (patient_id, created_at desc);

create table if not exists public.meridian_notifications (
  id text primary key,
  patient_id text not null,
  encounter_id text not null,
  created_at timestamptz not null,
  data jsonb not null
);
create index if not exists meridian_notifications_encounter_idx
  on public.meridian_notifications (encounter_id);
create index if not exists meridian_notifications_patient_idx
  on public.meridian_notifications (patient_id, created_at desc);

-- Meridian's view of the Salesforce submission (attempt history, errors raised
-- before the Edge Function was reached). The Edge Function's
-- meridian_integration_submissions row remains authoritative for status.
create table if not exists public.meridian_salesforce_submissions (
  admission_id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.meridian_patients enable row level security;
alter table public.meridian_encounters enable row level security;
alter table public.meridian_fhir_events enable row level security;
alter table public.meridian_notifications enable row level security;
alter table public.meridian_salesforce_submissions enable row level security;
