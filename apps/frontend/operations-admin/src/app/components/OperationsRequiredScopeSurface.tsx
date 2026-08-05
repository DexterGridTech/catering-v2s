import {Skeleton} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import type {ReactNode} from 'react';
import {isOperationsScopeComplete, OperationsDataScopeContextBar, type RequiredDataNodeType} from './OperationsDataScopeContextBar';
import type {WorkspaceScopeContext} from '../api/generated/operations-edge';

/**
 * One app-owned lifecycle boundary for every catalog page that requires an
 * owner-confirmed scope. The selector remains outside this surface in the
 * shell, so a missing selection never prevents the user from completing it.
 */
export function OperationsRequiredScopeSurface({requiredDataNodeType, scopeContext, children}: {requiredDataNodeType: RequiredDataNodeType; scopeContext: WorkspaceScopeContext | null; children: ReactNode}) {
  const complete = isOperationsScopeComplete(requiredDataNodeType, scopeContext);
  return <>
    <OperationsDataScopeContextBar requiredDataNodeType={requiredDataNodeType} scopeContext={scopeContext}/>
    {complete ? children : <div className="operations-required-scope-placeholder" aria-disabled="true" {...testId('operations-page-data-scope-gated')}>
      <Skeleton active={false} title={{width: '28%'}} paragraph={{rows: 6}}/>
    </div>}
  </>;
}
