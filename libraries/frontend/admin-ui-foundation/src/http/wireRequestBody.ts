/**
 * Shared generated-client body boundary. JSON commands declare their media
 * type here; multipart stays headerless so the browser supplies its boundary.
 */
export function serializeJsonOrMultipartBody(value: unknown, headers: Headers): BodyInit | undefined {
  if (value === undefined) return undefined;
  if (!isMultipartBody(value)) {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return JSON.stringify(value);
  }
  const form = new FormData();
  for (const [name, field] of Object.entries(value)) {
    if (field === undefined || field === null) continue;
    form.append(name, field instanceof Blob ? field : String(field));
  }
  return form;
}

function isMultipartBody(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.values(value).some(field => field instanceof Blob);
}
