export function resolveApiBase(override?: string): string {
  if (override) return override;
  if (typeof globalThis !== 'undefined' && (globalThis as any).location?.origin) {
    return (globalThis as any).location.origin;
  }
  return '';
}
