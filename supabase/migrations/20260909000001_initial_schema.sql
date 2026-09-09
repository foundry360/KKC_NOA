-- FHIR NOA Accelerator — initial schema
-- See docs/DATABASE_SCHEMA.md

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- organizations / users / source_systems
-- ---------------------------------------------------------------------------

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key,
  organization_id uuid references organizations (id),
  email text,
  display_name text,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create table if not exists source_systems (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  correlation_id text not null unique,
  event_type text not null,
  source_system_id uuid references source_systems (id),
  received_at timestamptz not null default now(),
  content_type text,
  processing_state text not null,
  raw_payload jsonb not null,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_processing_state_check check (
    processing_state in (
      'RECEIVED',
      'VALIDATED',
      'NORMALIZED',
      'EVALUATED',
      'ROUTED',
      'TRANSFORMED',
      'DELIVERED',
      'ACKNOWLEDGED',
      'VALIDATION_FAILED',
      'RULE_REJECTED',
      'NO_CONTRACT',
      'TRANSFORM_FAILED',
      'DELIVERY_FAILED',
      'RETRY_PENDING',
      'DEAD_LETTER'
    )
  )
);

create index if not exists events_correlation_id_idx on events (correlation_id);
create index if not exists events_processing_state_idx on events (processing_state);
create index if not exists events_received_at_idx on events (received_at desc);

create table if not exists event_resources (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  resource_type text not null,
  resource_id text,
  resource jsonb
);

create index if not exists event_resources_event_id_idx on event_resources (event_id);

create table if not exists admission_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references events (id) on delete cascade,
  correlation_id text not null,
  canonical jsonb not null,
  event_timestamp timestamptz,
  payer_type text,
  encounter_class text,
  created_at timestamptz not null default now()
);

create index if not exists admission_events_correlation_id_idx on admission_events (correlation_id);

-- ---------------------------------------------------------------------------
-- rules
-- ---------------------------------------------------------------------------

create table if not exists rules (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  priority int not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references rules (id) on delete cascade,
  version int not null,
  effective_date timestamptz not null default now(),
  expiration_date timestamptz,
  conditions jsonb not null,
  actions jsonb not null,
  unique (rule_id, version)
);

create table if not exists rule_executions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  correlation_id text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  input_snapshot jsonb,
  matched_rule_version_ids uuid[],
  result_summary jsonb
);

create index if not exists rule_executions_event_id_idx on rule_executions (event_id);

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  correlation_id text not null,
  decision text not null,
  notification_required boolean not null default false,
  notification_type text,
  priority text,
  rules_applied text[] not null default '{}',
  rule_version_refs text[] not null default '{}',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint decisions_outcome_check check (
    decision in ('SEND_NOA', 'NO_NOA_REQUIRED', 'REJECT')
  )
);

create index if not exists decisions_event_id_idx on decisions (event_id);

-- ---------------------------------------------------------------------------
-- destinations / contracts / transformations
-- ---------------------------------------------------------------------------

create table if not exists destinations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  adapter_key text not null,
  endpoint text,
  auth_type text,
  auth_config jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  contract_id text not null unique,
  name text not null,
  payer text,
  product text,
  active boolean not null default true
);

create table if not exists contract_versions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts (id) on delete cascade,
  version int not null,
  effective_date timestamptz not null default now(),
  expiration_date timestamptz,
  payload_format text not null default 'JSON',
  transport text not null default 'REST',
  destination_id uuid not null references destinations (id),
  transformer_code text not null,
  acknowledgement_type text not null default 'HTTP_200_BODY',
  retry_policy jsonb not null default '{"maxAttempts":3,"backoffMs":[1000,5000,15000],"deadLetterAfterMax":true}'::jsonb,
  required_fields jsonb not null default '[]'::jsonb,
  unique (contract_id, version)
);

create table if not exists contract_fields (
  id uuid primary key default gen_random_uuid(),
  contract_version_id uuid not null references contract_versions (id) on delete cascade,
  field_path text not null,
  required boolean not null default true,
  description text
);

create table if not exists transformations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true
);

create table if not exists transformation_versions (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  version int not null,
  source_model text not null default 'AdmissionEvent',
  target_format text not null default 'JSON',
  mappings jsonb not null,
  unique (transformation_id, version)
);

-- ---------------------------------------------------------------------------
-- notifications / delivery / audit
-- ---------------------------------------------------------------------------

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  correlation_id text not null,
  decision_id uuid references decisions (id),
  contract_version_id uuid references contract_versions (id),
  destination_id uuid references destinations (id),
  transformation_version_id uuid references transformation_versions (id),
  adapter_key text,
  request_payload jsonb,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notifications_event_id_idx on notifications (event_id);
create index if not exists notifications_correlation_id_idx on notifications (correlation_id);

create table if not exists delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications (id) on delete cascade,
  attempt_number int not null,
  attempted_at timestamptz not null default now(),
  status text not null,
  status_code int,
  response_summary text,
  error_message text,
  retryable boolean,
  next_retry_at timestamptz,
  acknowledgement jsonb,
  constraint delivery_attempts_status_check check (status in ('SUCCESS', 'FAILURE'))
);

create index if not exists delivery_attempts_notification_id_idx on delivery_attempts (notification_id);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  correlation_id text not null,
  event_id uuid references events (id) on delete set null,
  timestamp timestamptz not null default now(),
  component text not null,
  action text not null,
  status text not null,
  detail jsonb,
  error_code text,
  error_message text,
  reference_map jsonb,
  constraint audit_events_status_check check (status in ('SUCCESS', 'FAILURE', 'INFO'))
);

create index if not exists audit_events_correlation_ts_idx on audit_events (correlation_id, timestamp);
create index if not exists audit_events_event_id_idx on audit_events (event_id);

create table if not exists errors (
  id uuid primary key default gen_random_uuid(),
  correlation_id text,
  event_id uuid references events (id) on delete set null,
  stage text,
  code text,
  message text,
  details jsonb,
  created_at timestamptz not null default now()
);

create table if not exists dead_letters (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references notifications (id) on delete set null,
  event_id uuid references events (id) on delete set null,
  correlation_id text,
  reason text,
  last_error text,
  payload_snapshot jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS (deny-by-default sketch; refine with Auth in later steps)
-- ---------------------------------------------------------------------------

alter table organizations enable row level security;
alter table users enable row level security;
alter table source_systems enable row level security;
alter table events enable row level security;
alter table event_resources enable row level security;
alter table admission_events enable row level security;
alter table rules enable row level security;
alter table rule_versions enable row level security;
alter table rule_executions enable row level security;
alter table decisions enable row level security;
alter table destinations enable row level security;
alter table contracts enable row level security;
alter table contract_versions enable row level security;
alter table contract_fields enable row level security;
alter table transformations enable row level security;
alter table transformation_versions enable row level security;
alter table notifications enable row level security;
alter table delivery_attempts enable row level security;
alter table audit_events enable row level security;
alter table errors enable row level security;
alter table dead_letters enable row level security;

-- Authenticated admins can read operational data (POC).
do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations',
    'users',
    'source_systems',
    'events',
    'event_resources',
    'admission_events',
    'rules',
    'rule_versions',
    'rule_executions',
    'decisions',
    'destinations',
    'contracts',
    'contract_versions',
    'contract_fields',
    'transformations',
    'transformation_versions',
    'notifications',
    'delivery_attempts',
    'audit_events',
    'errors',
    'dead_letters'
  ]
  loop
    execute format(
      'create policy %I on %I for select to authenticated using (true);',
      t || '_select_authenticated',
      t
    );
  end loop;
end $$;
