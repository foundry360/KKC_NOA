import { createSeedTransformations } from "../src/infrastructure/seed/transformations";
import fs from "node:fs";

const transforms = createSeedTransformations();
const [mockT, sfT, pegaT] = transforms;
const mock = JSON.stringify(mockT!.mappings);
const sf = JSON.stringify(sfT!.mappings);
const pega = JSON.stringify(pegaT!.mappings);

const path = "supabase/seed/002_contracts_transforms.sql";
let content = fs.readFileSync(path, "utf8");

function replaceMappings(sql: string, id: string, json: string): string {
  const escaped = json.replace(/'/g, "''");
  const re = new RegExp(
    `('${id}',[\\s\\S]*?'JSON',\\s*)'\\[.*?\\]'::jsonb`,
    "m"
  );
  if (!re.test(sql)) {
    throw new Error(`Could not find mappings for ${id}`);
  }
  return sql.replace(re, `$1'${escaped}'::jsonb`);
}

content = replaceMappings(content, "33333333-3333-4333-8333-333333333001", mock);
content = replaceMappings(content, "33333333-3333-4333-8333-333333333002", sf);
content = replaceMappings(content, "33333333-3333-4333-8333-333333333003", pega);
fs.writeFileSync(path, content);

const esc = (j: string) => j.replace(/'/g, "''");
const mig = `-- Refresh NOA admission-alert transform mappings.
-- Source of truth: src/infrastructure/seed/transformations.ts (also upserted on boot).

update transformation_versions
set mappings = '${esc(mock)}'::jsonb
where id = '33333333-3333-4333-8333-333333333001';

update transformation_versions
set mappings = '${esc(sf)}'::jsonb
where id = '33333333-3333-4333-8333-333333333002';

update transformation_versions
set mappings = '${esc(pega)}'::jsonb
where id = '33333333-3333-4333-8333-333333333003';
`;
fs.writeFileSync(
  "supabase/migrations/20260910000004_noa_admission_field_mappings.sql",
  mig
);
console.log("updated seed + migration");
