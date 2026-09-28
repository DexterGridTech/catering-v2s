import type {RuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {WorkspaceKey} from '@catering-v2s/kernel-base-state';
import type {SurfaceForm} from '@catering-v2s/kernel-base-contracts';

export type DisplayRole = 'CHIEF' | 'VICE';
export type DisplayMode = 'PRIMARY' | 'SECONDARY';

export type DisplayRoleChangeReasonCode =
  'allowed' | 'master-instance' | 'managed-secondary' | 'missing-display-route' | 'multiple-physical-displays';

export type DisplayContextEligibility =
  | Readonly<{allowed: true; reasonCode: 'allowed'}>
  | Readonly<{
      allowed: false;
      reasonCode: Exclude<DisplayRoleChangeReasonCode, 'allowed'>;
    }>;

export type DisplayRoleState = Readonly<{
  displayRole: DisplayRole;
  powerConfirmation: PendingPowerConfirmation | null;
}>;

export type PendingPowerConfirmation = Readonly<{
  readonly powerSource: PowerSource;
  readonly targetRole: DisplayRole;
  readonly requestedSurfaceForm: SurfaceForm;
  readonly requestedInstanceMode: RuntimeInstanceMode;
  readonly requestedDisplayRole: DisplayRole;
  readonly requestedDisplayCount: number;
}>;

export type SurfaceDisplayModeInput = Readonly<{
  displayIndex: 0 | 1;
  displayRole: DisplayRole;
  instanceMode: RuntimeInstanceMode;
}>;

export type WorkspaceInput = Readonly<{
  instanceMode: RuntimeInstanceMode;
  displayRole: DisplayRole;
}>;

export type DisplayRoleChangeEligibilityInput = Readonly<{
  currentRole: DisplayRole;
  targetRole: DisplayRole;
  instanceMode: RuntimeInstanceMode;
  routeDisplayMode?: DisplayMode | null;
  displayCount: number;
}>;

export type SwitchInstanceModeEligibilityInput = Readonly<{
  targetMode: RuntimeInstanceMode;
  routeDisplayMode?: DisplayMode | null;
  displayCount: number;
}>;

export type PowerSource = 'external' | 'battery' | 'unknown';

export const isPowerSource = (value: unknown): value is PowerSource =>
  value === 'external' || value === 'battery' || value === 'unknown';

export type PowerRoleTargetInput = Readonly<{
  powerSource: PowerSource;
  instanceMode: RuntimeInstanceMode;
  displayRole: DisplayRole;
  displayCount: number;
}>;

export type DisplayWorkspace = WorkspaceKey;

export const isDisplayRole = (value: unknown): value is DisplayRole => value === 'CHIEF' || value === 'VICE';
