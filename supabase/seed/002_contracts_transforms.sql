-- Destinations / contracts / transformations for FK-backed delivery path.

insert into destinations (id, code, name, adapter_key, endpoint, auth_type, auth_config, active)
values
  (
    '22222222-2222-4222-8222-222222222001',
    'MOCK_PAYER',
    'Mock Payer Endpoint',
    'mock',
    'mock://payer/noa',
    'NONE',
    null,
    true
  ),
  (
    '22222222-2222-4222-8222-222222222002',
    'SF_NOA_INBOX',
    'Salesforce NOA Inbox (mock)',
    'salesforce',
    'mock://salesforce/noa',
    'OAUTH2',
    '{"clientIdEnv":"SALESFORCE_CLIENT_ID"}'::jsonb,
    true
  ),
  (
    '22222222-2222-4222-8222-222222222003',
    'PEGA_NOA_CASE',
    'Pega NOA Case (mock)',
    'pega',
    'mock://pega/noa',
    'API_KEY',
    '{"apiKeyEnv":"PEGA_API_KEY"}'::jsonb,
    true
  )
on conflict (id) do nothing;

insert into contracts (id, contract_id, name, payer, product, active)
values
  (
    '44444444-4444-4444-8444-444444444010',
    'MEDICARE_NOA_MOCK_V1',
    'Medicare NOA → Mock Payer',
    'MEDICARE',
    'NOA',
    true
  ),
  (
    '44444444-4444-4444-8444-444444444020',
    'MEDICARE_NOA_SF_V1',
    'Medicare NOA → Salesforce',
    'MEDICARE',
    'NOA',
    true
  ),
  (
    '44444444-4444-4444-8444-444444444030',
    'MEDICARE_NOA_PEGA_V1',
    'Medicare NOA → Pega',
    'MEDICARE',
    'NOA',
    true
  )
on conflict (id) do nothing;

insert into contract_versions (
  id, contract_id, version, effective_date, payload_format, transport,
  destination_id, transformer_code, acknowledgement_type, retry_policy, required_fields
)
values
  (
    '44444444-4444-4444-8444-444444444001',
    '44444444-4444-4444-8444-444444444010',
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
    '44444444-4444-4444-8444-444444444002',
    '44444444-4444-4444-8444-444444444020',
    1,
    '2020-01-01T00:00:00Z',
    'JSON',
    'REST',
    '22222222-2222-4222-8222-222222222002',
    'MEDICARE_NOA_SF_TRANSFORM',
    'HTTP_200_BODY',
    '{"maxAttempts":3,"backoffMs":[1000,5000,15000],"deadLetterAfterMax":true}'::jsonb,
    '["notificationType","admissionDateTime","PatientLastName","correlationId"]'::jsonb
  ),
  (
    '44444444-4444-4444-8444-444444444003',
    '44444444-4444-4444-8444-444444444030',
    1,
    '2020-01-01T00:00:00Z',
    'JSON',
    'REST',
    '22222222-2222-4222-8222-222222222003',
    'MEDICARE_NOA_PEGA_TRANSFORM',
    'HTTP_200_BODY',
    '{"maxAttempts":3,"backoffMs":[1000,5000,15000],"deadLetterAfterMax":true}'::jsonb,
    '["notificationType","AdmissionDateTime","MemberLastName","correlationId"]'::jsonb
  )
on conflict (id) do nothing;

insert into transformations (id, code, name, active)
values
  (
    '33333333-3333-4333-8333-333333333010',
    'MEDICARE_NOA_MOCK_TRANSFORM',
    'MEDICARE_NOA_MOCK_TRANSFORM',
    true
  ),
  (
    '33333333-3333-4333-8333-333333333020',
    'MEDICARE_NOA_SF_TRANSFORM',
    'MEDICARE_NOA_SF_TRANSFORM',
    true
  ),
  (
    '33333333-3333-4333-8333-333333333030',
    'MEDICARE_NOA_PEGA_TRANSFORM',
    'MEDICARE_NOA_PEGA_TRANSFORM',
    true
  )
on conflict (id) do nothing;

insert into transformation_versions (
  id, transformation_id, version, source_model, target_format, mappings
)
values
  (
    '33333333-3333-4333-8333-333333333001',
    '33333333-3333-4333-8333-333333333010',
    1,
    'AdmissionEvent',
    'JSON',
    '[{"sourcePath":"notificationType","targetPath":"notificationType","required":true},{"sourcePath":"admission.admissionDateTime","targetPath":"admissionDateTime","required":true,"transform":"dateIso"},{"sourcePath":"patient.name.family","targetPath":"patient.lastName","required":true},{"sourcePath":"patient.name.given","targetPath":"patient.firstName","required":false,"transform":"first"},{"sourcePath":"encounter.class","targetPath":"encounterClass","required":true},{"sourcePath":"payer.payerType","targetPath":"payerType","required":true},{"sourcePath":"facility.name","targetPath":"facilityName","required":false},{"sourcePath":"correlationId","targetPath":"correlationId","required":true}]'::jsonb
  ),
  (
    '33333333-3333-4333-8333-333333333002',
    '33333333-3333-4333-8333-333333333020',
    1,
    'AdmissionEvent',
    'JSON',
    '[{"sourcePath":"notificationType","targetPath":"notificationType","required":true},{"sourcePath":"admission.admissionDateTime","targetPath":"admissionDateTime","required":true},{"sourcePath":"patient.name.family","targetPath":"PatientLastName","required":true},{"sourcePath":"patient.name.given","targetPath":"PatientFirstName","required":false,"transform":"first"},{"sourcePath":"encounter.class","targetPath":"EncounterClass__c","required":true},{"sourcePath":"payer.payerType","targetPath":"PayerType__c","required":true},{"sourcePath":"correlationId","targetPath":"correlationId","required":true}]'::jsonb
  ),
  (
    '33333333-3333-4333-8333-333333333003',
    '33333333-3333-4333-8333-333333333030',
    1,
    'AdmissionEvent',
    'JSON',
    '[{"sourcePath":"notificationType","targetPath":"notificationType","required":true},{"sourcePath":"admission.admissionDateTime","targetPath":"AdmissionDateTime","required":true},{"sourcePath":"patient.name.family","targetPath":"MemberLastName","required":true},{"sourcePath":"patient.name.given","targetPath":"MemberFirstName","required":false,"transform":"first"},{"sourcePath":"encounter.class","targetPath":"EncounterClass","required":true},{"sourcePath":"payer.payerType","targetPath":"PayerType","required":true},{"sourcePath":"correlationId","targetPath":"correlationId","required":true}]'::jsonb
  )
on conflict (id) do nothing;
