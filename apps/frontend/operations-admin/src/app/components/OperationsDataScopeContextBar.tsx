import {Alert} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import type {WorkspaceScopeContext, WorkspaceScopeNode} from '../api/generated/operations-edge';

export type RequiredDataNodeType = 'NONE' | 'REGION' | 'PROJECT' | 'HEAD_COMPANY' | 'STORE';

function currentLines(
  type: RequiredDataNodeType,
  context: WorkspaceScopeContext | null,
): Array<[string, WorkspaceScopeNode | null | undefined]> {
  if (type === 'REGION') return [['大区', context?.region]];
  if (type === 'PROJECT')
    return [
      ['大区', context?.region],
      ['项目', context?.project],
    ];
  if (type === 'STORE')
    return [
      ['大区', context?.region],
      ['项目', context?.project],
      ['门店', context?.store],
    ];
  if (type === 'HEAD_COMPANY') return [['总公司', context?.headCompany]];
  return [];
}

/** The app gate mirrors only owner-confirmed scope selections; it never decides authorization. */
export function isOperationsScopeComplete(type: RequiredDataNodeType, context: WorkspaceScopeContext | null) {
  if (type === 'NONE') return true;
  const lines = currentLines(type, context);
  return lines.length > 0 && lines.every(([, node]) => Boolean(node));
}

function missingPrompt(type: RequiredDataNodeType) {
  if (type === 'PROJECT') return '请在左下角选择要管理的项目。';
  if (type === 'STORE') return '请在左下角选择要管理的门店。';
  if (type === 'HEAD_COMPANY') return '请在左下角选择要管理的总公司。';
  return '请在左下角选择要管理的大区。';
}

/**
 * Shared scope gate for pages with an owner-confirmed data-node requirement.
 * The shell's left-bottom selector is the sole persistent scope display; a page
 * only explains how to complete a missing selection and never repeats it once ready.
 */
export function OperationsDataScopeContextBar({
  requiredDataNodeType,
  scopeContext,
}: {
  requiredDataNodeType: RequiredDataNodeType;
  scopeContext: WorkspaceScopeContext | null;
}) {
  const context = scopeContext;
  if (requiredDataNodeType === 'NONE') return null;
  const complete = isOperationsScopeComplete(requiredDataNodeType, context);
  if (!complete)
    return (
      <Alert
        type="info"
        showIcon
        title={missingPrompt(requiredDataNodeType)}
        style={{marginBottom: 12}}
        {...testId('operations-page-data-scope-missing')}
      />
    );
  return null;
}
