import {RnrImage} from '../foundations/nativeSlots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveImageProps} from '../types/types';

export const PrimitiveImage = ({
  testID,
  accessibilityLabel,
  layout = 'thumbnail',
  resizeMode = layout === 'background' ? 'cover' : 'contain',
  source,
  style,
}: PrimitiveImageProps) => {
  if (source === undefined) return null;
  return (
    <RnrImage
      testID={assertTestID(testID)}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      source={source}
      resizeMode={resizeMode}
      style={style}
      className={layout === 'background' ? baseTokens.imageBackground : undefined}
    />
  );
};
