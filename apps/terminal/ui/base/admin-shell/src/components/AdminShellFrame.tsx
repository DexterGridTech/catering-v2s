import type {ReactNode} from 'react'
import {PrimitiveButton, PrimitiveContainer, PrimitiveGrid, PrimitiveHeading} from '@catering-v2s/ui-base-primitives'
import {adminTestIds} from '../foundations/adminTestIds'
import type {AdminShellProps} from '../types/adminShell'

export type AdminShellFrameProps = AdminShellProps & Readonly<{
  readonly children: ReactNode
}>

const rootStyle = Object.freeze({flex: 1, width: '100%' as const, minWidth: 0})
const headerStyle = Object.freeze({flexWrap: 'nowrap' as const, alignItems: 'center' as const})

/** Shared full-canvas frame; form-specific components own their internal layout. */
export const AdminShellFrame = ({onClose, children}: AdminShellFrameProps) => (
  <PrimitiveContainer testID={adminTestIds.shell} layout="fill" style={rootStyle}>
    <PrimitiveGrid testID="terminal.admin:header" style={headerStyle}>
      <PrimitiveHeading testID="terminal.admin:shell:title">终端管理</PrimitiveHeading>
      <PrimitiveButton
        testID={adminTestIds.close}
        accessibilityLabel="关闭终端管理"
        onPress={onClose}
        style={{marginLeft: 'auto'}}
      >
        关闭
      </PrimitiveButton>
    </PrimitiveGrid>
    {children}
  </PrimitiveContainer>
)
