insert into source_systems (code, name, active)
values ('SYNTHETIC_EHR', 'Synthetic EHR (POC)', true)
on conflict (code) do nothing;

-- Seed rules (identity + version). IDs are stable for POC demos.
insert into rules (id, name, description, priority, active)
values
  (
    '11111111-1111-4111-8111-111111111001',
    'MEDICARE_INPATIENT_NOA',
    'Require NOA for Medicare inpatient admissions',
    100,
    true
  ),
  (
    '11111111-1111-4111-8111-111111111002',
    'OUTPATIENT_NO_NOA',
    'Explicitly mark outpatient admissions as not requiring NOA',
    90,
    true
  )
on conflict (name) do nothing;

insert into rule_versions (id, rule_id, version, effective_date, conditions, actions)
values
  (
    '11111111-1111-4111-8111-111111111101',
    '11111111-1111-4111-8111-111111111001',
    1,
    '2020-01-01T00:00:00Z',
    '{"all":[{"path":"eventType","op":"eq","value":"ADMISSION"},{"path":"encounter.class","op":"eq","value":"INPATIENT"},{"path":"payer.payerType","op":"eq","value":"MEDICARE"}]}'::jsonb,
    '{"decision":"SEND_NOA","notificationRequired":true,"notificationType":"NOA","priority":"HIGH"}'::jsonb
  ),
  (
    '11111111-1111-4111-8111-111111111102',
    '11111111-1111-4111-8111-111111111002',
    1,
    '2020-01-01T00:00:00Z',
    '{"all":[{"path":"eventType","op":"eq","value":"ADMISSION"},{"path":"encounter.class","op":"eq","value":"OUTPATIENT"}]}'::jsonb,
    '{"decision":"NO_NOA_REQUIRED","notificationRequired":false,"notificationType":"NOA","priority":"LOW"}'::jsonb
  )
on conflict (rule_id, version) do nothing;
