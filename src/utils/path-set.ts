/**
 * Sets a nested value by dot path, creating plain objects as needed.
 */
export function setByPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return;

  let current: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    const next = current[key];
    if (next == null || typeof next !== "object" || Array.isArray(next)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}
