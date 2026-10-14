import {useContext} from 'react';
import {InputPendingFocusCommitContext} from '../contexts/context';

export const useInputPendingFocusCommit = (): ((fieldId: string) => boolean) => {
  const commit = useContext(InputPendingFocusCommitContext);
  if (commit === null) throw new Error('[ui-base-input] InputProvider is required');
  return commit;
};
