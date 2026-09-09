/** Minimal FHIR R4 shapes used at the edge. Not a full FHIR model. */

export interface FhirResource {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
}

export interface FhirBundle {
  resourceType: "Bundle";
  id?: string;
  type?: string;
  timestamp?: string;
  entry?: Array<{
    fullUrl?: string;
    resource?: FhirResource;
  }>;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asBundle(value: unknown): FhirBundle | null {
  if (!isObject(value)) return null;
  if (value.resourceType !== "Bundle") return null;
  return value as unknown as FhirBundle;
}

export function extractResources(bundle: FhirBundle): FhirResource[] {
  return (bundle.entry ?? [])
    .map((e) => e.resource)
    .filter((r): r is FhirResource => Boolean(r && r.resourceType));
}

export function findResources(
  resources: FhirResource[],
  resourceType: string
): FhirResource[] {
  return resources.filter((r) => r.resourceType === resourceType);
}

export function findResource(
  resources: FhirResource[],
  resourceType: string
): FhirResource | undefined {
  return findResources(resources, resourceType)[0];
}

export function resolveReference(
  resources: FhirResource[],
  reference?: string
): FhirResource | undefined {
  if (!reference) return undefined;
  const [type, id] = reference.split("/");
  if (!type || !id) {
    // urn:uuid:xxx
    return resources.find((r) => r.id && reference.endsWith(r.id));
  }
  return resources.find((r) => r.resourceType === type && r.id === id);
}

export function getNestedString(
  obj: Record<string, unknown> | undefined,
  path: string[]
): string | undefined {
  let current: unknown = obj;
  for (const key of path) {
    if (!isObject(current)) return undefined;
    current = current[key];
  }
  return typeof current === "string" ? current : undefined;
}
