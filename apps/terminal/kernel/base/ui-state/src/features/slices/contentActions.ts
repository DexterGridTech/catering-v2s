import {contentBaseName} from '../../foundations/workspaceSlices';
import {createContentSlice} from './contentSlice';

export const contentActions = createContentSlice(contentBaseName).actions;
