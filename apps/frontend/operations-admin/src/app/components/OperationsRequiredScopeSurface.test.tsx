import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {renderToStaticMarkup} from 'react-dom/server';
import {adminCatalog} from '../catalog/generatedAdminCatalog';
import {OperationsRequiredScopeSurface} from './OperationsRequiredScopeSurface';
import {isOperationsScopeComplete} from './OperationsDataScopeContextBar';
import type {WorkspaceScopeContext, WorkspaceScopeNode} from '../api/generated/operations-edge';

const source = await readFile(new URL('./OperationsRequiredScopeSurface.tsx', import.meta.url), 'utf8');
const node = (dataNodeRef: string): WorkspaceScopeNode => ({dataNodeRef, dataNodeName: dataNodeRef, dataNodeCode: dataNodeRef, dataNodeType: 'REGION', ancestorPath: []});
type ScopeContext = WorkspaceScopeContext;
const completeContext: ScopeContext = {region: node('region'), project: node('project'), store: node('store'), headCompany: node('head-company')};

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

  it('mounts a child only after the owner-confirmed scope supplied by the current entry is complete', () => {
    const gated = renderToStaticMarkup(<OperationsRequiredScopeSurface requiredDataNodeType="PROJECT" scopeContext={{...completeContext, project: null}}><button data-testid="scoped-child">业务操作</button></OperationsRequiredScopeSurface>);
    expect(gated).toContain('operations-page-data-scope-gated');
    expect(gated).not.toContain('scoped-child');
    const ready = renderToStaticMarkup(<OperationsRequiredScopeSurface requiredDataNodeType="PROJECT" scopeContext={completeContext}><button data-testid="scoped-child">业务操作</button></OperationsRequiredScopeSurface>);
    expect(ready).toContain('scoped-child');
    expect(ready).not.toContain('operations-page-data-scope-gated');
  });

  it('covers the catalog denominator and keeps NONE pages mountable without a selection', () => {
    const scoped = adminCatalog.operationsPages.filter((page) => page.requiredDataNodeType !== 'NONE').map((page) => `${page.pageDesignKey}:${page.requiredDataNodeType}`);
    expect(scoped).toEqual([
      'PG-ORG-STORE-MANAGE:PROJECT',
      'PG-CONTRACT-STORE-MANAGE:PROJECT',
      'PG-IAM-REGION-USERS:REGION',
      'PG-IAM-PROJECT-USERS:PROJECT',
      'PG-IAM-HEAD-COMPANY-USERS:HEAD_COMPANY',
      'PG-IAM-STORE-USERS:STORE',
      'PG-STORE-PROFILE:STORE',
      'PG-CATALOG-STORE-ITEMS:STORE',
      'PG-INVENTORY-STORE-STATUS:STORE',
      'PG-CATALOG-BRAND-ITEMS:HEAD_COMPANY',
    ]);
    expect(renderToStaticMarkup(<OperationsRequiredScopeSurface requiredDataNodeType="NONE" scopeContext={null}><button data-testid="none-child">无范围页面</button></OperationsRequiredScopeSurface>)).toContain('none-child');
  });

  it('keeps the selector recoverable by replacing incomplete scoped content with one non-interactive gray placeholder', () => {
    expect(source).toContain('<OperationsDataScopeContextBar requiredDataNodeType={requiredDataNodeType} scopeContext={scopeContext}/>');
    expect(source).toContain('complete ? children');
    expect(source).toContain("testId('operations-page-data-scope-gated')");
    expect(source).toContain('<Skeleton active={false}');
    expect(source).not.toContain('useShellInteractionLock');
    expect(source).not.toContain('useSelector');
  });
});
