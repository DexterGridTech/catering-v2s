import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import type {StoreTerminalDetail} from '../../../app/api/generated/operations-edge';
import {StoreTerminalDetail as StoreTerminalDetailView} from './StoreTerminalDetail';
import {storeTerminalTestIds} from '../storeTerminalTestIds';

const detail = {
  terminalRef: '11111111-1111-4111-8111-111111111111',
  storeRef: '22222222-2222-4222-8222-222222222222',
  name: '前台终端',
  deviceType: 'laptop',
  status: 'ENABLED',
  activationCode: '01234567',
  areaReferences: [],
  tagReferences: [],
  version: 3,
  updatedAt: 1727000000000,
  configuration: {
    printers: [
      {
        ref: '33333333-3333-4333-8333-333333333333',
        name: '前台热敏',
        brandKey: 'EPSON',
        modelKey: 'EPSON_TM_T88VII',
        paperSpecKey: 'THERMAL_80',
        connectionMethodKey: 'NETWORK',
        connectionParameter: '10.20.0.10',
      },
    ],
    functions: [
      {
        ref: '44444444-4444-4444-8444-444444444444',
        functionKey: 'ORDERING_CASHIER',
        ranges: [{key: 'TABLE_AREA', all: true, refs: []}],
        scenes: [
          {
            sceneKey: 'TABLE_ORDER_TICKET',
            orderTypes: ['DINE_IN'],
            printers: [{printerRef: '33333333-3333-4333-8333-333333333333'}],
          },
        ],
      },
    ],
  },
} as unknown as StoreTerminalDetail;

describe('store terminal detail render', () => {
  it('uses the create-next-step empty copy when the store has no terminal', () => {
    const markup = renderToStaticMarkup(
      <StoreTerminalDetailView
        value={undefined}
        emptyDescription="创建后，在这里查看详情"
        canEdit
        onEdit={() => undefined}
        onStatus={() => undefined}
      />,
    );
    expect(markup).toContain('创建后，在这里查看详情');
    expect(markup).not.toContain('请选择终端');
  });

  it('shows the activation code only in the selected detail surface', () => {
    const markup = renderToStaticMarkup(
      <StoreTerminalDetailView value={detail} canEdit={false} onEdit={() => undefined} onStatus={() => undefined} />,
    );
    expect(markup).toContain('01234567');
    expect(markup).toContain('前台热敏');
    expect(markup).toContain('全部桌台区');
    expect(markup).toContain('客单（压桌单）');
    expect(markup).toContain('堂食');
    expect(markup).not.toContain('更新时间');
    expect(markup).not.toContain('版本');
  });

  it('hides all write entry points for a readonly role', () => {
    const markup = renderToStaticMarkup(
      <StoreTerminalDetailView value={detail} canEdit={false} onEdit={() => undefined} onStatus={() => undefined} />,
    );
    expect(markup).not.toContain(storeTerminalTestIds.edit);
    expect(markup).not.toContain(storeTerminalTestIds.actionMenu);
  });
});
