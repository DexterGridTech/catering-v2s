export type WireUuid = string & {readonly __uuid: 'Uuid'};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Validates an untyped value at the generated-wire boundary; drafts must not use this helper. */
export function wireUuid(value: string | null | undefined): WireUuid {
  const candidate = value?.trim() ?? '';
  if (!UUID.test(candidate)) throw new Error('WIRE_UUID_REQUIRED');
  return candidate as WireUuid;
}
