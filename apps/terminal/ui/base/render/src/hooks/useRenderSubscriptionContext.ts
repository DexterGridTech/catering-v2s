import {useContext} from 'react';
import {RenderSubscriptionContext, type RenderSubscriptionContextValue} from '../contexts/RenderContext';

export const useRenderSubscriptionContext = (): RenderSubscriptionContextValue => {
  const value = useContext(RenderSubscriptionContext);
  if (value === undefined) throw new Error('[ui-base-render] RenderProvider is required');
  return value;
};
