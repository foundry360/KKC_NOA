-- Routing selections + transformation results (runtime pipeline persistence)

create table if not exists routing_selections (
  id uuid primary key,
  event_id uuid not null unique references events (id) on delete cascade,
  correlation_id text not null,
  contract_business_id text not null,
  contract_version_id text not null,
  destination_code text not null,
  adapter_key text not null,
  transformer_code text not null,
  routing jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists routing_selections_correlation_id_idx
  on routing_selections (correlation_id);

create table if not exists transformation_results (
  id uuid primary key,
  event_id uuid not null unique references events (id) on delete cascade,
  correlation_id text not null,
  transformer_code text not null,
  transformer_version int not null,
  payload jsonb not null,
  mapping_trace jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists transformation_results_correlation_id_idx
  on transformation_results (correlation_id);

alter table routing_selections enable row level security;
alter table transformation_results enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['routing_selections', 'transformation_results']
  loop
    execute format(
      'drop policy if exists %I on %I;',
      t || '_select_authenticated',
      t
    );
    execute format(
      'create policy %I on %I for select to authenticated using (true);',
      t || '_select_authenticated',
      t
    );
  end loop;
end $$;
