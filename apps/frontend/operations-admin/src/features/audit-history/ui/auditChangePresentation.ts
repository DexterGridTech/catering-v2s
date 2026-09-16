import type {AuditChange} from '../../../app/api/generated/operations-edge';

const fieldLabels: Record<string, string> = {
  status: '状态',
  displayName: '显示名称',
  name: '名称',
  legalName: '法定名称',
  creditCode: '统一代码',
  alias: '别名',
  remark: '备注',
  notes: '说明',
  description: '说明',
  contractNo: '合同编号',
  effectiveFrom: '生效日期',
  effectiveTo: '失效日期',
  relationship: '关联关系',
  lifecycleEvent: '生命周期事件',
  serviceNodeAssignment: '任职',
  pageAccessKeys: '可使用的功能菜单',
  capabilityKeys: '可执行的操作',
  phaseName: '项目分期',
  items: '货号',
};

export function auditFieldLabel(change: AuditChange) {
  const snapshot = change.fieldLabelSnapshot?.trim();
  return snapshot || fieldLabels[change.fieldKey] || `字段（${change.fieldKey}）`;
}

export function auditValue(change: AuditChange, side: 'before' | 'after') {
  const state = side === 'before' ? change.beforeState : change.afterState;
  const value = side === 'before' ? change.beforeValue : change.afterValue;
  if (!state) return value == null ? '历史记录未区分空值状态' : value;
  switch (state) {
    case 'MISSING':
      return '未填写';
    case 'NULL':
      return '空值';
    case 'CLEARED':
      return '已清空';
    case 'VALUE':
      return value == null ? '历史记录未区分空值状态' : value === '' ? '空字符串' : value;
  }
}
