import {AdminShellMobile} from './AdminShellMobile'
import type {AdminShellProps} from '../types/adminShell'

/** Historical public shell entry; the mobile-compatible selection policy remains the default. */
export const AdminShell = (props: AdminShellProps) => <AdminShellMobile {...props} />

export type {AdminShellProps} from '../types/adminShell'
