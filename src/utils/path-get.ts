/**
 * Lightweight path getter for rule conditions (e.g. "payer.payerType").
 * Supports dot paths into plain objects/arrays; no prototype pollution.
 */
export function getByPath(source: unknown, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split(".").filter(Boolean);
  let current: unknown = source;
  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
