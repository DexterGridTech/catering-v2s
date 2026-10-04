import {
  PrimitiveCard,
  PrimitiveGrid,
  PrimitiveImage,
  PrimitiveLabel,
  PrimitiveRadio,
} from '@catering-v2s/ui-base-primitives';
import type {ReactElement} from 'react';
import {assetsById} from '../foundations/assets';
import {wallpaperIds, wallpaperLabels} from '../foundations/wallpaperCatalog';
import type {WallpaperId} from '@catering-v2s/kernel-feature-sample-wallpaper';

export const WallpaperOptionCards = (
  props: Readonly<{
    readonly testID: string;
    readonly optionTestId: (wallpaperId: WallpaperId) => string;
    readonly selected: WallpaperId | undefined;
    readonly onSelect: (wallpaperId: WallpaperId) => void;
    readonly style: Readonly<Record<string, unknown>>;
    readonly cardStyle: Readonly<Record<string, unknown>>;
    readonly thumbnailStyle: Readonly<Record<string, unknown>>;
  }>,
): ReactElement => (
  <PrimitiveGrid testID={props.testID} accessibilityLabel="壁纸选项" accessibilityRole="tablist" style={props.style}>
    {wallpaperIds.map(wallpaperId => {
      const source = assetsById[wallpaperId];
      const optionTestId = props.optionTestId(wallpaperId);
      return (
        <PrimitiveCard key={wallpaperId} testID={`${optionTestId}:card`} style={props.cardStyle}>
          <PrimitiveRadio
            testID={optionTestId}
            accessibilityLabel={wallpaperLabels[wallpaperId]}
            selected={props.selected === wallpaperId}
            onSelectedChange={() => props.onSelect(wallpaperId)}
          />
          {source === undefined ? null : (
            <PrimitiveImage
              testID={`${optionTestId}:thumbnail`}
              accessibilityLabel={`${wallpaperLabels[wallpaperId]}缩略图`}
              source={source}
              layout="thumbnail"
              resizeMode="contain"
              style={props.thumbnailStyle}
            />
          )}
          <PrimitiveLabel testID={`${optionTestId}:label`}>{wallpaperLabels[wallpaperId]}</PrimitiveLabel>
        </PrimitiveCard>
      );
    })}
  </PrimitiveGrid>
);
