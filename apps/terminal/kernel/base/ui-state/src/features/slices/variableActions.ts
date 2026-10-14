import {variableBaseName} from '../../foundations/variableSlices';
import {createCanonicalVariableActions} from './variableSlice';

export const variableActions = createCanonicalVariableActions(variableBaseName);
