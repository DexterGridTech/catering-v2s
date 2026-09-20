import {Button, Dropdown, type MenuProps} from 'antd';
import type {ReactNode, Ref} from 'react';
import {testId} from '../automation/testId';

export type AdminRowActionMenuProps = {
  items: NonNullable<MenuProps['items']>;
  triggerTestId: string;
  disabled?: boolean;
  loading?: boolean;
  triggerRef?: Ref<HTMLButtonElement>;
  icon?: ReactNode;
  ariaLabel?: string;
  onClick?: MenuProps['onClick'];
};

/** Shared row-end action surface. Feature code owns conditions, permissions and callbacks. */
export function AdminRowActionMenu({
  items,
  triggerTestId,
  disabled,
  loading,
  triggerRef,
  icon,
  ariaLabel = '操作',
  onClick,
}: AdminRowActionMenuProps) {
  return (
    <Dropdown menu={{items, onClick}} trigger={['click']}>
      <Button
        ref={triggerRef}
        type="text"
        icon={icon}
        aria-label={ariaLabel}
        disabled={disabled}
        loading={loading}
        {...testId(triggerTestId)}
      >
        {!icon && '操作'}
      </Button>
    </Dropdown>
  );
}
