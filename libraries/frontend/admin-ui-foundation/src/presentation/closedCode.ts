/**
 * Reads a label from a generated closed-code dictionary without ever exposing
 * an unknown wire value as blank text.  The caller remains responsible for
 * disabling actions whose decision depends on that value.
 */
export function closedCodeLabel(
  labels: Readonly<Record<string, string>>,
  value: unknown,
  unknownLabel = '当前状态无法识别',
): string {
  return typeof value === 'string' && Object.hasOwn(labels, value) ? labels[value] : unknownLabel;
}

/** Runtime guard for values crossing the generated TypeScript boundary. */
export function isKnownClosedCode(labels: Readonly<Record<string, string>>, value: unknown): value is string {
  return typeof value === 'string' && Object.hasOwn(labels, value);
}
