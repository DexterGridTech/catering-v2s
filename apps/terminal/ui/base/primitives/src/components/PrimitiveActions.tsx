import {RnrView} from '../vendor/slots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveActionsProps} from '../types/types';

export const PrimitiveActions = ({testID, children, orientation = 'row'}: PrimitiveActionsProps) => (
  <RnrView testID={assertTestID(testID)} className={orientation === 'column' ? baseTokens.actionsColumn : baseTokens.actions}>
    {children}
  </RnrView>
);
