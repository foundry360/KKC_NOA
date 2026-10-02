-- Meridian Clinical → Salesforce Admission__c integration status.
-- One row per (admission_id, integration_type). The FHIR payload itself is not
-- stored here (it lives with the Meridian FHIR event); only its hash/length.
-- Credentials and access tokens are never stored.

create table if not exists public.meridian_integration_submissions (
  id uuid primary key default gen_random_uuid(),
  admission_id text not null,
  integration_type text not null default 'SALESFORCE_ADMISSION',
  status text not null default 'PENDING'
    check (status in ('PENDING', 'SUBMITTING', 'SUBMITTED', 'FAILED', 'RETRYABLE')),
  salesforce_record_id text,
  salesforce_record_url text,
  submitted_at timestamptz,
  last_attempt_at timestamptz,
  error_type text,
  error_message text,
  http_status integer,
  attempt_count integer not null default 0,
  payload_sha256 text,
  payload_length integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meridian_integration_submissions_unique
    unique (admission_id, integration_type)
);

alter table public.meridian_integration_submissions enable row level security;
-- No policies: only the service role (Edge Function) can read or write.

-- Atomically claims a submission for sending. Returns
-- {"claimed": bool, "row": {...}}; claimed=false means the caller must not send
-- (already SUBMITTED, or a non-stale SUBMITTING attempt is in flight).
create or replace function public.claim_integration_submission(
  p_admission_id text,
  p_integration_type text,
  p_payload_sha256 text,
  p_payload_length integer,
  p_stale_after_seconds integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.meridian_integration_submissions;
begin
  insert into public.meridian_integration_submissions (admission_id, integration_type)
  values (p_admission_id, p_integration_type)
  on conflict (admission_id, integration_type) do nothing;

  update public.meridian_integration_submissions s
     set status = 'SUBMITTING',
         attempt_count = s.attempt_count + 1,
         last_attempt_at = now(),
         updated_at = now(),
         payload_sha256 = p_payload_sha256,
         payload_length = p_payload_length,
         error_type = null,
         error_message = null
   where s.admission_id = p_admission_id
     and s.integration_type = p_integration_type
     and (
       s.status in ('PENDING', 'FAILED', 'RETRYABLE')
       or (s.status = 'SUBMITTING'
           and s.updated_at < now() - make_interval(secs => p_stale_after_seconds))
     )
  returning s.* into r;

  if found then
    return jsonb_build_object('claimed', true, 'row', to_jsonb(r));
  end if;

  select * into r
    from public.meridian_integration_submissions s
   where s.admission_id = p_admission_id
     and s.integration_type = p_integration_type;

  return jsonb_build_object('claimed', false, 'row', to_jsonb(r));
end;
$$;

revoke all on function public.claim_integration_submission(text, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_integration_submission(text, text, text, integer, integer)
  to service_role;
