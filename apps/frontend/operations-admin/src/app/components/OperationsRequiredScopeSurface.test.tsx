import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {adminCatalog} from '../catalog/generatedAdminCatalog';
import {OperationsRequiredScopeSurface} from './OperationsRequiredScopeSurface';
import {isOperationsScopeComplete} from './OperationsDataScopeContextBar';
import type {WorkspaceScopeContext, WorkspaceScopeNode} from '../api/generated/operations-edge';
import {wireUuid} from '../api/wireUuid';

const node = (dataNodeName: string, dataNodeRef: string): WorkspaceScopeNode => ({
  dataNodeRef: wireUuid(dataNodeRef),
  dataNodeName,
  dataNodeCode: dataNodeName,
  dataNodeType: 'REGION',
  ancestorPath: [],
});
type ScopeContext = WorkspaceScopeContext;
const completeContext: ScopeContext = {
  region: node('region', '00000000-0000-4000-8000-000000000011'),
  project: node('project', '00000000-0000-4000-8000-000000000012'),
  store: node('store', '00000000-0000-4000-8000-000000000013'),
  headCompany: node('head-company', '00000000-0000-4000-8000-000000000014'),
};

describe('operations required scope surface', () => {
  it('recognizes each catalog-required hierarchy only when every required owner-confirmed selection is present', () => {
    expect(isOperationsScopeComplete('NONE', null)).toBe(true);
    expect(isOperationsScopeComplete('REGION', completeContext)).toBe(true);
    expect(isOperationsScopeComplete('PROJECT', completeContext)).toBe(true);
    expect(isOperationsScopeComplete('STORE', completeContext)).toBe(true);
    expect(isOperationsScopeComplete('HEAD_COMPANY', completeContext)).toBe(true);
    expect(isOperationsScopeComplete('PROJECT', {...completeContext, project: null})).toBe(false);
    expect(isOperationsScopeComplete('STORE', {...completeContext, store: null})).toBe(false);
    expect(isOperationsScopeComplete('HEAD_COMPANY', {...completeContext, headCompany: null})).toBe(false);
  });

  it('only shows the left-bottom selection instruction until the owner-confirmed scope is complete', () => {
    const gated = renderToStaticMarkup(
      <OperationsRequiredScopeSurface requiredDataNodeType="PROJECT" scopeContext={{...completeContext, project: null}}>
        <button data-testid="scoped-child">业务操作</button>
      </OperationsRequiredScopeSurface>,
    );
    expect(gated).toContain('operations-page-data-scope-gated');
    expect(gated).toContain('请在左下角选择要管理的项目。');
    expect(gated).not.toContain('scoped-child');
    const ready = renderToStaticMarkup(
      <OperationsRequiredScopeSurface requiredDataNodeType="PROJECT" scopeContext={completeContext}>
        <button data-testid="scoped-child">业务操作</button>
      </OperationsRequiredScopeSurface>,
    );
    expect(ready).toContain('scoped-child');
    expect(ready).not.toContain('operations-page-data-scope-gated');
    expect(ready).not.toContain('operations-page-data-scope-current');
    expect(ready).not.toContain('当前项目');
  });

  it('covers the catalog denominator and keeps NONE pages mountable without a selection', () => {
    const scoped = adminCatalog.operationsPages
      .filter(page => page.requiredDataNodeType !== 'NONE')
      .map(page => `${page.pageDesignKey}:${page.requiredDataNodeType}`);
    expect(scoped).toEqual([
      'PG-ORG-STORE-MANAGE:PROJECT',
      'PG-CONTRACT-STORE-MANAGE:PROJECT',
      'PG-IAM-REGION-USERS:REGION',
      'PG-IAM-PROJECT-USERS:PROJECT',
      'PG-IAM-HEAD-COMPANY-USERS:HEAD_COMPANY',
      'PG-IAM-STORE-USERS:STORE',
      'PG-STORE-PROFILE:STORE',
      'PG-BUSINESS-CHANNEL-PROJECT:PROJECT',
      'PG-BUSINESS-CHANNEL-STORE:STORE',
      'PG-CATALOG-STORE-ITEMS:STORE',
      'PG-INVENTORY-STORE-STATUS:STORE',
      'PG-CATALOG-BRAND-ITEMS:HEAD_COMPANY',
      'PG-SALES-MENU-STORE:STORE',
    ]);
    expect(
      renderToStaticMarkup(
        <OperationsRequiredScopeSurface requiredDataNodeType="NONE" scopeContext={null}>
          <button data-testid="none-child">无范围页面</button>
        </OperationsRequiredScopeSurface>,
      ),
    ).toContain('none-child');
  });
});
