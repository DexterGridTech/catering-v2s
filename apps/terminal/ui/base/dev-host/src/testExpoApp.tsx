import {useEffect, useMemo, useRef, useState, type FC, type ReactElement} from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  readDisplayInfo,
  resolveSecondarySurfaceAvailable,
  type DisplayMode,
} from '@catering-v2s/kernel-base-display-context'
import type {PlatformPorts} from '@catering-v2s/kernel-base-platform-ports'
import {createWebPlatformPorts, type SurfaceMode} from './webPlatform'

export type SurfaceSize = Readonly<{
  readonly width: number
  readonly height: number
}>

export type TerminalSurfaces = Readonly<{
  readonly layout: 'row' | 'column'
  readonly scaleToFit: boolean
  readonly surfaces: Readonly<{
    readonly PRIMARY: SurfaceSize
    readonly SECONDARY: SurfaceSize
  }>
}>

export type TestExpoRuntimeStatus = 'created' | 'starting' | 'started' | 'failed'

export type TestExpoAssembly = Readonly<{
  readonly createSurface: (displayMode: DisplayMode) => ReactElement
}>

export type TestExpoAppOptions<TAssembly extends TestExpoAssembly> = Readonly<{
  readonly appName: string
  readonly title: string
  readonly terminalSurfaces: TerminalSurfaces
  readonly persistenceKey?: string
  readonly createAssembly: (input: Readonly<{
    readonly platformPorts: PlatformPorts
    readonly persistenceKey: string
  }>) => Promise<TAssembly>
  readonly getRuntimeStatus: (assembly: TAssembly) => TestExpoRuntimeStatus
}>

const CONTENT_MAX_WIDTH = 1600
const CONTENT_HORIZONTAL_PADDING = 28

const COLORS = {
  ink: '#EAF6FF',
  inkMuted: '#8CAEC5',
  canvas: '#061321',
  canvasRaised: '#0B1E30',
  white: '#F7FBFF',
  border: '#1B3D5A',
  borderStrong: '#2B6288',
  primary: '#32B7FF',
  primarySoft: '#102C47',
  secondary: '#23D3C2',
  secondarySoft: '#103D42',
  success: '#58E39B',
  successSoft: '#123C33',
  danger: '#FF6B6B',
  dangerSoft: '#4A1F2B',
  warning: '#F7C66A',
  warningSoft: '#43351A',
} as const

type SurfaceCanvasProps = Readonly<{
  readonly assembly: TestExpoAssembly
  readonly showSecondary: boolean
  readonly terminalSurfaces: TerminalSurfaces
  readonly testIdPrefix: string
}>

const SurfaceCanvas = ({
  assembly,
  showSecondary,
  terminalSurfaces,
  testIdPrefix,
}: SurfaceCanvasProps) => {
  const primary = terminalSurfaces.surfaces.PRIMARY
  const secondary = terminalSurfaces.surfaces.SECONDARY
  const surfaceStyle = (size: SurfaceSize) => ({
    flex: terminalSurfaces.layout === 'row' ? 1 : undefined,
    width: terminalSurfaces.layout === 'column' ? ('100%' as const) : undefined,
    minWidth: 0,
    aspectRatio: size.width / size.height,
    flexShrink: 1,
  })
  return (
    <View
      testID={`${testIdPrefix}:canvas`}
      style={styles.canvas}
    >
      <View
        style={[styles.responsiveStage, {
          flexDirection: terminalSurfaces.layout === 'row' ? 'row' : 'column',
          alignItems: terminalSurfaces.layout === 'column' ? 'center' : 'stretch',
        }]}
      >
        <View
          style={[styles.surface, styles.primarySurface, surfaceStyle(primary)]}
          testID={`${testIdPrefix}:surface:PRIMARY`}
        >
          {assembly.createSurface('PRIMARY')}
        </View>
        {showSecondary ? (
          <View
            style={[styles.surface, styles.secondarySurface, surfaceStyle(secondary)]}
            testID={`${testIdPrefix}:surface:SECONDARY`}
          >
            {assembly.createSurface('SECONDARY')}
          </View>
        ) : null}
      </View>
    </View>
  )
}

type HeaderStatusProps = Readonly<{
  readonly runtimeStatus: TestExpoRuntimeStatus
  readonly showSecondary: boolean | undefined
  readonly terminalSurfaces: TerminalSurfaces
  readonly testIdPrefix: string
}>

const HeaderStatus = ({
  runtimeStatus,
  showSecondary,
  terminalSurfaces,
  testIdPrefix,
}: HeaderStatusProps) => (
  <View style={styles.headerInfo} testID={`${testIdPrefix}:header-status`}>
    <View style={styles.headerMetricRow}>
      <View style={styles.headerMetric}>
        <View style={[styles.statusIndicator, runtimeStatus === 'started' ? styles.statusIndicatorSuccess : styles.statusIndicatorWarning]} />
        <Text style={styles.headerMetricLabel}>RUNTIME</Text>
        <Text style={styles.headerMetricValue} testID={`${testIdPrefix}:runtime-status`}>
          {runtimeStatus === 'started' ? 'Started' : runtimeStatus === 'failed' ? 'Failed' : 'Starting'}
        </Text>
      </View>
      <View style={styles.headerMetricDivider} />
      <View style={styles.headerMetric}>
        <View style={[styles.statusIndicator, styles.statusIndicatorInfo]} />
        <Text style={styles.headerMetricLabel}>STORE</Text>
        <Text style={styles.headerMetricValue}>同一 assembly</Text>
      </View>
      <View style={styles.headerMetricDivider} />
      <View style={styles.headerMetric}>
        <View style={[styles.statusIndicator, showSecondary ? styles.statusIndicatorSuccess : styles.statusIndicatorMuted]} />
        <Text style={styles.headerMetricLabel}>SURFACES</Text>
        <Text style={styles.headerMetricValue}>{showSecondary ? '2 个 Root' : showSecondary === false ? '1 个 Root' : '读取中'}</Text>
      </View>
    </View>
    <View style={styles.headerSurfaceRow}>
      <View style={[styles.headerSurface, styles.headerPrimarySurface]} testID={`${testIdPrefix}:surface-summary:PRIMARY`}>
        <View style={[styles.surfaceDot, styles.primaryDot]} />
        <Text style={styles.headerSurfaceText}>
          主屏 · {terminalSurfaces.surfaces.PRIMARY.width} × {terminalSurfaces.surfaces.PRIMARY.height}
        </Text>
        <Text style={styles.headerSurfaceState}>已挂载</Text>
      </View>
      <View style={[styles.headerSurface, showSecondary ? styles.headerSecondarySurface : styles.headerInactiveSurface]} testID={`${testIdPrefix}:surface-summary:SECONDARY`}>
        <View style={[styles.surfaceDot, showSecondary ? styles.secondaryDot : styles.inactiveDot]} />
        <Text style={styles.headerSurfaceText}>
          客显 · {terminalSurfaces.surfaces.SECONDARY.width} × {terminalSurfaces.surfaces.SECONDARY.height}
        </Text>
        <Text style={[styles.headerSurfaceState, !showSecondary && styles.inactiveText]}>
          {showSecondary ? '已挂载' : showSecondary === false ? '未启用' : '读取中'}
        </Text>
      </View>
    </View>
  </View>
)

const HostStateCard = ({
  kind,
  title,
  description,
  testID,
}: Readonly<{
  readonly kind: 'error' | 'pending'
  readonly title: string
  readonly description: string
  readonly testID: string
}>) => (
  <View style={[styles.hostStateCard, kind === 'error' ? styles.hostErrorCard : styles.hostPendingCard]}>
    <View style={[styles.stateGlyph, kind === 'error' ? styles.errorGlyph : styles.pendingGlyph]}>
      {kind === 'error' ? <Text style={styles.errorGlyphText}>!</Text> : <Text style={styles.pendingGlyphText}>···</Text>}
    </View>
    <View style={styles.hostStateCopy}>
      <Text style={styles.hostStateTitle} testID={testID}>{title}</Text>
      <Text style={styles.hostStateDescription}>{description}</Text>
    </View>
  </View>
)

export const createTestExpoApp = <TAssembly extends TestExpoAssembly>(
  options: TestExpoAppOptions<TAssembly>,
): FC => {
  const testIdPrefix = `${options.appName}:test-expo`
  const persistenceKey = options.persistenceKey ?? `${options.appName}-web`

  const TestExpoApp: FC = () => {
    const [surfaceMode, setSurfaceMode] = useState<SurfaceMode>('single')
    const surfaceModeRef = useRef<SurfaceMode>(surfaceMode)
    surfaceModeRef.current = surfaceMode
    const [assembly, setAssembly] = useState<TAssembly | undefined>()
    const [startupError, setStartupError] = useState(false)
    const [showSecondary, setShowSecondary] = useState<boolean | undefined>()
    const platformPorts = useMemo(
      () => createWebPlatformPorts(() => surfaceModeRef.current, {
        storageNamespace: options.appName,
      }),
      [],
    )

    useEffect(() => {
      let active = true
      void options.createAssembly({platformPorts, persistenceKey}).then((nextAssembly) => {
        if (!active) return
        setAssembly(nextAssembly)
        platformPorts.logger.info({
          category: `${options.appName}.test-expo`,
          event: 'startup-ready',
          data: {runtimeStatus: options.getRuntimeStatus(nextAssembly)},
        })
      }).catch(() => {
        if (!active) return
        setStartupError(true)
        platformPorts.logger.error({
          category: `${options.appName}.test-expo`,
          event: 'startup-failed',
          message: `${options.appName} startup failed`,
        })
      })
      return () => { active = false }
    }, [platformPorts])

    useEffect(() => {
      if (assembly === undefined) return
      let active = true
      void readDisplayInfo(platformPorts.device).then((displayInfo) => {
        if (!active) return
        setShowSecondary(resolveSecondarySurfaceAvailable(displayInfo))
        platformPorts.logger.info({
          category: `${options.appName}.test-expo`,
          event: 'surface-decision-ready',
          data: {displayInfoStatus: displayInfo.status},
        })
      })
      return () => { active = false }
    }, [assembly, platformPorts, surfaceMode])

    const runtimeStatus = startupError
      ? 'failed'
      : assembly === undefined
        ? 'starting'
        : options.getRuntimeStatus(assembly)
    return (
      <View style={styles.root} testID={`${testIdPrefix}:root`}>
        <View style={styles.scroll}>
          <View style={styles.content}>
            <View style={styles.stageHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>LIVE SURFACE PREVIEW</Text>
                <Text style={styles.stageTitle}>{options.title}</Text>
              </View>
              <View style={styles.stageHeaderRight}>
                <HeaderStatus
                  runtimeStatus={runtimeStatus}
                  showSecondary={showSecondary}
                  terminalSurfaces={options.terminalSurfaces}
                  testIdPrefix={testIdPrefix}
                />
                <View style={styles.toolbarActions}>
                  <View style={styles.modePill}>
                    <View style={styles.modePillDot} />
                    <Text style={styles.modePillLabel} testID={`${testIdPrefix}:surface-mode`}>
                      {surfaceMode === 'dual' ? '双屏模式' : '单屏模式'}
                    </Text>
                  </View>
                  <Pressable
                    testID={`${testIdPrefix}:surface-toggle`}
                    accessibilityRole="button"
                    accessibilityLabel="切换单屏双屏"
                    accessibilityHint={surfaceMode === 'dual' ? '切换为单屏并保留当前运行时' : '切换为双屏并保留当前运行时'}
                    onPress={() => setSurfaceMode((current) => current === 'single' ? 'dual' : 'single')}
                    style={({pressed}) => [styles.modeButton, pressed && styles.modeButtonPressed]}
                  >
                    <Text style={styles.modeButtonText}>
                      {surfaceMode === 'dual' ? '切换为单屏' : '切换为双屏'}
                    </Text>
                    <Text style={styles.modeButtonArrow}>→</Text>
                  </Pressable>
                </View>
              </View>
            </View>
            {startupError ? (
              <HostStateCard
                kind="error"
                testID={`${testIdPrefix}:start-error`}
                title={`${options.appName} 启动失败`}
                description="请查看启动日志后重试；业务 surface 尚未挂载。"
              />
            ) : assembly === undefined ? (
              <HostStateCard
                kind="pending"
                testID={`${testIdPrefix}:start-pending`}
                title={`${options.appName} 启动中`}
                description="正在组装 runtime、目录与业务模块，完成后会挂载主屏。"
              />
            ) : showSecondary === undefined ? (
              <HostStateCard
                kind="pending"
                testID={`${testIdPrefix}:display-pending`}
                title="正在读取屏幕信息"
                description="外壳正在决定是否挂载客显；这一步不改变业务模块与 runtime。"
              />
            ) : (
              <>
                <SurfaceCanvas
                  assembly={assembly}
                  showSecondary={showSecondary}
                  terminalSurfaces={options.terminalSurfaces}
                  testIdPrefix={testIdPrefix}
                />
                <Text style={styles.stageFooter}>
                  逻辑尺寸固定 · 外层按配置排布 · 内部由业务组件负责内容
                </Text>
              </>
            )}
          </View>
        </View>
      </View>
    )
  }

  return TestExpoApp
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.canvas,
  },
  scroll: {
    flex: 1,
    width: '100%',
    overflow: 'scroll',
  },
  headerInfo: {
    flex: 1,
    minWidth: 280,
    gap: 4,
    alignItems: 'flex-end',
  },
  headerMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 7,
  },
  headerMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerMetricDivider: {
    width: 1,
    height: 13,
    backgroundColor: COLORS.border,
  },
  headerMetricLabel: {
    color: COLORS.inkMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerMetricValue: {
    color: COLORS.ink,
    fontSize: 10,
    fontWeight: '700',
  },
  headerSurfaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 7,
  },
  headerSurface: {
    minHeight: 22,
    paddingHorizontal: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  headerPrimarySurface: {
    backgroundColor: COLORS.primarySoft,
    borderColor: '#2E81C4',
  },
  headerSecondarySurface: {
    backgroundColor: COLORS.secondarySoft,
    borderColor: '#27AFA4',
  },
  headerInactiveSurface: {
    backgroundColor: COLORS.canvasRaised,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  headerSurfaceText: {
    color: COLORS.ink,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  headerSurfaceState: {
    color: COLORS.success,
    fontSize: 9,
    fontWeight: '800',
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stageHeaderRight: {
    flex: 1,
    minWidth: 460,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 16,
  },
  modePill: {
    minHeight: 36,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 18,
    backgroundColor: '#0D263B',
    borderWidth: 1,
    borderColor: '#2E6287',
  },
  modePillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  modePillLabel: {
    color: COLORS.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  modeButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#116EA9',
    borderWidth: 1,
    borderColor: '#45C9FF',
    boxShadow: '0px 4px 12px rgba(30, 183, 245, 0.28)',
  },
  modeButtonPressed: {
    opacity: 0.78,
  },
  modeButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  modeButtonArrow: {
    color: '#BFD7FF',
    fontSize: 18,
    lineHeight: 18,
  },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 18,
  },
  statusIndicator: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusIndicatorSuccess: {
    backgroundColor: COLORS.success,
  },
  statusIndicatorWarning: {
    backgroundColor: COLORS.warning,
  },
  statusIndicatorInfo: {
    backgroundColor: COLORS.primary,
  },
  statusIndicatorMuted: {
    backgroundColor: COLORS.borderStrong,
  },
  sectionEyebrow: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  surfaceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  primaryDot: {
    backgroundColor: COLORS.primary,
  },
  secondaryDot: {
    backgroundColor: COLORS.secondary,
  },
  inactiveDot: {
    backgroundColor: COLORS.borderStrong,
  },
  inactiveText: {
    color: COLORS.inkMuted,
  },
  stageHeader: {
    width: '100%',
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 24,
  },
  stageTitle: {
    marginTop: 3,
    color: COLORS.ink,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  canvas: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#0A2236',
    borderWidth: 2,
    borderColor: '#368DD0',
    boxShadow: '0px 0px 14px rgba(24, 152, 211, 0.22)',
  },
  responsiveStage: {
    width: '100%',
    padding: 10,
    gap: 12,
  },
  surface: {
    borderWidth: 1,
    borderRadius: 2,
    overflow: 'hidden',
  },
  primarySurface: {
    backgroundColor: '#F7FBFF',
    borderColor: '#3792F4',
  },
  secondarySurface: {
    backgroundColor: '#E9FFFF',
    borderColor: '#24B9AE',
  },
  stageFooter: {
    width: '100%',
    marginTop: 12,
    color: '#82A8BF',
    fontSize: 11,
    textAlign: 'center',
  },
  hostStateCard: {
    width: '100%',
    minHeight: 132,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  hostPendingCard: {
    backgroundColor: '#102C47',
    borderColor: '#2E81C4',
  },
  hostErrorCard: {
    backgroundColor: COLORS.dangerSoft,
    borderColor: '#A94752',
  },
  stateGlyph: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  pendingGlyph: {
    backgroundColor: '#173A58',
  },
  pendingGlyphText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  errorGlyph: {
    backgroundColor: COLORS.danger,
  },
  errorGlyphText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '800',
  },
  hostStateCopy: {
    flex: 1,
  },
  hostStateTitle: {
    color: COLORS.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  hostStateDescription: {
    marginTop: 5,
    color: COLORS.inkMuted,
    fontSize: 13,
    lineHeight: 20,
  },
})
