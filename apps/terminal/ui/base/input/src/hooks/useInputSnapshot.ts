import {useInputController} from '../contexts/context';

/**
 * Reads the current provider registry synchronously at an explicit submit boundary.
 * The hook does not subscribe to field values and never promotes draft input into runtime state.
 */
export const useInputSnapshot = () => useInputController().captureInputSnapshot;
