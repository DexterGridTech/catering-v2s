import {
  adminGeometry,
  PrimitiveBadge,
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveGrid,
  PrimitiveHeading,
  PrimitiveIconBadge,
} from '@catering-v2s/ui-base-primitives';
import {adminFrameTestId, panelFrameId} from '../foundations/adminFrameRegistry';
import {adminTestIds} from '../foundations/adminTestIds';
import type {AdminShellFrameProps} from './AdminShellFrame';

/** Laptop-only full-canvas frame: fixed header followed by a side-by-side workspace. */
export const AdminShellFrameLaptop = ({onClose, status, frameId, children}: AdminShellFrameProps) => (
  <PrimitiveContainer
    testID={adminTestIds.shell}
    layout="fill"
    appearance="admin-root"
    style={{flex: 1, width: '100%', minWidth: 0, ...adminGeometry.rootLaptop}}
  >
    <PrimitiveContainer
      testID={adminFrameTestId(frameId ?? panelFrameId('laptop', 'normal'))}
      layout="card"
      appearance="admin-shell"
      style={{...adminGeometry.shellLaptop, maxHeight: '100%', overflow: 'hidden'}}
    >
      <PrimitiveContainer
        testID={adminTestIds.panel.frame}
        layout="transparent"
        appearance="admin-content"
        style={{flex: 1, minHeight: 0, minWidth: 0}}
      >
        <PrimitiveGrid testID={adminTestIds.panel.header} appearance="admin-header" style={adminGeometry.headerLaptop}>
          <PrimitiveIconBadge testID={adminTestIds.panel.brand} accessibilityLabel="终端管理" icon="admin" />
          <PrimitiveHeading appearance="admin-shell" testID="terminal.admin:shell:title">
            终端管理
          </PrimitiveHeading>
          <PrimitiveBadge appearance="admin-status" testID={adminTestIds.panel.status} tone={status.tone}>
            {status.label}
          </PrimitiveBadge>
          <PrimitiveButton
            testID={adminTestIds.close}
            accessibilityLabel="关闭终端管理"
            appearance="admin-icon"
            icon="close"
            onPress={onClose}
            style={{marginLeft: 'auto'}}
          >
            关闭
          </PrimitiveButton>
        </PrimitiveGrid>
        <PrimitiveContainer
          testID={adminTestIds.panel.body}
          layout="transparent"
          appearance="admin-content"
          style={{flex: 1, minHeight: 0, minWidth: 0}}
        >
          {children}
        </PrimitiveContainer>
      </PrimitiveContainer>
    </PrimitiveContainer>
  </PrimitiveContainer>
);
