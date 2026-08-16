import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {
  assertDescriptorSlotBindingSet,
  DESCRIPTOR_CONTROL_KINDS,
  DescriptorFieldRenderer,
  joinFieldDescriptors,
  type DescriptorFieldSlot,
  type DescriptorManifest,
} from './descriptorRenderer';

const manifest: DescriptorManifest = {
  fields: DESCRIPTOR_CONTROL_KINDS.map((controlKind, index) => ({
    fieldKey: `field-${index}`,
    dataPath: `field-${index}`,
    label: `字段 ${index}`,
    controlKind,
    tabKey: 'basic',
    admittedShapes: ['SHAPE'],
    helpText: `说明 ${index}`,
  })),
  fieldRules: {
    SHAPE: DESCRIPTOR_CONTROL_KINDS.map((_, index) => ({
      field: `field-${index}`,
      visible: true,
      readonlyWhen: {view: index === 0},
    })),
  },
  tabRules: {SHAPE: {visible: ['basic']}},
};

describe('descriptor renderer', () => {
  it('joins only the current shape descriptors once and preserves rule order', () => {
    const fields = joinFieldDescriptors(manifest, 'SHAPE', 'view');
    expect(fields.map(field => field.controlKind)).toEqual([...DESCRIPTOR_CONTROL_KINDS]);
    expect(fields[0].readonly).toBe(true);
    expect(fields[1].readonly).toBe(false);
  });

  it('renders every closed kind and sends domain kinds through static slots', () => {
    const slots = Object.fromEntries(
      ['skuVariantMatrix', 'inventoryBomWorkbench', 'orderOptionsWorkbench', 'compositeContentWorkbench'].map(kind => [
        kind,
        () => `slot:${kind}`,
      ]),
    );
    const fields = joinFieldDescriptors(manifest, 'SHAPE', 'update');
    expect(() =>
      assertDescriptorSlotBindingSet(
        fields,
        slots as Partial<
          Record<
            'skuVariantMatrix' | 'inventoryBomWorkbench' | 'orderOptionsWorkbench' | 'compositeContentWorkbench',
            DescriptorFieldSlot
          >
        >,
      ),
    ).not.toThrow();
    for (const field of fields) {
      const markup = renderToStaticMarkup(
        <DescriptorFieldRenderer
          field={field}
          value={field.controlKind === 'multiSelect' ? [] : ''}
          options={[{value: 'A', label: '选项 A'}]}
          slots={slots}
        />,
      );
      expect(markup).toContain(`data-field-key="${field.fieldKey}"`);
      expect(markup).toContain(`data-control-kind="${field.controlKind}"`);
    }
  });

  it('fails the slot-set gate when a domain control is not injected', () => {
    const fields = joinFieldDescriptors(manifest, 'SHAPE', 'update');
    const slots = {
      skuVariantMatrix: () => 'matrix',
      inventoryBomWorkbench: () => 'bom',
      orderOptionsWorkbench: () => 'options',
    };
    expect(() => assertDescriptorSlotBindingSet(fields, slots)).toThrow('DESCRIPTOR_SLOT_BINDING_SET_MISMATCH');
  });

  it('fails closed with a visible warning when a domain slot is missing', () => {
    const field = joinFieldDescriptors(manifest, 'SHAPE', 'update').find(
      entry => entry.controlKind === 'skuVariantMatrix',
    );
    expect(field).toBeDefined();
    const markup = renderToStaticMarkup(<DescriptorFieldRenderer field={field!} />);
    expect(markup).toContain('未注入领域控件');
  });
});
