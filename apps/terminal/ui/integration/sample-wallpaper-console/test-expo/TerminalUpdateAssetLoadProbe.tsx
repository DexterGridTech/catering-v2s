import {useCallback, useMemo, useState} from 'react';
import {Image, View} from 'react-native';
import {assetsById} from '@catering-v2s/ui-feature-sample-wallpaper-picker';
import {PrimitiveLabel} from '@catering-v2s/ui-base-primitives';
import {wallpaperContentTestIds} from '@catering-v2s/ui-feature-sample-wallpaper-picker/test-ids';
import type {WallpaperId} from '@catering-v2s/ui-feature-sample-wallpaper-picker';

/** Test-host-only observation that proves the bundled wallpaper assets reach RN's native image loader. */
export const TerminalUpdateAssetLoadProbe = () => {
  const assets = useMemo(
    () => (Object.keys(assetsById) as WallpaperId[]).flatMap(id => {
      const source = assetsById[id];
      return source === undefined ? [] : [{id, source}];
    }),
    [],
  );
  const [loadedIds, setLoadedIds] = useState<readonly string[]>([]);
  const [failedIds, setFailedIds] = useState<readonly string[]>([]);
  const markLoaded = useCallback((id: WallpaperId) => {
    setLoadedIds(current => current.includes(id) ? current : [...current, id]);
  }, []);
  const markFailed = useCallback((id: WallpaperId) => {
    setFailedIds(current => current.includes(id) ? current : [...current, id]);
  }, []);

  return (
    <View pointerEvents="none" style={{position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 4}}>
      {assets.map(({id, source}) => (
        <Image
          key={id}
          accessible={false}
          source={source}
          resizeMode="cover"
          style={{width: 32, height: 32}}
          onLoad={() => markLoaded(id)}
          onError={() => markFailed(id)}
        />
      ))}
      <PrimitiveLabel testID={wallpaperContentTestIds.updateAssetLoadStatus}>
        {`loaded=${loadedIds.length}/${assets.length};failed=${failedIds.length};failedIds=${failedIds.join(',') || 'none'}`}
      </PrimitiveLabel>
    </View>
  );
};
