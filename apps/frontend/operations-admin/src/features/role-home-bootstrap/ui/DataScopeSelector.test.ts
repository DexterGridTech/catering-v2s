import {describe, expect, it} from 'vitest';
import type {WorkspaceScopeContext, WorkspaceScopeNode} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {scopeTriggerLinesFor} from './DataScopeSelector';

const node = (dataNodeType: WorkspaceScopeNode['dataNodeType'], dataNodeName: string): WorkspaceScopeNode => ({
  dataNodeType,
  dataNodeRef: wireUuid(
    dataNodeType === 'REGION'
      ? '00000000-0000-4000-8000-000000000011'
      : dataNodeType === 'PROJECT'
        ? '00000000-0000-4000-8000-000000000012'
        : '00000000-0000-4000-8000-000000000013',
  ),
  dataNodeName,
  dataNodeCode: dataNodeType,
  ancestorPath: [],
});

const context: WorkspaceScopeContext = {
  region: node('REGION', '华北大区'),
  project: node('PROJECT', '太原万象城'),
  store: node('STORE', '河畔茶里店'),
  headCompany: null,
};

describe('operations scope trigger rows', () => {
  it('keeps one row per scope level with stable hierarchy identity across page-label changes', () => {
    const firstPage = scopeTriggerLinesFor('STORE', context, ['大区', '项目', '门店']);
    const nextPage = scopeTriggerLinesFor('STORE', context, ['项目', '项目', '项目']);

    expect(firstPage.map(line => line.key)).toEqual(['REGION', 'PROJECT', 'STORE']);
    expect(nextPage.map(line => line.key)).toEqual(firstPage.map(line => line.key));
    expect(nextPage.map(line => line.label)).toEqual(['项目', '项目', '项目']);
    expect(new Set(nextPage.map(line => line.key)).size).toBe(3);
  });

  it('shows only the selected page hierarchy depth', () => {
    expect(scopeTriggerLinesFor('REGION', context, ['大区'])).toHaveLength(1);
    expect(scopeTriggerLinesFor('PROJECT', context, ['大区', '项目'])).toHaveLength(2);
    expect(scopeTriggerLinesFor('STORE', context, ['大区', '项目', '门店'])).toHaveLength(3);
    expect(scopeTriggerLinesFor('NONE', context, [])).toHaveLength(0);
  });
});
