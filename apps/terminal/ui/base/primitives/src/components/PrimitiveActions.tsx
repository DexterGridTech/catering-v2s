import {RnrView} from '../vendor/slots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveActionsProps} from '../types/types';

export const PrimitiveActions = ({testID, children}: PrimitiveActionsProps) => (
  <RnrView testID={assertTestID(testID)} className={baseTokens.actions}>
    {children}
  </RnrView>
);
