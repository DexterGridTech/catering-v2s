import {Space, Typography, theme} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {AssetPreview} from '../../../app/components/AssetPreview';
import {salesMenuTestIds} from '../salesMenuTestIds';

export function SalesMenuItemImageGallery({
  itemRef,
  displayName,
  assetRefs,
  mediaLabel,
}: {
  itemRef: string;
  displayName: string;
  assetRefs: readonly string[];
  mediaLabel: string;
}) {
  const {token} = theme.useToken();
  const assetRefsKey = assetRefs.join('\u0000');
  const orderedAssetRefs = useMemo(() => [...new Set(assetRefsKey.split('\u0000').filter(Boolean))], [assetRefsKey]);
  const [selectedAssetRef, setSelectedAssetRef] = useState<string>();
  useEffect(() => {
    setSelectedAssetRef(orderedAssetRefs[0]);
  }, [assetRefsKey, itemRef, orderedAssetRefs]);

  const selectedIndex = Math.max(0, orderedAssetRefs.indexOf(selectedAssetRef ?? ''));
  const selected = orderedAssetRefs[selectedIndex];
  const imageCount = orderedAssetRefs.length;
  const selectedAlt = `${displayName}展示图${imageCount > 1 ? `（第 ${selectedIndex + 1} 张）` : ''}`;

  return (
    <Space direction="vertical" size={8} style={{display: 'flex', minWidth: 0}}>
      <Typography.Text strong>展示图片</Typography.Text>
      {selected ? (
        <AssetPreview
          assetRef={selected}
          alt={selectedAlt}
          width={220}
          height={165}
          testId={salesMenuTestIds.itemMedia(itemRef, 'published-detail-primary')}
        />
      ) : (
        <Typography.Text type="secondary" role="status">
          暂无展示图片
        </Typography.Text>
      )}
      <Space size={4} wrap>
        <Typography.Text type="secondary">{mediaLabel}</Typography.Text>
        <Typography.Text type="secondary">
          {imageCount > 0 ? `共 ${imageCount} 张图片` : '暂无展示图片'}
        </Typography.Text>
      </Space>
      {imageCount > 1 && (
        <Space direction="vertical" size={4} style={{display: 'flex'}}>
          <Typography.Text type="secondary">缩略图（点击切换）</Typography.Text>
          <Space size={8} wrap>
            {orderedAssetRefs.map((assetRef, index) => {
              const active = assetRef === selected;
              return (
                <button
                  key={assetRef}
                  type="button"
                  aria-label={`查看第 ${index + 1} 张展示图片`}
                  aria-pressed={active}
                  {...testId(salesMenuTestIds.itemDetailMediaChoice(itemRef, assetRef))}
                  onClick={() => setSelectedAssetRef(assetRef)}
                  style={{
                    display: 'block',
                    padding: 2,
                    lineHeight: 0,
                    cursor: 'pointer',
                    background: token.colorBgContainer,
                    border: `2px solid ${active ? token.colorPrimary : token.colorBorderSecondary}`,
                    borderRadius: token.borderRadiusSM,
                  }}
                >
                  <AssetPreview
                    assetRef={assetRef}
                    alt={`${displayName}展示图第 ${index + 1} 张`}
                    width={72}
                    height={54}
                    preview={false}
                  />
                </button>
              );
            })}
          </Space>
          <Typography.Text type="secondary">点击大图可查看原图。</Typography.Text>
        </Space>
      )}
    </Space>
  );
}
