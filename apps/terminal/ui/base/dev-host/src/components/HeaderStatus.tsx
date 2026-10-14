import {Text, View} from 'react-native';
import type {TestId} from '@catering-v2s/ui-base-primitives';
import type {SurfaceForm, TerminalSurfaces, TestExpoRuntimeStatus} from '../types/testExpoApp';
import {resolveSurfaceGroup} from './surfaceGroup';
import {styles} from './testExpoAppStyles';

type HeaderStatusProps = Readonly<{
  readonly runtimeStatus: TestExpoRuntimeStatus;
  readonly showSecondary: boolean | undefined;
  readonly surfaceForm: SurfaceForm;
  readonly terminalSurfaces: TerminalSurfaces;
  readonly makeTestId: (element: string, key?: string) => TestId;
}>;

export const HeaderStatus = ({runtimeStatus, showSecondary, surfaceForm, terminalSurfaces, makeTestId}: HeaderStatusProps) => {
  const {primary, secondary} = resolveSurfaceGroup(terminalSurfaces, surfaceForm);
  return (
    <View style={styles.headerInfo} testID={makeTestId('header-status')}>
      <View style={styles.headerMetricRow}>
        <View style={styles.headerMetric}>
          <View
            style={[
              styles.statusIndicator,
              runtimeStatus === 'started' ? styles.statusIndicatorSuccess : styles.statusIndicatorWarning,
            ]}
          />
          <Text style={styles.headerMetricLabel}>RUNTIME</Text>
          <Text style={styles.headerMetricValue} testID={makeTestId('runtime-status')}>
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
          <View
            style={[
              styles.statusIndicator,
              showSecondary ? styles.statusIndicatorSuccess : styles.statusIndicatorMuted,
            ]}
          />
          <Text style={styles.headerMetricLabel}>SURFACES</Text>
          <Text style={styles.headerMetricValue}>
            {showSecondary ? '2 个 Root' : showSecondary === false ? '1 个 Root' : '读取中'}
          </Text>
        </View>
      </View>
      <View style={styles.headerSurfaceRow}>
        <View
          style={[styles.headerSurface, styles.headerPrimarySurface]}
          testID={makeTestId('surface-summary', 'PRIMARY')}
        >
          <View style={[styles.surfaceDot, styles.primaryDot]} />
          <Text style={styles.headerSurfaceText}>
            {surfaceForm === 'laptop' ? '主屏' : '手持屏'} · {primary.width} × {primary.height}
          </Text>
          <Text style={styles.headerSurfaceState}>已挂载</Text>
        </View>
        {surfaceForm === 'laptop' ? (
          <View
            style={[styles.headerSurface, showSecondary ? styles.headerSecondarySurface : styles.headerInactiveSurface]}
            testID={makeTestId('surface-summary', 'SECONDARY')}
          >
            <View style={[styles.surfaceDot, showSecondary ? styles.secondaryDot : styles.inactiveDot]} />
            <Text style={styles.headerSurfaceText}>
              客显 · {secondary.width} × {secondary.height}
            </Text>
            <Text style={[styles.headerSurfaceState, !showSecondary && styles.inactiveText]}>
              {showSecondary ? '已挂载' : showSecondary === false ? '未启用' : '读取中'}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

