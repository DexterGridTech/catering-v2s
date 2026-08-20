import {Badge, Typography} from 'antd';

/**
 * Shared presentation for contract validity facts.
 *
 * This intentionally covers only VALID/INVALID contract state. Other status
 * machines (for example ENABLED/DISABLED, ACTIVE, or channel DRAFT/EFFECTIVE)
 * must keep their own domain-specific presentation.
 */
export function ValidityStatus({status}: {status?: string | null}) {
  if (status === 'VALID') return <Badge status="processing" text="有效" />;
  if (status === 'INVALID') return <Badge status="default" text="已失效" />;
  return <Typography.Text type="secondary">—</Typography.Text>;
}
