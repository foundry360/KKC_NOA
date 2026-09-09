-- Foundation seed placeholder.
-- Full golden-path seed (rules, contracts, destinations, transforms) lands in later cascade steps.

insert into source_systems (code, name, active)
values ('SYNTHETIC_EHR', 'Synthetic EHR (POC)', true)
on conflict (code) do nothing;
