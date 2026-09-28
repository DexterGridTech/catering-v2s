import {describe, expect, it} from 'vitest';
import {buildPortUnits, portCategoryLabels, portCategoryOrder} from '../src/foundations/portProjection';

describe('platform port unit projection', () => {
  it('freezes the five IA categories and their visual order', () => {
    expect(portCategoryOrder).toEqual(['logs', 'device', 'connection', 'system', 'release']);
    expect(portCategoryLabels).toMatchObject({
      logs: '日志与诊断',
      device: '设备与系统',
      connection: '连接与拓扑',
      system: '存储与状态',
      release: '脚本与更新',
    });
  });

  it('preserves one unit per declared capability and adds one synthetic unit for undeclared ports', () => {
    const units = buildPortUnits([
      {
        port: 'logger',
        descriptorStatus: 'complete',
        capabilities: [{capability: 'info', state: 'real', source: 'adapter'}],
      },
      {
        port: 'device',
        descriptorStatus: 'complete',
        capabilities: [
          {capability: 'display', state: 'unavailable', source: 'default'},
          {capability: 'power', state: 'real', source: 'adapter'},
        ],
      },
      {port: 'script', descriptorStatus: 'missing-descriptor', capabilities: []},
    ]);

    expect(units).toEqual([
      {
        unitKey: 'logger:info',
        port: 'logger',
        capability: 'info',
        state: 'available',
        source: 'adapter',
        category: 'logs',
      },
      {
        unitKey: 'device:display',
        port: 'device',
        capability: 'display',
        state: 'unavailable',
        source: 'default',
        category: 'device',
      },
      {
        unitKey: 'device:power',
        port: 'device',
        capability: 'power',
        state: 'available',
        source: 'adapter',
        category: 'device',
      },
      {
        unitKey: 'script:undeclared',
        port: 'script',
        capability: null,
        state: 'undeclared',
        source: null,
        category: 'release',
      },
    ]);
    expect(units.filter(unit => unit.state === 'available')).toHaveLength(2);
    expect(units.filter(unit => unit.state === 'unavailable')).toHaveLength(1);
    expect(units.filter(unit => unit.state === 'undeclared')).toHaveLength(1);
  });

  it('keeps an unknown port visible as unmapped instead of dropping it', () => {
    const units = buildPortUnits([
      {port: 'futurePort' as never, descriptorStatus: 'missing-descriptor', capabilities: []},
    ]);
    expect(units[0]).toMatchObject({port: 'futurePort', category: 'unmapped', state: 'undeclared'});
  });
});
