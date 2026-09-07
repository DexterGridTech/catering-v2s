import {Button, Dropdown, type MenuProps} from 'antd';
import type {ReactNode, Ref} from 'react';
import {testId} from '../automation/testId';

export type AdminDetailActionMenuProps = {
  items: NonNullable<MenuProps['items']>;
  triggerTestId: string;
  disabled?: boolean;
  loading?: boolean;
  triggerRef?: Ref<HTMLButtonElement>;
};

/**
 * Shared presentation for actions in an existing object-detail Drawer.
 * Business apps own item conditions, labels, callbacks, confirmation, and
 * failure handling; the foundation only owns the single trigger and popup.
 */
export function AdminDetailActionMenu({items, triggerTestId, disabled, loading, triggerRef}: AdminDetailActionMenuProps) {
  return (
    <Dropdown menu={{items}} trigger={['click']}>
      <Button
        ref={triggerRef}
        aria-label="操作"
        disabled={disabled}
        loading={loading}
        {...testId(triggerTestId)}
      >
        操作
      </Button>
    </Dropdown>
  );
}

export type AdminDetailActionLabelProps = {
  children: ReactNode;
  testIdValue: string;
};

/**
 * Ant Design's Menu API renders the item label as the actionable anchor. This
 * helper keeps the app-owned test id on that anchor instead of a surrounding
 * menu wrapper when an item needs a stable locator.
 */
export function AdminDetailActionLabel({children, testIdValue}: AdminDetailActionLabelProps) {
  return <span {...testId(testIdValue)}>{children}</span>;
}
