import {RnrView} from '../vendor/slots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveContainerProps} from '../types/types';

export const PrimitiveContainer = ({testID, children, layout = 'fill'}: PrimitiveContainerProps) => (
  <RnrView
    testID={assertTestID(testID)}
    className={
      layout === 'content'
        ? baseTokens.containerContent
        : layout === 'card'
          ? baseTokens.containerCard
          : layout === 'centered'
            ? baseTokens.containerCentered
            : baseTokens.container
    }
  >
    {children}
  </RnrView>
);
