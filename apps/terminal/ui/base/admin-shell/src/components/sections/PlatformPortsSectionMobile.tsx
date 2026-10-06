import {useMemo, useState} from 'react';
import {
  PrimitiveCard,
  PrimitiveContainer,
  PrimitiveDisclosure,
  PrimitiveFactGrid,
  PrimitiveHeading,
  PrimitiveRatioBar,
  PrimitiveScrollView,
  PrimitiveStatusLine,
  PrimitiveStatus,
  PrimitivePortItem,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives';
import type {AdminSectionProps} from '../../types/adminSection';
import {
  buildPortUnits,
  portCategoryLabels,
  portCategoryOrder,
  type PortUnit,
  type PortUnitCategory,
} from '../../foundations/portProjection';
import {portsFrameId, useReportAdminFrame} from '../../foundations/adminFrameRegistry';
import {adminTestIds} from '../../foundations/adminTestIds';

const sectionStyle = Object.freeze({flex: 1, minHeight: 0, minWidth: 0});

const stateLabelOf = (state: PortUnit['state']): string =>
  state === 'available' ? '可用' : state === 'unavailable' ? '不可用' : '未声明';
const toneOf = (state: PortUnit['state']): 'ok' | 'warn' => (state === 'available' ? 'ok' : 'warn');
const unitLabelOf = (unit: PortUnit): string =>
  unit.capability === null ? unit.port : `${unit.port}.${unit.capability}`;
const categoryUnitsOf = (units: readonly PortUnit[], category: PortUnitCategory): readonly PortUnit[] =>
  units.filter(unit => unit.category === category);
const reasonLabelOf = (state: PortUnit['state']): string =>
  state === 'available' ? '无阻断' : state === 'unavailable' ? '能力不可用' : '能力描述未提供';

export const PlatformPortsSectionMobile = ({context}: AdminSectionProps) => {
  const units = useMemo(
    () => buildPortUnits(context.runtimeFacts.platformPortCapabilities),
    [context.runtimeFacts.platformPortCapabilities],
  );
  const [expandedCategory, setExpandedCategory] = useState<PortUnitCategory | null>(null);
  const frameId = portsFrameId('mobile', expandedCategory !== null);
  useReportAdminFrame(frameId);
  const available = units.filter(unit => unit.state === 'available').length;
  const unavailable = units.filter(unit => unit.state === 'unavailable').length;
  const undeclared = units.filter(unit => unit.state === 'undeclared').length;
  return (
    <PrimitiveContainer
      testID={adminTestIds.ports.contentRoot}
      layout="content"
      appearance="admin-content"
      bounded
      style={sectionStyle}
    >
      <PrimitiveScrollView testID={adminTestIds.node('admin.console.platform-ports:scroll')}>
        <PrimitiveHeading appearance="admin-page" testID={adminTestIds.ports.title}>
          {context.catalogEntry.title}
        </PrimitiveHeading>
        <PrimitiveCard appearance="admin" testID={adminTestIds.node('admin.console.platform-ports:summary-card')}>
          <PrimitiveStatusLine testID={adminTestIds.ports.overallStatus} tone={units.length === 0 ? 'warn' : 'ok'}>
            能力状态总览
          </PrimitiveStatusLine>
          <PrimitiveText appearance="admin-muted" testID={adminTestIds.node('admin.console.platform-ports:total')}>
            共 {units.length} 项能力单位
          </PrimitiveText>
          <PrimitiveRatioBar
            testID={adminTestIds.ports.summary.ratioBar}
            accessibilityLabel="平台端口能力比例"
            total={units.length}
            segments={[
              {key: 'available', label: '可用', value: available, tone: 'ok'},
              {key: 'unavailable', label: '不可用', value: unavailable, tone: 'warn'},
              {key: 'undeclared', label: '未声明', value: undeclared, tone: 'neutral'},
            ]}
          />
          <PrimitiveFactGrid
            testID={adminTestIds.ports.summary.grid}
            columns={1}
            items={[
              {
                key: 'available',
                testID: adminTestIds.ports.summary.available,
                label: '可用',
                value: String(available),
                tone: 'ok',
              },
              {
                key: 'unavailable',
                testID: adminTestIds.ports.summary.unavailable,
                label: '不可用',
                value: String(unavailable),
                tone: 'warn',
              },
              {
                key: 'undeclared',
                testID: adminTestIds.ports.summary.undeclared,
                label: '未声明',
                value: String(undeclared),
                tone: 'neutral',
              },
            ]}
          />
          {units.length === 0 ? (
            <PrimitiveText appearance="admin-muted" testID={adminTestIds.node('admin.console.platform-ports:empty')}>
              暂无端口能力
            </PrimitiveText>
          ) : null}
        </PrimitiveCard>
        {portCategoryOrder.map(category => {
          const categoryUnits = categoryUnitsOf(units, category);
          const isExpanded = expandedCategory === category;
          return (
            <PrimitiveDisclosure
              key={category}
              testID={adminTestIds.ports.category(category, 'row')}
              triggerTestID={adminTestIds.ports.category(category, 'expand')}
              statusTestID={adminTestIds.ports.category(category, 'status')}
              summaryTestID={adminTestIds.ports.category(category, 'count')}
              accessibilityLabel={`展开${portCategoryLabels[category]}`}
              label={portCategoryLabels[category]}
              summary={`${categoryUnits.length} 项`}
              status={
                categoryUnits.some(unit => unit.state === 'available')
                  ? '有可用能力'
                  : categoryUnits.some(unit => unit.state === 'unavailable')
                    ? '有不可用能力'
                    : categoryUnits.some(unit => unit.state === 'undeclared')
                      ? '未声明能力'
                      : '暂无能力'
              }
              expanded={isExpanded}
              onExpandedChange={next => setExpandedCategory(next ? category : null)}
            >
              {categoryUnits.length === 0 ? (
                <PrimitiveText testID={adminTestIds.ports.category(category, 'empty')}>暂无能力</PrimitiveText>
              ) : (
                categoryUnits.map(unit => (
                  <PrimitivePortItem
                    key={unit.unitKey}
                    testID={adminTestIds.node(`terminal.admin:ports:item:${unit.unitKey}`)}
                    name={unitLabelOf(unit)}
                    status={stateLabelOf(unit.state)}
                    reason={reasonLabelOf(unit.state)}
                    source={unit.source ?? '来源未提供'}
                    tone={toneOf(unit.state)}
                  />
                ))
              )}
            </PrimitiveDisclosure>
          );
        })}
        {units.some(unit => unit.category === 'unmapped') ? (
          <PrimitiveStatus
            appearance="admin"
            testID={adminTestIds.node('admin.console.platform-ports:unmapped')}
            tone="warn"
          >
            存在未归类端口能力
          </PrimitiveStatus>
        ) : null}
      </PrimitiveScrollView>
    </PrimitiveContainer>
  );
};
