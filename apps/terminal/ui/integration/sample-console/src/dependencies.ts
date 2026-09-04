import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts'
import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports'
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime'
import {moduleName as displayContext} from '@catering-v2s/kernel-base-display-context'
import {moduleName as uiState} from '@catering-v2s/kernel-base-ui-state'
import {moduleName as staffSession} from '@catering-v2s/kernel-feature-sample-staff-session'
import {moduleName as memberRegistry} from '@catering-v2s/kernel-feature-sample-member-registry'
import {moduleName as render} from '@catering-v2s/ui-base-render'
import {moduleName as staffAuth} from '@catering-v2s/ui-feature-sample-staff-auth'
import {moduleName as memberDesk} from '@catering-v2s/ui-feature-sample-member-desk'
import {moduleName as devHost} from '@catering-v2s/ui-base-dev-host'

export const dependencyModuleNames = [
  contracts,
  platformPorts,
  runtime,
  displayContext,
  uiState,
  staffSession,
  memberRegistry,
  render,
  staffAuth,
  memberDesk,
] as const;

export const devDependencyModuleNames = [devHost] as const
