import type {AuditChange} from '../../../app/api/generated/platform-edge';

const fieldLabels: Record<string, string> = {
  groupWorkspaceKey: '集团空间编码',
  name: '名称',
  displayName: '显示名称',
  status: '状态',
  notes: '备注',
  description: '说明',
  logo: 'Logo',
  pageAccessKeys: '可使用的功能菜单',
  capabilityKeys: '可执行的操作',
  serviceNodeAssignment: '任职',
  fieldDefinitions: '字段定义',
  revision: '版本',
  contractNo: '合同编号',
  effectiveFrom: '生效日期',
  effectiveTo: '失效日期',
  itemCodes: '货号',
  note: '备注',
  operationsTitle: '运营管理后台标题名称',
  commercialGroupCode: '集团编码',
  commercialGroupName: '集团名称',
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
