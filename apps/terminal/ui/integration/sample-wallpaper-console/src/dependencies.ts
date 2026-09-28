import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';
import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as topology} from '@catering-v2s/kernel-base-topology';
import {moduleName as transport} from '@catering-v2s/kernel-base-transport';
import {moduleName as displayContext} from '@catering-v2s/kernel-base-display-context';
import {moduleName as uiState} from '@catering-v2s/kernel-base-ui-state';
import {moduleName as staffSession} from '@catering-v2s/kernel-feature-sample-staff-session';
import {moduleName as wallpaper} from '@catering-v2s/kernel-feature-sample-wallpaper';
import {moduleName as adminShell} from '@catering-v2s/ui-base-admin-shell';
import {moduleName as render} from '@catering-v2s/ui-base-render';
import {moduleName as input} from '@catering-v2s/ui-base-input';
import {moduleName as primitives} from '@catering-v2s/ui-base-primitives';
import {moduleName as staffAuth} from '@catering-v2s/ui-feature-sample-staff-auth';
import {moduleName as wallpaperPicker} from '@catering-v2s/ui-feature-sample-wallpaper-picker';
import {moduleName as devHost} from '@catering-v2s/ui-base-dev-host';
import {moduleName as integrationAssembly} from '@catering-v2s/ui-base-integration-assembly';

export const dependencyModuleNames = [
  contracts,
  platformPorts,
  runtime,
  topology,
  transport,
  displayContext,
  uiState,
  staffSession,
  wallpaper,
  adminShell,
  render,
  input,
  primitives,
  staffAuth,
  wallpaperPicker,
  integrationAssembly,
] as const;

export const devDependencyModuleNames = [devHost] as const;

export const runtimeModuleDependencyNames = [
  runtime,
  topology,
  transport,
  displayContext,
  uiState,
  staffSession,
  wallpaper,
  staffAuth,
  wallpaperPicker,
] as const;
