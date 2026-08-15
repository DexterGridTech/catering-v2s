import {joinFieldDescriptors, type DescriptorManifest, type FieldRule, type JoinedFieldDescriptor, type ShapeTabRule} from '@catering-v2s/admin-ui-foundation';
import type {CatalogShapeManifestView} from '../../../app/api/generated/catalog-inventory-edge';

export type CatalogDescriptorManifest = Pick<CatalogShapeManifestView, 'fields' | 'fieldRules' | 'tabRules'>;

export function toCatalogDescriptorManifest(manifest: CatalogDescriptorManifest): DescriptorManifest {
  return {
    fields: manifest.fields,
    fieldRules: Object.fromEntries(Object.entries(manifest.fieldRules).map(([shapeKey, value]) => [shapeKey, readFieldRules(value)])),
    tabRules: Object.fromEntries(Object.entries(manifest.tabRules).map(([shapeKey, value]) => [shapeKey, readTabRule(value)])),
  };
}

export function catalogJoinedField(manifest: CatalogDescriptorManifest | undefined, shapeKey: string, fieldKey: string): JoinedFieldDescriptor | undefined {
  if (!manifest) return undefined;
  const fields = joinFieldDescriptors(toCatalogDescriptorManifest(manifest), shapeKey, 'update');
  return fields.find((field) => field.fieldKey === fieldKey);
}

function readFieldRules(value: unknown): FieldRule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const rule = entry as Record<string, unknown>;
    return typeof rule.field === 'string' ? [rule as FieldRule] : [];
  });
}

function readTabRule(value: unknown): ShapeTabRule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const visible = Array.isArray(record.visible) ? record.visible.filter((entry): entry is string => typeof entry === 'string') : undefined;
  return visible ? {...record, visible} as ShapeTabRule : {...record} as ShapeTabRule;
}
