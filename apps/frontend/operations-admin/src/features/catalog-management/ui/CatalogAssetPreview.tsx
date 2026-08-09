import {Button, Image, Skeleton, Typography} from 'antd';
import {useEffect, useMemo, useState} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {publicRtkRequest} from '../../../app/api/generated/public-edge.rtk';

type Props = {
  assetRef: string;
  alt: string;
  width: number;
  height: number;
  preview?: boolean;
  testId?: string;
};

/** Resolves the opaque asset reference through the generated public asset operation. */
export function CatalogAssetPreview({assetRef, alt, width, height, preview = true, testId}: Props) {
  const request = useMemo(() => publicRtkRequest.getPublicAssetContent({assetRef}, {}), [assetRef]);
  const assetQuery = operationsRtk.useGetPublicAssetContentQuery(request);
  const publicUrl = assetQuery.data?.publicUrl;
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => { setImageFailed(false); }, [assetRef, publicUrl]);

  const frameStyle = {width, height, display: 'grid', placeItems: 'center', overflow: 'hidden'} as const;
  if (assetQuery.isLoading || assetQuery.isFetching) return <span style={frameStyle} role="status" aria-label={`${alt}加载中`} data-testid={testId}><Skeleton.Image active style={{width, height}}/></span>;
  if (!publicUrl || assetQuery.isError || imageFailed) return <span style={frameStyle} role="status" aria-label={`${alt}不可用`} data-testid={testId}><Typography.Text type="secondary" style={{fontSize: 12}}>图片不可用</Typography.Text><Button size="small" type="link" data-testid={testId ? `${testId}-retry` : undefined} onClick={() => { setImageFailed(false); void assetQuery.refetch(); }}>重试加载</Button></span>;
  return <Image width={width} height={height} src={publicUrl} alt={alt} preview={preview} style={{objectFit: 'cover'}} onError={() => setImageFailed(true)} data-testid={testId}/>;
}
