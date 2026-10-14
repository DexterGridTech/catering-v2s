import {useContext} from 'react';
import {RenderContext, type RenderContextValue} from '../contexts/RenderContext';

export const useRenderContext = (): RenderContextValue => {
  const value = useContext(RenderContext);
  if (value === undefined) throw new Error('[ui-base-render] RenderProvider is required');
  return value;
};
