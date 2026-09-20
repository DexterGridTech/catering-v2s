import {describe, expect, it} from 'vitest';
import {
  clearInvalidExtensionFilterFields,
  extensionSearchFieldProps,
  extensionSearchValueType,
  extensionFilterFormPath,
  isFlatExtensionHost,
  formatTypedExtensionValue,
  orderTypedExtensionFields,
  reconcileExtensionFilterValues,
  serializeExtensionFilters,
} from './typedExtension';

describe('typed extension foundation capability', () => {
  it('keeps flat list/search applicability in one closed foundation host set', () => {
    expect(isFlatExtensionHost('BRAND')).toBe(true);
    expect(isFlatExtensionHost('CONTRACT')).toBe(true);
    expect(isFlatExtensionHost('PROJECT')).toBe(false);
    expect(isFlatExtensionHost(undefined)).toBe(false);
  });

  it('orders authored fields by display order and stable field key', () => {
    expect(
      orderTypedExtensionFields([
        {key: 'zeta', displayOrder: 1},
        {key: 'beta', displayOrder: 0},
        {key: 'alpha', displayOrder: 1},
      ]),
    ).toEqual([
      {key: 'beta', displayOrder: 0},
      {key: 'alpha', displayOrder: 1},
      {key: 'zeta', displayOrder: 1},
    ]);
  });

  it('formats raw scalar values by declared type and preserves the empty state', () => {
    expect(formatTypedExtensionValue(undefined, {type: 'TEXT'})).toBe('—');
    expect(formatTypedExtensionValue(12.5, {type: 'NUMBER', displaySuffix: '㎡'})).toBe('12.5㎡');
    expect(formatTypedExtensionValue('2026-09-15', {type: 'DATE'})).toBe('2026-09-15');
    expect(formatTypedExtensionValue(true, {type: 'BOOLEAN'})).toBe('是');
    expect(formatTypedExtensionValue('false', {type: 'BOOLEAN'})).toBe('否');
    expect(formatTypedExtensionValue('直营', {type: 'SELECT'})).toBe('直营');
  });

  it('builds type-matched search controls without owning app test ids', () => {
    expect(extensionSearchValueType('NUMBER')).toBe('digit');
    expect(extensionSearchValueType('DATE')).toBe('date');
    expect(extensionSearchValueType('TEXT')).toBe('text');
    expect(extensionSearchValueType('BOOLEAN')).toBe('select');
    expect(
      extensionSearchFieldProps({type: 'SELECT', label: '来源', options: ['直营']}, {'data-testid': 'source'}),
    ).toEqual({
      'data-testid': 'source',
      allowClear: true,
      placeholder: '全部',
      options: [{value: '直营', label: '直营'}],
    });
    expect(extensionSearchFieldProps({type: 'NUMBER', label: '等级'})).toEqual({
      allowClear: true,
      placeholder: '请输入等级',
      controls: false,
    });
  });

  it('serializes only searchable typed drafts and omits empty filter parameters', () => {
    const fields = [
      {key: 'name', type: 'TEXT' as const, searchable: true},
      {key: 'amount', type: 'NUMBER' as const, searchable: true},
      {key: 'signedAt', type: 'DATE' as const, searchable: true},
      {key: 'active', type: 'BOOLEAN' as const, searchable: true},
      {key: 'mode', type: 'SELECT' as const, searchable: false},
    ];
    const result = serializeExtensionFilters(
      fields,
      {
        name: '  极光  ',
        amount: 12.5,
        signedAt: {format: (pattern: string) => (pattern === 'YYYY-MM-DD' ? '2026-09-15' : 'wrong')},
        active: false,
        mode: '直营',
      },
      4,
    );

    expect(JSON.parse(decodeURIComponent(result.extensionFilters ?? ''))).toEqual([
      {fieldKey: 'name', type: 'TEXT', value: '极光'},
      {fieldKey: 'amount', type: 'NUMBER', value: '12.5'},
      {fieldKey: 'signedAt', type: 'DATE', value: '2026-09-15'},
      {fieldKey: 'active', type: 'BOOLEAN', value: 'false'},
    ]);
    expect(result.definitionRevision).toBe(4);
    expect(serializeExtensionFilters(fields, {name: '', mode: '直营'}, 4)).toEqual({
      extensionFilters: undefined,
      definitionRevision: undefined,
    });
  });

  it('retains valid typed controls and clears only stale or invalid values', () => {
    const calls: Array<Record<string, unknown>> = [];
    const retained = reconcileExtensionFilterValues(
      {setFieldsValue: values => calls.push(values)},
      [
        {key: 'name', type: 'TEXT', searchable: true, status: 'ENABLED'},
        {key: 'amount', type: 'NUMBER', searchable: true, status: 'ENABLED'},
        {key: 'mode', type: 'SELECT', searchable: true, status: 'ENABLED', options: ['直营']},
        {key: 'status', type: 'TEXT', searchable: true, status: 'ENABLED'},
      ],
      [
        {key: 'name', type: 'TEXT', searchable: true, status: 'ENABLED'},
        {key: 'amount', type: 'DATE', searchable: true, status: 'ENABLED'},
        {key: 'mode', type: 'SELECT', searchable: true, status: 'ENABLED', options: ['加盟']},
        {key: 'status', type: 'TEXT', searchable: false, status: 'ENABLED'},
      ],
      {name: '  极光  ', amount: 12, mode: '直营', status: '启用', removed: '旧值'},
    );
    expect(retained).toEqual({name: '  极光  '});
    expect(extensionFilterFormPath('name')).toEqual(['extensionFilterValues', 'name']);
    expect(calls).toEqual([
      {
        extensionFilterValues: {
          amount: undefined,
          mode: undefined,
          status: undefined,
          removed: undefined,
          name: '  极光  ',
        },
      },
    ]);
  });

  it('accepts typed values that match the new definition', () => {
    expect(
      reconcileExtensionFilterValues(
        undefined,
        [
          {key: 'date', type: 'DATE', searchable: true, status: 'ENABLED'},
          {key: 'flag', type: 'BOOLEAN', searchable: true, status: 'ENABLED'},
          {key: 'count', type: 'NUMBER', searchable: true, status: 'ENABLED'},
        ],
        [
          {key: 'date', type: 'DATE', searchable: true, status: 'ENABLED'},
          {key: 'flag', type: 'BOOLEAN', searchable: true, status: 'ENABLED'},
          {key: 'count', type: 'NUMBER', searchable: true, status: 'ENABLED'},
        ],
        {
          date: '2026-02-28',
          flag: false,
          count: '12.5',
        },
      ),
    ).toEqual({date: '2026-02-28', flag: false, count: '12.5'});
  });

  it('clears only current definition-backed invalid extension controls', () => {
    const calls: Array<Record<string, unknown>> = [];
    clearInvalidExtensionFilterFields(
      {setFieldsValue: values => calls.push(values)},
      [{key: 'brandLevel'}, {key: 'status'}],
      [{fieldKey: 'brandLevel'}, {fieldKey: 'name'}, {fieldKey: 'brandLevel'}, {fieldKey: 'removedField'}],
    );
    expect(calls).toEqual([{extensionFilterValues: {brandLevel: undefined}}]);
  });
});
