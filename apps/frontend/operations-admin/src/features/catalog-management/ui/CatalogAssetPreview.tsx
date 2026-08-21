import {Button, Image, Skeleton, Typography} from 'antd';
import {useEffect, useMemo, useState} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {publicRtkRequest} from '../../../app/api/generated/public-edge.rtk';
import {wireUuid} from '../../../app/api/wireUuid';

type Props = {
  assetRef?: string;
  /** Newly selected files are previewed locally until the catalog save claims them. */
  localFile?: File;
  alt: string;
  width: number;
  height: number;
  preview?: boolean;
  testId?: string;
};

/** Resolves the opaque asset reference through the generated public asset operation. */
export function CatalogAssetPreview({assetRef, localFile, alt, width, height, preview = true, testId}: Props) {
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string>();
  useEffect(() => {
    if (!localFile) {
      setLocalPreviewUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(localFile);
    setLocalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [localFile]);

  const request = useMemo(
    () => (assetRef ? publicRtkRequest.getPublicAssetContent({assetRef: wireUuid(assetRef)}, {}) : undefined),
    [assetRef],
  );
  const assetQuery = operationsRtk.useGetPublicAssetContentQuery(request!, {
    skip: Boolean(localFile || !assetRef || !request),
  });
  const publicUrl = assetQuery.data?.publicUrl;
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [assetRef, localPreviewUrl, publicUrl]);

  const frameStyle = {width, height, display: 'grid', placeItems: 'center', overflow: 'hidden'} as const;
  if (localFile && !localPreviewUrl)
    return (
      <span style={frameStyle} role="status" aria-label={`${alt}加载中`} data-testid={testId}>
        <Skeleton.Image active style={{width, height}} />
      </span>
    );
  if (assetQuery.isLoading || assetQuery.isFetching)
    return (
      <span style={frameStyle} role="status" aria-label={`${alt}加载中`} data-testid={testId}>
        <Skeleton.Image active style={{width, height}} />
      </span>
    );
  const sourceUrl = localPreviewUrl ?? publicUrl;
  if (!sourceUrl || (!localPreviewUrl && assetQuery.isError) || imageFailed)
    return (
      <span style={frameStyle} role="status" aria-label={`${alt}不可用`} data-testid={testId}>
        <Typography.Text type="secondary" style={{fontSize: 12}}>
          图片不可用
        </Typography.Text>
        <Button
          size="small"
          type="link"
          data-testid={testId ? `${testId}-retry` : undefined}
          onClick={() => {
            setImageFailed(false);
            if (!localPreviewUrl && assetRef) void assetQuery.refetch();
          }}
        >
          重试加载
        </Button>
      </span>
    );
  return (
    <Image
      width={width}
      height={height}
      src={sourceUrl}
      alt={alt}
      preview={preview}
      style={{objectFit: 'cover'}}
      onError={() => setImageFailed(true)}
      data-testid={testId}
    />
  );
}
