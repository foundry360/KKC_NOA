-- Broaden facility-admission NOA rules and add commercial/medicaid contracts.
-- Idempotent upserts for environments that already ran earlier seeds.

insert into source_systems (code, name, active)
values ('MERIDIAN_CLINICAL', 'Meridian Clinical (Mock EHR)', true)
on conflict (code) do update
set name = excluded.name, active = excluded.active;

update rules
set
  name = 'FACILITY_ADMISSION_NOA',
  description = 'Require NOA for inpatient, emergency, and observation admissions (any payer)',
  priority = 100,
  active = true
where id = '11111111-1111-4111-8111-111111111001';

update rule_versions
set
  conditions = '{"all":[{"path":"eventType","op":"eq","value":"ADMISSION"},{"path":"encounter.class","op":"in","value":["INPATIENT","EMERGENCY","OBSERVATION"]}]}'::jsonb,
  actions = '{"decision":"SEND_NOA","notificationRequired":true,"notificationType":"NOA","priority":"HIGH"}'::jsonb
where id = '11111111-1111-4111-8111-111111111101';

insert into contracts (id, contract_id, name, payer, product, active)
values
  (
    '44444444-4444-4444-8444-444444444040',
    'COMMERCIAL_NOA_MOCK_V1',
    'Commercial NOA → Mock Payer',
    'COMMERCIAL',
    'NOA',
    true
  ),
  (
    '44444444-4444-4444-8444-444444444050',
    'MEDICAID_NOA_MOCK_V1',
    'Medicaid NOA → Mock Payer',
    'MEDICAID',
    'NOA',
    true
  )
on conflict (id) do update
set
  contract_id = excluded.contract_id,
  name = excluded.name,
  payer = excluded.payer,
  product = excluded.product,
  active = excluded.active;

insert into contract_versions (
  id, contract_id, version, effective_date, payload_format, transport,
  destination_id, transformer_code, acknowledgement_type, retry_policy, required_fields
)
values
  (
    '44444444-4444-4444-8444-444444444004',
    '44444444-4444-4444-8444-444444444040',
    1,
    '2020-01-01T00:00:00Z',
    'JSON',
    'REST',
    '22222222-2222-4222-8222-222222222001',
    'MEDICARE_NOA_MOCK_TRANSFORM',
    'HTTP_200_BODY',
    '{"maxAttempts":3,"backoffMs":[1000,5000,15000],"deadLetterAfterMax":true}'::jsonb,
    '["notificationType","admissionDateTime","patient.lastName","correlationId"]'::jsonb
  ),
  (
    '44444444-4444-4444-8444-444444444005',
    '44444444-4444-4444-8444-444444444050',
    1,
    '2020-01-01T00:00:00Z',
    'JSON',
    'REST',
    '22222222-2222-4222-8222-222222222001',
    'MEDICARE_NOA_MOCK_TRANSFORM',
    'HTTP_200_BODY',
    '{"maxAttempts":3,"backoffMs":[1000,5000,15000],"deadLetterAfterMax":true}'::jsonb,
    '["notificationType","admissionDateTime","patient.lastName","correlationId"]'::jsonb
  )
on conflict (id) do nothing;
