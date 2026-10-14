import {useContext} from 'react';
import {InputScrollAncestorContext, type InputScrollAncestor} from '../contexts/context';

export const useInputScrollAncestor = (): InputScrollAncestor | null => useContext(InputScrollAncestorContext);
