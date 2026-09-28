import {createNodeId, createRequestId, createRuntimeInstanceId} from '@catering-v2s/kernel-base-contracts';
import type {CommandRouteContext, TopologyAdminCapability} from '@catering-v2s/kernel-base-contracts';
import {
  createDisplayContextModule,
  readDisplayFacts,
  resolveSurfaceDisplayMode,
  selectDisplayRole,
  type DisplayMode,
} from '@catering-v2s/kernel-base-display-context';
import {
  describePlatformPortCapabilities,
  normalizeDeviceIdentity,
  type EnvironmentMode,
  type LoggerPort,
  type NativeLoadingCapability,
  type PlatformPorts,
} from '@catering-v2s/kernel-base-platform-ports';
import {
  createRuntime,
  selectRuntimeInstanceMode,
  type CommandDefinition,
  type CommandTargetResolver,
  type Runtime,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {
  createUiCatalog,
  createUiStateModule,
  type ContainerKey,
  type PartKey,
  type SurfaceForm,
  type UiCatalogEntry,
  type UiStateModule,
  type UiVariableDeclaration,
} from '@catering-v2s/kernel-base-ui-state';
import {useEffect, useRef, type ReactElement, type ReactNode} from 'react';
import {InputSurfaceFrame} from '@catering-v2s/ui-base-input';
import {AdminLauncher, adminShellAssembly} from '@catering-v2s/ui-base-admin-shell';
import {
  bindSurfaceHostIdentity,
  createCatalogContext,
  createRenderRuntimeFacts,
  createRendererCatalog,
  dispatchWithRequestId,
  RenderProvider,
  resolveDebugMode,
  SurfaceRoot,
  type RenderProviderProps,
  type RenderLayerDismissal,
  type RenderRuntimeFacts,
  type RenderSurfaceReadyInput,
  type RendererBinding,
  type SurfaceCanvasDeclaration,
  type SurfaceHostMeasurementSource,
} from '@catering-v2s/ui-base-render';
import {
  createStartupDiagnosticsWriter,
  startupRequiredGroups,
  type StartupDiagnosticsReadiness,
  type StartupDiagnosticsWriter,
} from './startupDiagnosticsWriter';

export type IntegrationSurfaceCreationInput = Readonly<{
  readonly displayIndex: 0 | 1;
  readonly displayMode: DisplayMode;
  readonly surfaceForm: SurfaceForm;
}>;

export type IntegrationSurfaceDeclarations = Readonly<{
  readonly PRIMARY: SurfaceCanvasDeclaration;
  readonly SECONDARY?: SurfaceCanvasDeclaration;
}>;

type IntegrationDefinedPart = Readonly<{
  readonly catalogEntry: UiCatalogEntry;
  readonly rendererBinding: RendererBinding<any>;
}>;

type IntegrationRuntimeBundle = Readonly<{
  readonly runtime: Runtime;
  readonly uiStateModule: UiStateModule;
  readonly topologyCapability?: TopologyAdminCapability;
}>;

type IntegrationRuntimeSubscription = {
  readonly listener: () => void;
  active: boolean;
  runtimeUnsubscribe: () => void;
};

const supportedSurfaceForms = ['laptop', 'mobile'] as const satisfies readonly SurfaceForm[];

const requiredPlatformPortNames = [
  'logger',
  'persistKv',
  'persistSecure',
  'device',
  'appControl',
  'script',
  'connector',
  'hotUpdate',
  'logUpload',
  'topologyHost',
] as const satisfies readonly (keyof PlatformPorts)[];

const platformPortBindingsAreComplete = (platformPorts: PlatformPorts): boolean =>
  requiredPlatformPortNames.every(port => platformPorts[port] !== undefined && platformPorts[port] !== null);

const assertUniquePartKeys = (parts: readonly IntegrationDefinedPart[]): void => {
  const seen = new Set<string>();
  for (const part of parts) {
    if (seen.has(part.catalogEntry.partKey)) {
      throw new Error(`[ui.base.integration-assembly] duplicate partKey: ${part.catalogEntry.partKey}`);
    }
    seen.add(part.catalogEntry.partKey);
  }
};

const readDeclaredSurfaceForms = (part: IntegrationDefinedPart): ReadonlySet<SurfaceForm> => {
  const declared = part.catalogEntry.surfaceForm;
  if (declared.length === 0) {
    throw new Error(`[ui.base.integration-assembly] empty surfaceForm: ${part.catalogEntry.partKey}`);
  }
  const forms = new Set<SurfaceForm>();
  for (const form of declared) {
    if (!supportedSurfaceForms.includes(form)) {
      throw new Error(`[ui.base.integration-assembly] invalid surfaceForm for ${part.catalogEntry.partKey}: ${form}`);
    }
    if (forms.has(form)) {
      throw new Error(`[ui.base.integration-assembly] duplicate surfaceForm for ${part.catalogEntry.partKey}: ${form}`);
    }
    forms.add(form);
  }
  return forms;
};

const assertNoSurfaceFormOverlap = (parts: readonly IntegrationDefinedPart[]): void => {
  const grouped = new Map<string, ReadonlySet<SurfaceForm>[]>();
  for (const part of parts) {
    const partKey = part.catalogEntry.partKey;
    const forms = readDeclaredSurfaceForms(part);
    const siblings = grouped.get(partKey) ?? [];
    for (const siblingForms of siblings) {
      const overlap = supportedSurfaceForms.filter(form => forms.has(form) && siblingForms.has(form));
      if (overlap.length > 0) {
        throw new Error(`[ui.base.integration-assembly] overlapping surfaceForm for ${partKey}: ${overlap.join(', ')}`);
      }
    }
    siblings.push(forms);
    grouped.set(partKey, siblings);
  }
};

export const assertSecondaryPartsCanBeProjected = (
  parts: readonly Readonly<{
    readonly catalogEntry: Pick<UiCatalogEntry, 'partKey' | 'displayModes' | 'instanceModes'>;
  }>[],
): void => {
  for (const part of parts) {
    if (part.catalogEntry.displayModes.includes('SECONDARY') && !part.catalogEntry.instanceModes.includes('SLAVE')) {
      throw new Error(
        `[ui.base.integration-assembly] SECONDARY part must allow SLAVE projection: ${part.catalogEntry.partKey}`,
      );
    }
  }
};

export const selectPartsForSurfaceForm = (
  parts: readonly IntegrationDefinedPart[],
  surfaceForm: SurfaceForm,
): readonly IntegrationDefinedPart[] => {
  if (!supportedSurfaceForms.includes(surfaceForm)) {
    throw new Error(`[ui.base.integration-assembly] invalid requested surfaceForm: ${surfaceForm}`);
  }
  assertNoSurfaceFormOverlap(parts);
  const selected = parts.filter(part => part.catalogEntry.surfaceForm.includes(surfaceForm));
  assertUniquePartKeys(selected);
  return Object.freeze(selected);
};

export type IntegrationAssembly = Readonly<{
  readonly appName: string;
  readonly runtime: Runtime;
  /** Owner-controlled recovery for a terminal failed runtime. */
  readonly retryRuntime: () => Promise<void>;
  readonly surfaceForm: SurfaceForm;
  readonly surfaceDeclarations: IntegrationSurfaceDeclarations;
  readonly runtimeFacts: RenderRuntimeFacts;
  readonly createSurface: (input: IntegrationSurfaceCreationInput) => ReactElement;
}>;

export type IntegrationAssemblyInput<TReadyPayload extends StateJsonValue> = Readonly<{
  readonly appName: string;
  readonly errorPrefix: string;
  readonly runtimeName: string;
  readonly defaultPersistenceKey: string;
  readonly platformPorts: PlatformPorts;
  readonly nativeLoadingCapability: NativeLoadingCapability;
  readonly persistenceKey?: string;
  readonly surfaceForm: SurfaceForm;
  readonly surfaceDeclarations: IntegrationSurfaceDeclarations;
  readonly defaultContainerPartKeys?: Readonly<Partial<Record<ContainerKey, PartKey>>>;
  readonly environmentMode?: EnvironmentMode;
  readonly packagingDebugMode?: boolean;
  readonly startupDebugMode?: boolean;
  readonly showAdminPassword?: boolean;
  readonly parts: readonly IntegrationDefinedPart[];
  readonly layerDismissals: Readonly<Record<string, RenderLayerDismissal>>;
  readonly variables: readonly UiVariableDeclaration<StateJsonValue>[];
  readonly surfaceHostSourcesByDisplayIndex?: Readonly<Partial<Record<0 | 1, SurfaceHostMeasurementSource>>>;
  readonly startupReadyCommand: CommandDefinition<TReadyPayload>;
  readonly createStartupReadyPayload: (input: RenderSurfaceReadyInput) => TReadyPayload;
  readonly resolveCommandTarget?: CommandTargetResolver;
  readonly createTopologyAdminCapability?: (runtime: Runtime) => TopologyAdminCapability;
  readonly createApplicationModules: (
    input: Readonly<{
      readonly uiStateModule: UiStateModule;
    }>,
  ) => readonly RuntimeModule[];
  readonly renderChildren?: () => ReactNode;
}>;

export const createStateSource = (runtime: Runtime): RenderProviderProps['stateSource'] =>
  Object.freeze({
    getStatus: () => runtime.status,
    getState: () => runtime.getState(),
    subscribe: (listener: () => void) => runtime.subscribe(listener),
  });

export const createDispatchCommand =
  (runtime: Runtime): RenderProviderProps['dispatchCommand'] =>
  (command, options) =>
    runtime.dispatchCommand(command.definition, command.payload, {
      requestId: options.requestId,
      routeContext: options.routeContext,
      routeIntent: options.routeIntent,
    });

export const createSurfaceForDisplayIndex = (assembly: IntegrationAssembly, displayIndex: 0 | 1): ReactElement => {
  const runtime = assembly.runtime;
  const displayMode =
    runtime.status !== 'started'
      ? displayIndex === 0
        ? 'PRIMARY'
        : 'SECONDARY'
      : resolveSurfaceDisplayMode({
          displayIndex,
          displayRole: selectDisplayRole(runtime.getState()),
          instanceMode: selectRuntimeInstanceMode(runtime.getState()),
        });
  if (displayMode === 'SECONDARY' && assembly.surfaceDeclarations.SECONDARY === undefined) {
    throw new Error(`[${assembly.appName}] display index ${displayIndex} is unavailable for ${assembly.surfaceForm}`);
  }
  return assembly.createSurface({displayIndex, displayMode, surfaceForm: assembly.surfaceForm});
};

type IntegrationSurfaceInputFrameProps = Readonly<{
  readonly appName: string;
  readonly surface: IntegrationSurfaceCreationInput;
  readonly declaredSize: SurfaceCanvasDeclaration;
  readonly logger: LoggerPort;
  readonly hostSourceAttached: boolean;
  readonly onSurfaceDeclared: () => void;
  readonly onSurfaceMeasured: () => void;
  readonly children?: ReactNode;
}>;

const IntegrationSurfaceInputFrame = ({
  appName,
  surface,
  declaredSize,
  logger,
  hostSourceAttached,
  onSurfaceDeclared,
  onSurfaceMeasured,
  children,
}: IntegrationSurfaceInputFrameProps) => {
  const declaredRef = useRef(false);
  const declaredDiagnosticRef = useRef(false);

  useEffect(() => {
    if (declaredRef.current) return;
    declaredRef.current = true;
    onSurfaceDeclared();
    if (__DEV__ && !declaredDiagnosticRef.current) {
      declaredDiagnosticRef.current = true;
      logger.info({
        category: 'startup.surfaces',
        event: 'startup.surfaces.declared',
        message: 'Declared surface baseline registered',
        data: {
          kind: 'declared',
          source: 'ui.base.integration-assembly.IntegrationSurfaceInputFrame',
          appName,
          displayMode: surface.displayMode,
          displayIndex: surface.displayIndex,
          surfaceForm: surface.surfaceForm,
          width: declaredSize.width,
          height: declaredSize.height,
          hostSourceAttached,
        },
      });
    }
  }, [
    appName,
    declaredSize.height,
    declaredSize.width,
    hostSourceAttached,
    logger,
    onSurfaceDeclared,
    surface.displayIndex,
    surface.displayMode,
    surface.surfaceForm,
  ]);

  return (
    <InputSurfaceFrame
      onMeasuredFrame={frame => {
        onSurfaceMeasured();
        if (!__DEV__) return;
        logger.info({
          category: 'startup.surfaces',
          event: 'startup.surfaces.measured',
          message: 'Measured surface frame observed',
          data: {
            kind: 'measured',
            source: 'ui.base.integration-assembly.IntegrationSurfaceInputFrame.onLayout',
            appName,
            displayMode: surface.displayMode,
            displayIndex: surface.displayIndex,
            surfaceForm: surface.surfaceForm,
            width: frame.width,
            height: frame.height,
            deltaWidth: frame.width - declaredSize.width,
            deltaHeight: frame.height - declaredSize.height,
            ready: frame.ready,
            orientation: frame.orientation,
            hostSourceAttached,
          },
        });
      }}
    >
      {children}
    </InputSurfaceFrame>
  );
};

export const createIntegrationAssembly = async <TReadyPayload extends StateJsonValue>(
  input: IntegrationAssemblyInput<TReadyPayload>,
): Promise<IntegrationAssembly> => {
  // Production bundles must not inherit the development diagnostics mode when
  // a caller omits the optional test override. The Android assembly passes an
  // explicit mode; this branch keeps the same contract for other real shells.
  const environmentMode: EnvironmentMode = input.environmentMode ?? (__DEV__ ? 'DEV' : 'PROD');
  const deviceInfoResult = await input.platformPorts.device.getDeviceInfo({timeoutMs: 2_000});
  const deviceIdentity = normalizeDeviceIdentity(deviceInfoResult);
  const displayFacts = await readDisplayFacts(input.platformPorts.device);
  const runtimeFacts = createRenderRuntimeFacts({
    environmentMode,
    debugMode: resolveDebugMode({packaging: input.packagingDebugMode, startup: input.startupDebugMode}),
    showAdminPassword: input.showAdminPassword,
    deviceIdentity,
    platformPortCapabilities: describePlatformPortCapabilities(input.platformPorts),
    displayFacts,
    surfaceCanvasSizes: input.surfaceDeclarations,
  });
  const allParts = Object.freeze([...adminShellAssembly.parts, ...input.parts]);
  const selectedParts = selectPartsForSurfaceForm(allParts, input.surfaceForm);
  assertSecondaryPartsCanBeProjected(selectedParts);
  const uiCatalog = createUiCatalog(selectedParts.map(({catalogEntry}) => catalogEntry));
  const rendererCatalog = createRendererCatalog(selectedParts.map(({rendererBinding}) => rendererBinding));
  const createRouteContext: NonNullable<RenderProviderProps['createRouteContext']> = (
    root,
    displayMode,
  ): CommandRouteContext => {
    const catalogContext = createCatalogContext(root, displayMode, input.surfaceForm);
    return Object.freeze({
      displayMode: catalogContext.displayMode,
      workspace: catalogContext.workspace,
      instanceMode: catalogContext.instanceMode,
    });
  };
  const startupReadiness = {
    primaryDeclared: false,
    primaryMeasured: false,
    primaryRealReady: false,
    primaryReadyPartKey: null as string | null,
    primaryContentFailure: null as RenderSurfaceReadyInput['contentFailure'],
    parts:
      uiCatalog.entries.length > 0 &&
      uiCatalog.entries.every(entry => rendererCatalog.resolve(entry.rendererKey) !== undefined),
  };
  let runtime: Runtime | undefined;
  const getStartupReadiness = (): StartupDiagnosticsReadiness => {
    const descriptors = runtime?.status === 'started' ? runtime.descriptors : [];
    const runtimeStarted = descriptors.length > 0;
    const registrationGroupsComplete =
      runtimeStarted &&
      descriptors.every(
        descriptor =>
          Array.isArray(descriptor.stateSliceNames) &&
          Array.isArray(descriptor.commandNames) &&
          Array.isArray(descriptor.actorKeys),
      );
    return {
      groups: {
        modules: runtimeStarted,
        slices: registrationGroupsComplete,
        commands: registrationGroupsComplete,
        actors: registrationGroupsComplete,
        // Port descriptors are development-only diagnostics. Startup
        // completeness must use the actual binding shape so DEV and release
        // apply the same gate without keeping diagnostic metadata in release.
        ports: platformPortBindingsAreComplete(input.platformPorts),
        parts: startupReadiness.parts,
      },
      primaryDeclared: startupReadiness.primaryDeclared,
      primaryMeasured: startupReadiness.primaryMeasured,
      primaryRealReady: startupReadiness.primaryRealReady,
      primaryReadyPartKey: startupReadiness.primaryReadyPartKey,
      primaryContentFailure: startupReadiness.primaryContentFailure,
    };
  };
  const startupDiagnosticsWriter = createStartupDiagnosticsWriter({
    logger: input.platformPorts.logger,
    startupRunId: createRuntimeInstanceId(),
    appName: input.appName,
    surfaceProvenance: {
      surfaceKey: 'PRIMARY',
      displayIndex: 0,
      surfaceForm: input.surfaceForm,
    },
    clientProvenance: {
      clientId: createRuntimeInstanceId(),
      clientName: input.appName,
      owner: 'ui.base.integration-assembly',
    },
    getReadiness: getStartupReadiness,
  });

  const createRuntimeBundle = (): IntegrationRuntimeBundle => {
    const uiStateModule = createUiStateModule({
      catalog: uiCatalog,
      variables: input.variables,
      surfaceForm: input.surfaceForm,
    });
    const modules: readonly RuntimeModule[] = [
      createDisplayContextModule({surfaceForm: input.surfaceForm}),
      uiStateModule,
      ...input.createApplicationModules({uiStateModule}),
    ];
    const nextRuntime = createRuntime({
      localNodeId: createNodeId(),
      modules,
      platformPorts: input.platformPorts,
      state: {
        runtimeName: input.runtimeName,
        environmentMode,
        persistenceKey: input.persistenceKey ?? input.defaultPersistenceKey,
        persistenceDebounceMs: 300,
      },
      resolveCommandTarget: input.resolveCommandTarget,
    });
    return Object.freeze({
      runtime: nextRuntime,
      uiStateModule,
      topologyCapability: input.createTopologyAdminCapability?.(nextRuntime),
    });
  };

  const runtimeSubscriptions = new Set<IntegrationRuntimeSubscription>();
  const runtimeRequired = (): Runtime => {
    if (runtime === undefined) throw new Error(`[${input.errorPrefix}] runtime owner is not initialized`);
    return runtime;
  };
  const notifyRuntimeOwnerSubscribers = (): void => {
    for (const subscription of [...runtimeSubscriptions]) {
      if (subscription.active) subscription.listener();
    }
  };
  const replaceRuntime = (nextBundle: IntegrationRuntimeBundle): void => {
    for (const subscription of runtimeSubscriptions) subscription.runtimeUnsubscribe();
    runtime = nextBundle.runtime;
    uiStateModule = nextBundle.uiStateModule;
    topologyCapability = nextBundle.topologyCapability;
    for (const subscription of runtimeSubscriptions) {
      if (subscription.active) subscription.runtimeUnsubscribe = nextBundle.runtime.subscribe(subscription.listener);
    }
    notifyRuntimeOwnerSubscribers();
  };
  const stateSource: RenderProviderProps['stateSource'] = Object.freeze({
    getStatus: () => runtimeRequired().status,
    getState: () => runtimeRequired().getState(),
    subscribe: (listener: () => void): (() => void) => {
      const subscription: IntegrationRuntimeSubscription = {
        listener,
        active: true,
        runtimeUnsubscribe: runtimeRequired().subscribe(listener),
      };
      runtimeSubscriptions.add(subscription);
      return () => {
        if (!subscription.active) return;
        subscription.active = false;
        subscription.runtimeUnsubscribe();
        runtimeSubscriptions.delete(subscription);
      };
    },
  });
  const dispatchCommand: RenderProviderProps['dispatchCommand'] = (command, options) =>
    runtimeRequired().dispatchCommand(command.definition, command.payload, {
      requestId: options.requestId,
      routeContext: options.routeContext,
      routeIntent: options.routeIntent,
    });
  let uiStateModule: UiStateModule;
  let topologyCapability: TopologyAdminCapability | undefined;
  const initialBundle = createRuntimeBundle();
  runtime = initialBundle.runtime;
  uiStateModule = initialBundle.uiStateModule;
  topologyCapability = initialBundle.topologyCapability;
  try {
    await initialBundle.runtime.start();
  } catch (error) {
    input.platformPorts.logger.error({
      category: 'runtime.lifecycle',
      event: 'runtime.owner-initial-start-failed',
      message: 'Runtime owner retained a failed runtime for the admin retry boundary',
      data: {appName: input.appName, status: initialBundle.runtime.status},
      error: {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message.slice(0, 160) : 'Unknown runtime start failure',
      },
    });
  }
  let retryPromise: Promise<void> | undefined;
  const onRuntimeRetry = (): Promise<void> => {
    if (retryPromise !== undefined) return retryPromise;
    if (runtimeRequired().status !== 'failed') return Promise.resolve();
    retryPromise = (async () => {
      try {
        const nextBundle = createRuntimeBundle();
        replaceRuntime(nextBundle);
        await nextBundle.runtime.start();
      } finally {
        retryPromise = undefined;
      }
    })();
    return retryPromise;
  };
  let primaryReadyPromise: Promise<void> | null = null;
  let primarySurfaceReady = false;
  let primarySurfaceMeasuredPromise: Promise<void> | null = null;
  let resolvePrimarySurfaceMeasured: (() => void) | null = null;
  const waitForPrimarySurfaceMeasured = (): Promise<void> => {
    if (startupReadiness.primaryMeasured) return Promise.resolve();
    primarySurfaceMeasuredPromise ??= new Promise(resolve => {
      resolvePrimarySurfaceMeasured = resolve;
    });
    return primarySurfaceMeasuredPromise;
  };
  const markPrimarySurfaceMeasured = (): void => {
    if (startupReadiness.primaryMeasured) return;
    startupReadiness.primaryMeasured = true;
    resolvePrimarySurfaceMeasured?.();
    resolvePrimarySurfaceMeasured = null;
  };
  const onPrimarySurfaceReady: NonNullable<RenderProviderProps['onPrimarySurfaceReady']> = readyInput => {
    // ScreenReadyBoundary is intentionally local to the currently rendered
    // real part.  A login -> business navigation therefore mounts another
    // boundary in the same runtime.  Share the first accepted promise so
    // that navigation cannot dispatch startup-ready (and write complete) a
    // second time, while a genuinely failed first attempt remains retryable.
    if (primaryReadyPromise !== null) return primaryReadyPromise;
    input.platformPorts.logger.info({
      category: 'startup.ready-dispatch',
      event: 'startup.ready-dispatch-start',
      message: 'Dispatching PRIMARY startup-ready command',
      data: {
        appName: input.appName,
        surfaceKey: readyInput.surfaceKey,
        displayIndex: readyInput.displayIndex,
        readyPartKey: readyInput.readyPartKey,
        contentFailure: readyInput.contentFailure,
      },
    });
    primaryReadyPromise = dispatchWithRequestId({
      dispatchCommand,
      definition: input.startupReadyCommand,
      payload: input.createStartupReadyPayload(readyInput),
      requestId: createRequestId(),
    })
      .then(async result => {
        input.platformPorts.logger.info({
          category: 'startup.ready-dispatch',
          event: 'startup.ready-dispatch-result',
          message: 'PRIMARY startup-ready command completed',
          data: {
            appName: input.appName,
            status: result.status,
            actorResultCount: result.actorResults.length,
          },
        });
        if (result.status !== 'completed') {
          throw new Error(`[${input.errorPrefix}] startup-ready command ended with ${result.status}`);
        }
        startupReadiness.primaryRealReady = readyInput.contentFailure === null;
        startupReadiness.primaryReadyPartKey = readyInput.contentFailure === null ? readyInput.readyPartKey : null;
        startupReadiness.primaryContentFailure = readyInput.contentFailure;
        // React Native Web may deliver the resolved screen's layout callback
        // before the enclosing InputSurfaceFrame's layout callback. Keep the
        // startup completion gate factual without turning that valid ordering
        // into a false primary.measured failure.
        await waitForPrimarySurfaceMeasured();
        if (!startupDiagnosticsWriter.writeComplete()) {
          const readiness = getStartupReadiness();
          const missing = [
            ...startupRequiredGroups.filter(group => !readiness.groups[group]).map(group => `group.${group}`),
            ...(readiness.primaryDeclared ? [] : ['primary.declared']),
            ...(readiness.primaryMeasured ? [] : ['primary.measured']),
            ...(readiness.primaryRealReady || readiness.primaryContentFailure !== null ? [] : ['primary.real-ready']),
          ];
          const error = new Error(`[${input.errorPrefix}] startup completion prerequisites were not met`);
          error.name = `StartupCompletionPrerequisitesMissing:${missing.join('|') || 'unknown'}`;
          throw error;
        }
        primarySurfaceReady = true;
      })
      .catch(error => {
        input.platformPorts.logger.error({
          category: 'startup.ready-dispatch',
          event: 'startup.ready-dispatch-failed',
          message: 'PRIMARY startup-ready command failed',
          data: {
            appName: input.appName,
            errorName: error instanceof Error ? error.name : 'UnknownError',
          },
        });
        primaryReadyPromise = null;
        throw error;
      });
    return primaryReadyPromise;
  };
  const selectUiVariable: RenderProviderProps['selectUiVariable'] = (root, declaration) =>
    uiStateModule.selectUiVariable(root, declaration);
  const selectSurfaceForm: RenderProviderProps['selectSurfaceForm'] = root => uiStateModule.selectSurfaceForm(root);
  const boundHostSources = new Map<string, ReturnType<typeof bindSurfaceHostIdentity>>();
  const getSurfaceHostSource = (surface: IntegrationSurfaceCreationInput) => {
    const source = input.surfaceHostSourcesByDisplayIndex?.[surface.displayIndex];
    if (source === undefined) return undefined;
    const cacheKey = `${surface.displayIndex}:${surface.displayMode}:${surface.surfaceForm}`;
    const cached = boundHostSources.get(cacheKey);
    if (cached !== undefined) return cached;
    const bound = bindSurfaceHostIdentity(
      source,
      {
        surfaceKey: surface.displayIndex === 0 ? 'PRIMARY' : 'SECONDARY',
        displayIndex: surface.displayIndex,
        surfaceForm: surface.surfaceForm,
        displayMode: surface.displayMode,
      },
      rejection => {
        input.platformPorts.logger.warn({
          category: 'display-diagnostics',
          event: 'surface.host-identity-rejected',
          message: 'Surface host source rejected because its physical host flag does not match the bound display index',
          data: {
            source: 'ui.base.integration-assembly.bindSurfaceHostIdentity',
            appName: input.appName,
            reason: rejection.reason,
            displayIndex: rejection.displayIndex,
            expectedIsHostPrimaryDisplay: rejection.expectedIsHostPrimaryDisplay,
            actualIsHostPrimaryDisplay: rejection.actualIsHostPrimaryDisplay,
            displayMode: surface.displayMode,
            surfaceForm: surface.surfaceForm,
          },
        });
      },
    );
    boundHostSources.set(cacheKey, bound);
    return bound;
  };

  if (__DEV__) {
    input.platformPorts.logger.info({
      category: 'display-diagnostics',
      event: 'sample.assembly-created',
      message: 'Shared integration assembly display-chain inputs registered',
      data: {
        source: 'ui.base.integration-assembly.createIntegrationAssembly',
        appName: input.appName,
        surfaceForm: input.surfaceForm,
        primaryWidth: input.surfaceDeclarations.PRIMARY.width,
        primaryHeight: input.surfaceDeclarations.PRIMARY.height,
        secondaryWidth: input.surfaceDeclarations.SECONDARY?.width ?? null,
        secondaryHeight: input.surfaceDeclarations.SECONDARY?.height ?? null,
        primaryHostSourceAttached: input.surfaceHostSourcesByDisplayIndex?.[0] !== undefined,
        secondaryHostSourceAttached: input.surfaceHostSourcesByDisplayIndex?.[1] !== undefined,
      },
    });
    input.platformPorts.logger.info({
      category: 'startup.device',
      event: 'sample.device-identity-resolved',
      message: 'Sample device identity fact resolved',
      data: {
        appName: input.appName,
        available: deviceIdentity.available,
        source: 'ui.base.integration-assembly.createIntegrationAssembly',
      },
    });
  }
  input.platformPorts.logger.info({
    category: 'startup.runtime-facts',
    event: 'sample.runtime-facts-resolved',
    message: 'Sample runtime facts resolved',
    data: {
      source: 'ui.base.integration-assembly.createIntegrationAssembly',
      appName: input.appName,
      debugEnabled: runtimeFacts.debugMode.enabled,
      debugSource: runtimeFacts.debugMode.source,
      deviceIdentityAvailable: runtimeFacts.deviceIdentity.available,
      capabilityDescriptorCount: runtimeFacts.platformPortCapabilities.length,
    },
  });

  const reportedSurfaceModes = new Set<DisplayMode>();
  const createSurface = (surface: IntegrationSurfaceCreationInput): ReactElement => {
    const declaredSize =
      surface.displayMode === 'PRIMARY' ? input.surfaceDeclarations.PRIMARY : input.surfaceDeclarations.SECONDARY;
    if (declaredSize === undefined) {
      throw new Error(`[${input.errorPrefix}] ${surface.displayMode} is unavailable for ${surface.surfaceForm}`);
    }
    if (__DEV__ && !reportedSurfaceModes.has(surface.displayMode)) {
      reportedSurfaceModes.add(surface.displayMode);
      input.platformPorts.logger.info({
        category: 'display-diagnostics',
        event: 'sample.surface-created',
        message: 'Sample display surface created',
        data: {
          source: 'ui.base.integration-assembly.createIntegrationAssembly',
          appName: input.appName,
          displayMode: surface.displayMode,
          displayIndex: surface.displayIndex,
          surfaceForm: surface.surfaceForm,
          containerKey: 'main',
          orientation: surface.surfaceForm === 'laptop' ? 'landscape' : 'portrait',
          declaredWidth: declaredSize.width,
          declaredHeight: declaredSize.height,
          hostSourceAttached: input.surfaceHostSourcesByDisplayIndex?.[surface.displayIndex] !== undefined,
        },
      });
    }
    return (
      <RenderProvider
        stateSource={stateSource}
        uiCatalog={uiCatalog}
        rendererCatalog={rendererCatalog}
        logger={input.platformPorts.logger}
        nativeLoadingCapability={input.nativeLoadingCapability}
        onPrimarySurfaceReady={onPrimarySurfaceReady}
        getPrimarySurfaceReady={() => primarySurfaceReady}
        runtimeFacts={runtimeFacts}
        onRuntimeRetry={onRuntimeRetry}
        topologyCapability={topologyCapability}
        dispatchCommand={dispatchCommand}
        createRouteContext={createRouteContext}
        layerDismissals={input.layerDismissals}
        selectUiVariable={selectUiVariable}
        selectSurfaceForm={selectSurfaceForm}
      >
        <SurfaceRoot
          displayMode={surface.displayMode}
          containerKey="main"
          defaultContainerPartKeys={input.defaultContainerPartKeys}
          canvas={declaredSize}
          surfaceHostSource={getSurfaceHostSource(surface)}
          renderContentFrame={({content}) => (
            <IntegrationSurfaceInputFrame
              appName={input.appName}
              surface={surface}
              declaredSize={declaredSize}
              logger={input.platformPorts.logger}
              hostSourceAttached={input.surfaceHostSourcesByDisplayIndex?.[surface.displayIndex] !== undefined}
              onSurfaceDeclared={() => {
                if (surface.displayIndex === 0) startupReadiness.primaryDeclared = true;
              }}
              onSurfaceMeasured={() => {
                if (surface.displayIndex === 0) markPrimarySurfaceMeasured();
              }}
            >
              <AdminLauncher canvas={declaredSize}>{content}</AdminLauncher>
            </IntegrationSurfaceInputFrame>
          )}
        >
          {input.renderChildren?.()}
        </SurfaceRoot>
      </RenderProvider>
    );
  };

  return Object.freeze({
    appName: input.appName,
    get runtime(): Runtime {
      return runtimeRequired();
    },
    retryRuntime: onRuntimeRetry,
    surfaceForm: input.surfaceForm,
    surfaceDeclarations: input.surfaceDeclarations,
    runtimeFacts,
    createSurface,
  });
};
