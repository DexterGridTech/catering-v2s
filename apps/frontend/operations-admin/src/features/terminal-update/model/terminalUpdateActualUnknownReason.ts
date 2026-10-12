export const terminalUpdateActualUnknownReasonLabel = (value: unknown): string | null => {
  switch (value) {
    case 'READBACK_UNAVAILABLE':
      return '无法读取设备实际版本';
    case 'NOT_INSTALLED':
      return '设备未安装此应用';
    case 'MISMATCH':
      return '读取到的应用身份不匹配';
    case 'OTHER':
      return '设备实际版本无法确认';
    default:
      return null;
  }
};
