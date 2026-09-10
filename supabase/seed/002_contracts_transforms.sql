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
  ),
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
  ),
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
    '[{"sourcePath":"notificationType","targetPath":"notificationType","required":true},{"sourcePath":"admission.admissionDateTime","targetPath":"admissionDateTime","required":true,"transform":"dateIso"},{"sourcePath":"patient.name.family","targetPath":"patient.lastName","required":true},{"sourcePath":"patient.name.given","targetPath":"patient.firstName","required":false,"transform":"first"},{"sourcePath":"encounter.class","targetPath":"encounterClass","required":true},{"sourcePath":"payer.payerType","targetPath":"payerType","required":true},{"sourcePath":"facility.name","targetPath":"facilityName","required":false},{"sourcePath":"correlationId","targetPath":"correlationId","required":true},{"sourcePath":"patient.memberId","targetPath":"patient.memberId","required":false},{"sourcePath":"patient.mrn","targetPath":"patient.mrn","required":false},{"sourcePath":"patient.birthDate","targetPath":"patient.birthDate","required":false},{"sourcePath":"patient.gender","targetPath":"patient.gender","required":false},{"sourcePath":"patient.phone","targetPath":"patient.phone","required":false},{"sourcePath":"patient.address.line","targetPath":"patient.address.line1","required":false,"transform":"first"},{"sourcePath":"patient.address.city","targetPath":"patient.address.city","required":false},{"sourcePath":"patient.address.state","targetPath":"patient.address.state","required":false},{"sourcePath":"patient.address.postalCode","targetPath":"patient.address.postalCode","required":false},{"sourcePath":"encounter.visitId","targetPath":"encounter.visitId","required":false},{"sourcePath":"encounter.status","targetPath":"encounter.status","required":false},{"sourcePath":"encounter.locationDisplay","targetPath":"encounter.locationDisplay","required":false},{"sourcePath":"facility.npi","targetPath":"facilityNpi","required":false},{"sourcePath":"payer.name","targetPath":"payerName","required":false},{"sourcePath":"coverage.subscriberId","targetPath":"coverage.subscriberId","required":false},{"sourcePath":"coverage.status","targetPath":"coverage.status","required":false},{"sourcePath":"coverage.plan","targetPath":"coverage.plan","required":false},{"sourcePath":"coverage.groupNumber","targetPath":"coverage.groupNumber","required":false},{"sourcePath":"providers.0.npi","targetPath":"attendingProviderNpi","required":false},{"sourcePath":"providers.0.name.family","targetPath":"attendingProviderLastName","required":false},{"sourcePath":"providers.0.name.given","targetPath":"attendingProviderFirstName","required":false,"transform":"first"}]'::jsonb
  ),
  (
    '33333333-3333-4333-8333-333333333002',
    '33333333-3333-4333-8333-333333333020',
    1,
    'AdmissionEvent',
    'JSON',
    '[{"sourcePath":"notificationType","targetPath":"notificationType","required":true},{"sourcePath":"admission.admissionDateTime","targetPath":"admissionDateTime","required":true},{"sourcePath":"patient.name.family","targetPath":"PatientLastName","required":true},{"sourcePath":"patient.name.given","targetPath":"PatientFirstName","required":false,"transform":"first"},{"sourcePath":"encounter.class","targetPath":"EncounterClass__c","required":true},{"sourcePath":"payer.payerType","targetPath":"PayerType__c","required":true},{"sourcePath":"correlationId","targetPath":"correlationId","required":true},{"sourcePath":"patient.memberId","targetPath":"MemberId__c","required":false},{"sourcePath":"patient.mrn","targetPath":"MRN__c","required":false},{"sourcePath":"patient.birthDate","targetPath":"DateOfBirth__c","required":false},{"sourcePath":"patient.gender","targetPath":"Gender__c","required":false},{"sourcePath":"patient.phone","targetPath":"Phone__c","required":false},{"sourcePath":"patient.address.line","targetPath":"AddressLine1__c","required":false,"transform":"first"},{"sourcePath":"patient.address.city","targetPath":"City__c","required":false},{"sourcePath":"patient.address.state","targetPath":"State__c","required":false},{"sourcePath":"patient.address.postalCode","targetPath":"PostalCode__c","required":false},{"sourcePath":"encounter.visitId","targetPath":"VisitId__c","required":false},{"sourcePath":"encounter.status","targetPath":"EncounterStatus__c","required":false},{"sourcePath":"encounter.locationDisplay","targetPath":"LocationName__c","required":false},{"sourcePath":"facility.name","targetPath":"FacilityName__c","required":false},{"sourcePath":"facility.npi","targetPath":"FacilityNPI__c","required":false},{"sourcePath":"payer.name","targetPath":"PayerName__c","required":false},{"sourcePath":"coverage.subscriberId","targetPath":"SubscriberId__c","required":false},{"sourcePath":"coverage.plan","targetPath":"Plan__c","required":false},{"sourcePath":"providers.0.npi","targetPath":"ProviderNPI__c","required":false},{"sourcePath":"providers.0.name.family","targetPath":"ProviderLastName__c","required":false},{"sourcePath":"providers.0.name.given","targetPath":"ProviderFirstName__c","required":false,"transform":"first"}]'::jsonb
  ),
  (
    '33333333-3333-4333-8333-333333333003',
    '33333333-3333-4333-8333-333333333030',
    1,
    'AdmissionEvent',
    'JSON',
    '[{"sourcePath":"notificationType","targetPath":"notificationType","required":true},{"sourcePath":"admission.admissionDateTime","targetPath":"AdmissionDateTime","required":true},{"sourcePath":"admission.admissionDateTime","targetPath":"CheckInDateTime","required":false},{"sourcePath":"patient.name.family","targetPath":"MemberLastName","required":true},{"sourcePath":"patient.name.given","targetPath":"MemberFirstName","required":false,"transform":"first"},{"sourcePath":"encounter.class","targetPath":"EncounterClass","required":true},{"sourcePath":"payer.payerType","targetPath":"PayerType","required":true},{"sourcePath":"correlationId","targetPath":"correlationId","required":true},{"sourcePath":"patient.memberId","targetPath":"MemberID","required":false},{"sourcePath":"patient.mrn","targetPath":"MRN","required":false},{"sourcePath":"patient.birthDate","targetPath":"DateOfBirth","required":false},{"sourcePath":"patient.gender","targetPath":"Gender","required":false},{"sourcePath":"patient.phone","targetPath":"PhoneNumber","required":false},{"sourcePath":"patient.address.line","targetPath":"AddressLine1","required":false,"transform":"first"},{"sourcePath":"patient.address.city","targetPath":"City","required":false},{"sourcePath":"patient.address.state","targetPath":"State","required":false},{"sourcePath":"patient.address.postalCode","targetPath":"PostalCode","required":false},{"sourcePath":"encounter.visitId","targetPath":"VisitID","required":false},{"sourcePath":"encounter.status","targetPath":"EncounterStatus","required":false},{"sourcePath":"encounter.locationDisplay","targetPath":"EncounterLocationName","required":false},{"sourcePath":"facility.name","targetPath":"FacilityName","required":false},{"sourcePath":"facility.npi","targetPath":"FacilityNPI","required":false},{"sourcePath":"payer.name","targetPath":"PayerName","required":false},{"sourcePath":"coverage.subscriberId","targetPath":"SubscriberID","required":false},{"sourcePath":"coverage.status","targetPath":"CoverageStatus","required":false},{"sourcePath":"coverage.plan","targetPath":"Plan","required":false},{"sourcePath":"coverage.groupNumber","targetPath":"GroupNumber","required":false},{"sourcePath":"providers.0.npi","targetPath":"ProviderNPI","required":false},{"sourcePath":"providers.0.name.family","targetPath":"ProviderLastName","required":false},{"sourcePath":"providers.0.name.given","targetPath":"ProviderFirstName","required":false,"transform":"first"}]'::jsonb
  )
on conflict (id) do nothing;
