import {useEffect, useMemo, useState, type FC} from 'react';
import {Text, View} from 'react-native';
import {readDisplayInfo, resolveSecondarySurfaceAvailable} from '@catering-v2s/kernel-base-display-context';
import type {NativeLoadingCapability} from '@catering-v2s/kernel-base-platform-ports';
import {createWebPlatformPorts, type SurfaceMode} from '../implementations/webPlatform';
import type {SurfaceForm, TestExpoAppOptions, TestExpoAssembly, TerminalSurfaces} from '../types/testExpoApp';
import {createWebSurfaceHostSource} from '../implementations/webSurfaceHost';
import {testExpoTestIds} from '../foundations/testExpoTestIds';
import {DEFAULT_SURFACE_WIDTH_PERCENT, styles} from './testExpoAppStyles';
import {SurfaceCanvas} from './SurfaceCanvas';
import {SurfaceFormSwitcher} from './SurfaceFormSwitcher';
import {SurfaceModeSwitcher} from './SurfaceModeSwitcher';
import {SurfaceWidthControl} from './SurfaceWidthControl';
import {HeaderStatus} from './HeaderStatus';
import {HostStateCard} from './HostStateCard';
import {resolveSurfaceGroup} from './surfaceGroup';

export type {SurfaceSize, SurfaceForm, SurfaceCreationInput, TerminalSurfaces, TestExpoAppOptions, TestExpoAssembly, TestExpoRuntimeStatus} from '../types/testExpoApp';

const SURFACE_FORM_QUERY_PARAM = 'surfaceForm';

const createWebNativeLoadingCapability = (): NativeLoadingCapability => {
  let hidden = false;
  return Object.freeze({
    targetPhysicalSurface: Object.freeze({surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const}),
    hideOnce: async (reason: string) => {
      if (hidden) return Object.freeze({hidden: false, reason, alreadyHidden: true});
      hidden = true;
      return Object.freeze({hidden: true, reason, alreadyHidden: false});
    },
  });
};

const createSurfaceModeSource = (initial: SurfaceMode) => {
  let current = initial;
  return Object.freeze({
    read: (): SurfaceMode => current,
    write: (next: SurfaceMode): void => {
      current = next;
    },
  });
};

const isSurfaceForm = (value: string | null): value is SurfaceForm => value === 'laptop' || value === 'mobile';

const readSurfaceFormFromWebLocation = (): SurfaceForm | undefined => {
  if (typeof window === 'undefined' || typeof window.location?.search !== 'string') return undefined;
  const requested = new URLSearchParams(window.location.search).get(SURFACE_FORM_QUERY_PARAM);
  return isSurfaceForm(requested) ? requested : undefined;
};

const resolveInitialSurfaceForm = (
  defaultSurfaceForm: SurfaceForm,
  terminalSurfaces: TerminalSurfaces,
): SurfaceForm => {
  const requested = readSurfaceFormFromWebLocation();
  if (requested === undefined) return defaultSurfaceForm;
  if (requested === 'mobile' && terminalSurfaces.orientations.portrait === undefined) return defaultSurfaceForm;
  return requested;
};

const restartWebSurfaceWithForm = (surfaceForm: SurfaceForm): boolean => {
  if (typeof window === 'undefined' || typeof window.location?.replace !== 'function') return false;
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set(SURFACE_FORM_QUERY_PARAM, surfaceForm);
  window.location.replace(nextUrl.toString());
  return true;
};

export const createTestExpoApp = <TAssembly extends TestExpoAssembly>(options: TestExpoAppOptions<TAssembly>): FC => {
  const makeTestId = testExpoTestIds.node;
  const persistenceKey = options.persistenceKey ?? `${options.appName}-web`;
  const defaultSurfaceForm = options.surfaceForm ?? 'laptop';
  const supportsMobile = options.terminalSurfaces.orientations.portrait !== undefined;

  const TestExpoApp: FC = () => {
    const [surfaceForm, setSurfaceForm] = useState<SurfaceForm>(() =>
      resolveInitialSurfaceForm(defaultSurfaceForm, options.terminalSurfaces),
    );
    const [surfaceWidthPercent, setSurfaceWidthPercent] = useState(DEFAULT_SURFACE_WIDTH_PERCENT);
    const [surfaceMode, setSurfaceMode] = useState<SurfaceMode>('single');
    const [surfaceModeSource] = useState(() => createSurfaceModeSource(surfaceMode));
    const changeSurfaceMode = (nextSurfaceMode: SurfaceMode): void => {
      surfaceModeSource.write(nextSurfaceMode);
      setSurfaceMode(nextSurfaceMode);
    };
    const [assembly, setAssembly] = useState<TAssembly | undefined>();
    const [startupError, setStartupError] = useState(false);
    const [showSecondary, setShowSecondary] = useState<boolean | undefined>();
    const webPlatformOptions = useMemo(() => {
      const readDisplaySurfaces =
        options.webPlatformOptions?.readDisplaySurfaces ??
        (() => {
          const {primary, secondary} = resolveSurfaceGroup(options.terminalSurfaces, surfaceForm);
          return Object.freeze([
            Object.freeze({
              displayId: 0,
              role: 'primary' as const,
              logicalSize: Object.freeze({...primary}),
              physicalSize: null,
              readiness: 'ready' as const,
            }),
            ...(surfaceModeSource.read() === 'dual' && surfaceForm === 'laptop'
              ? [
                  Object.freeze({
                    displayId: 1,
                    role: 'secondary' as const,
                    logicalSize: Object.freeze({...secondary}),
                    physicalSize: null,
                    readiness: 'ready' as const,
                  }),
                ]
              : []),
          ]);
        });
      return Object.freeze({
        ...options.webPlatformOptions,
        readDisplaySurfaces,
        storageNamespace: options.appName,
      });
    }, [surfaceForm, surfaceModeSource]);
    const platformPorts = useMemo(
      () => createWebPlatformPorts(surfaceModeSource.read, webPlatformOptions),
      [surfaceModeSource, webPlatformOptions],
    );
    const webSurfaceHostSources = useMemo(() => {
      const {primary, secondary} = resolveSurfaceGroup(options.terminalSurfaces, surfaceForm);
      return Object.freeze({
        0: createWebSurfaceHostSource({displayIndex: 0, size: primary}),
        ...(surfaceForm === 'laptop' ? {1: createWebSurfaceHostSource({displayIndex: 1, size: secondary})} : {}),
      });
    }, [surfaceForm]);
    const [nativeLoadingCapability] = useState(createWebNativeLoadingCapability);

    useEffect(() => {
      let active = true;
      setAssembly(undefined);
      setStartupError(false);
      setShowSecondary(undefined);
      void options
        .createAssembly({
          platformPorts,
          nativeLoadingCapability,
          persistenceKey,
          surfaceForm,
          surfaceHostSourcesByDisplayIndex: webSurfaceHostSources,
        })
        .then(nextAssembly => {
          if (!active) return;
          setAssembly(nextAssembly);
          platformPorts.logger.info({
            category: `${options.appName}.test-expo`,
            event: 'startup-ready',
            data: {runtimeStatus: options.getRuntimeStatus(nextAssembly)},
          });
        })
        .catch(() => {
          if (!active) return;
          setStartupError(true);
          platformPorts.logger.error({
            category: `${options.appName}.test-expo`,
            event: 'startup-failed',
            message: `${options.appName} startup failed`,
          });
        });
      return () => {
        active = false;
      };
    }, [nativeLoadingCapability, platformPorts, surfaceForm, webSurfaceHostSources]);

    useEffect(() => {
      if (assembly === undefined) return;
      let active = true;
      void (async () => {
        try {
          await options.onSurfaceModeChanged?.({assembly, surfaceMode});
          const displayInfo = await readDisplayInfo(platformPorts.device);
          if (!active) return;
          setShowSecondary(surfaceForm === 'laptop' && resolveSecondarySurfaceAvailable(displayInfo));
          platformPorts.logger.info({
            category: `${options.appName}.test-expo`,
            event: 'surface-decision-ready',
            data: {displayInfoStatus: displayInfo.status},
          });
        } catch (error) {
          if (!active) return;
          setShowSecondary(false);
          platformPorts.logger.error({
            category: `${options.appName}.test-expo`,
            event: 'surface-decision-failed',
            message: error instanceof Error ? error.message.slice(0, 160) : 'Surface topology refresh failed',
          });
        }
      })();
      return () => {
        active = false;
      };
    }, [assembly, platformPorts, surfaceForm, surfaceMode]);

    const runtimeStatus = startupError
      ? 'failed'
      : assembly === undefined
        ? 'starting'
        : options.getRuntimeStatus(assembly);
    return (
      <View style={styles.root} testID={makeTestId('root')}>
        <View style={styles.scroll}>
          <View style={styles.content}>
            <View style={styles.stageHeader}>
              <View style={styles.stageHeaderTopRow} testID={makeTestId('stage-header-top')}>
                <View>
                  <Text style={styles.sectionEyebrow}>LIVE SURFACE PREVIEW</Text>
                  <Text style={styles.stageTitle}>{options.title}</Text>
                </View>
                <HeaderStatus
                  runtimeStatus={runtimeStatus}
                  showSecondary={showSecondary}
                  surfaceForm={surfaceForm}
                  terminalSurfaces={options.terminalSurfaces}
                  makeTestId={makeTestId}
                />
              </View>
              <View style={styles.toolbarActions} testID={makeTestId('toolbar-actions')}>
                <SurfaceWidthControl
                  surfaceWidthPercent={surfaceWidthPercent}
                  onChange={setSurfaceWidthPercent}
                  makeTestId={makeTestId}
                />
                <SurfaceFormSwitcher
                  surfaceForm={surfaceForm}
                  supportsMobile={supportsMobile}
                  makeTestId={makeTestId}
                  onSelect={nextSurfaceForm => {
                    if (nextSurfaceForm === surfaceForm) return;
                    const restarted = restartWebSurfaceWithForm(nextSurfaceForm);
                    platformPorts.logger.info({
                      category: `${options.appName}.test-expo`,
                      event: 'surface-form-switch-requested',
                      message: restarted
                        ? 'Web surface form switch requested; restarting the surface page'
                        : 'Surface form switch requested; rebuilding the host in place',
                      data: {
                        from: surfaceForm,
                        to: nextSurfaceForm,
                        restart: restarted ? 'web-page-reload' : 'in-memory-rebuild',
                      },
                    });
                    changeSurfaceMode('single');
                    if (!restarted) setSurfaceForm(nextSurfaceForm);
                  }}
                />
                {surfaceForm === 'laptop' ? (
                  <SurfaceModeSwitcher surfaceMode={surfaceMode} onSelect={changeSurfaceMode} makeTestId={makeTestId} />
                ) : null}
              </View>
            </View>
            {startupError ? (
              <HostStateCard
                kind="error"
                testID={makeTestId('start-error')}
                title={`${options.appName} 启动失败`}
                description="请查看启动日志后重试；业务 surface 尚未挂载。"
              />
            ) : assembly === undefined ? (
              <HostStateCard
                kind="pending"
                testID={makeTestId('start-pending')}
                title={`${options.appName} 启动中`}
                description="正在组装 runtime、目录与业务模块，完成后会挂载主屏。"
              />
            ) : showSecondary === undefined ? (
              <HostStateCard
                kind="pending"
                testID={makeTestId('display-pending')}
                title="正在读取屏幕信息"
                description="外壳正在决定是否挂载客显；这一步不改变业务模块与 runtime。"
              />
            ) : (
              <>
                <SurfaceCanvas
                  key={surfaceForm}
                  assembly={assembly}
                  logger={platformPorts.logger}
                  showSecondary={showSecondary}
                  surfaceWidthPercent={surfaceWidthPercent}
                  surfaceForm={surfaceForm}
                  terminalSurfaces={options.terminalSurfaces}
                  makeTestId={makeTestId}
                />
                <Text style={styles.stageFooter}>逻辑尺寸固定 · 外层按配置排布 · 内部由业务组件负责内容</Text>
              </>
            )}
          </View>
        </View>
      </View>
    );
  };

  return TestExpoApp;
};

