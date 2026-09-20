export {moduleName} from './moduleName';
export {dependencyModuleNames, devDependencyModuleNames} from './dependencies';
export {
  ADMIN_CONSOLE_FOCUS_SCOPE_ID,
  ADMIN_CONSOLE_LAYER_ID,
  ADMIN_CONSOLE_PART_KEY,
  ADMIN_DISPLAY_CONTEXT_RAW_PART_KEY,
  ADMIN_PLATFORM_PORTS_PAGE_PART_KEY,
  ADMIN_RUNTIME_PAGE_PART_KEY,
  ADMIN_SECTION_CONTAINER_KEY,
  ADMIN_TOPOLOGY_SECTION_PART_KEY,
} from './foundations/adminIdentity';
export {
  ADMIN_GESTURE_REPETITIONS,
  ADMIN_GESTURE_SIZE,
  ADMIN_GESTURE_WINDOW_MS,
  adminLauncherPointFromEvent,
  createInitialAdminGestureState,
  logicalPointFromWindow,
  trackAdminGesture,
} from './foundations/adminLauncher';
export type {AdminGestureCoordinateSpace} from './foundations/adminLauncher';
export {
  AdminNavigationRejectedError,
  createAdminSectionCommandBoundary,
  selectAdminPageProjections,
  selectAdminSections,
} from './foundations/adminSectionSelection';
export type {AdminPageKey, AdminPageProjection, AdminPageSpec} from './foundations/adminSectionSelection';
export {adminTestIds} from './foundations/adminTestIds';
export {AdminLayer} from './components/AdminLayer';
export {AdminLauncher} from './components/AdminLauncher';
export {AdminLogin} from './components/AdminLogin';
export {AdminSectionNavigation} from './components/AdminSectionNavigation';
export {AdminShell} from './components/AdminShell';
export {SampleSection} from './components/sections/SampleSection';
export {adminShellAssembly} from './parts/parts';
export type {AdminShellAssembly} from './parts/parts';
export type {AdminSectionComponent, AdminSectionProps, AdminSectionRenderContext} from './types/adminSection';
export {
  ADMIN_PASSWORD_FALLBACK,
  deriveAdminPassword,
  normalizeDeviceIdentity,
  verifyAdminPassword,
} from './foundations/adminPassword';
export type {
  AdminPasswordDerivationInput,
  AdminPasswordVerificationInput,
  TerminalDeviceIdentity,
} from './foundations/adminPassword';
