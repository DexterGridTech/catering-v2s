import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminImageCollectionEditor} from './AdminImageCollectionEditor';

describe('AdminImageCollectionEditor', () => {
  it('renders injected image labels, previews, states, and keyboard-operable actions', () => {
    const markup = renderToStaticMarkup(
      <AdminImageCollectionEditor
        items={[
          {id: 'asset-1', identity: 'asset-1', fileName: 'ready.png', status: 'READY', hasPreview: true},
          {
            id: 'asset-2',
            identity: 'asset-2',
            fileName: 'failed.png',
            status: 'FAILED',
            hasPreview: false,
            file: {name: 'failed.png'} as File,
          },
        ]}
        limits={{maxImageCount: 6, maxImageBytes: 2 * 1024 * 1024}}
        labels={{
          title: '图片',
          formatLimits: (count, limits) => `${count}/${limits.maxImageCount}`,
          loading: '规则加载中',
          atLimit: '已达上限',
          upload: '上传图片',
          empty: '未配置图片',
          pendingPreview: () => <span>待上传</span>,
          renderPreview: (item, _index, previewTestId) => <span data-testid={previewTestId}>{item.fileName}预览</span>,
          renderStatus: item => <span>{item.status}</span>,
          positionLabel: index => (index === 0 ? '★ 主图' : `附图 ${index}`),
          replace: '替换',
          retry: '重试',
          moveUp: '上移',
          moveDown: '下移',
          setPrimary: '设为主图',
          remove: '移除',
        }}
        testIds={{
          root: 'image-editor',
          upload: 'image-upload',
          list: 'image-list',
          item: (identity, action) => `image-${identity}-${action}`,
        }}
        onStageMedia={async () => undefined}
        onRemoveMedia={() => undefined}
        onMoveMedia={() => undefined}
        onSetPrimaryMedia={() => undefined}
      />,
    );

    expect(markup).toContain('data-testid="image-editor"');
    expect(markup).toContain('data-testid="image-upload"');
    expect(markup).toMatch(/<input[^>]*data-testid="image-upload"[^>]*type="file"/);
    expect(markup).toContain('data-testid="image-list"');
    expect(markup).toContain('data-testid="image-asset-1-row"');
    expect(markup).toContain('data-testid="image-asset-2-retry"');
    expect(markup).toContain('上传图片');
    expect(markup).toContain('ready.png预览');
    expect(markup).toContain('FAILED');
    expect(markup.replace(/\s/g, '')).toContain('重试');
    const compactMarkup = markup.replace(/\s/g, '');
    expect(compactMarkup).toContain('上移');
    expect(compactMarkup).toContain('下移');
    expect(compactMarkup).toContain('设为主图');
    expect(markup.replace(/\s/g, '')).toContain('移除');
  });

  it('keeps the first image as primary when more than one image exists', () => {
    const markup = renderToStaticMarkup(
      <AdminImageCollectionEditor
        items={[
          {id: 'asset-1', identity: 'asset-1', fileName: 'one.png', status: 'READY', hasPreview: false},
          {id: 'asset-2', identity: 'asset-2', fileName: 'two.png', status: 'READY', hasPreview: false},
        ]}
        limits={{maxImageCount: 6, maxImageBytes: 2 * 1024 * 1024}}
        labels={{
          title: '图片',
          formatLimits: count => String(count),
          loading: '规则加载中',
          atLimit: '已达上限',
          upload: '上传图片',
          empty: '未配置图片',
          pendingPreview: () => null,
          renderPreview: () => null,
          renderStatus: () => null,
          positionLabel: index => String(index),
          replace: '替换',
          retry: '重试',
          moveUp: '上移',
          moveDown: '下移',
          setPrimary: '设为主图',
          remove: '移除',
        }}
        testIds={{item: (identity, action) => `image-${identity}-${action}`}}
        onStageMedia={async () => undefined}
        onRemoveMedia={() => undefined}
        onMoveMedia={() => undefined}
        onSetPrimaryMedia={() => undefined}
      />,
    );

    expect(markup).toMatch(/data-testid="image-asset-1-remove"[^>]*disabled/);
    expect(markup).toContain('data-testid="image-asset-2-set-primary"');
  });
});
