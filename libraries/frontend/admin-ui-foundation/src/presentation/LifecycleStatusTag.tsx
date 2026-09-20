import {Tag} from 'antd';
import {lifecycleColor, lifecycleLabel} from './lifecycleLabels';

export function LifecycleStatusTag({status}: {status?: string | null}) {
  return <Tag color={lifecycleColor(status ?? '')}>{lifecycleLabel(status)}</Tag>;
}
