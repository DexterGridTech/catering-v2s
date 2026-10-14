import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {projectBasicContextIdentity} from '../../features/slices/projectBasicState';
import type {ProjectTerminalUpdateCandidate, StoredTerminalUpdateRule} from '../../types/types';
import {readProjectBasicState} from '../readProjectBasicState';
import {selectReadyUpdateContext} from './selectReadyUpdateContext';

const uuidSortKey = (value: string): string | null => {
  const normalized = value.toLowerCase().replaceAll('-', '');
  return /^[0-9a-f]{32}$/u.test(normalized) ? normalized : null;
};

const compareRulesDescending = (left: StoredTerminalUpdateRule, right: StoredTerminalUpdateRule): number => {
  if (left.createdAtEpochMillis !== right.createdAtEpochMillis)
    return left.createdAtEpochMillis > right.createdAtEpochMillis ? -1 : 1;
  const leftId = uuidSortKey(left.ruleRef);
  const rightId = uuidSortKey(right.ruleRef);
  if (leftId === null || rightId === null) return 0;
  return leftId === rightId ? 0 : leftId > rightId ? -1 : 1;
};

export const selectCandidate = (
  root: StateRoot,
  applicationId: string,
  requestedStoreRef: string,
): ProjectTerminalUpdateCandidate | null => {
  const state = readProjectBasicState(root);
  const context = selectReadyUpdateContext(root);
  if (context === null || context.binding.storeRef !== requestedStoreRef) return null;
  const {binding, path} = context;
  const contextIdentity = projectBasicContextIdentity(binding, path.value);
  const collectionHash = state.ruleSnapshot.collectionHash;
  if (collectionHash === null) return null;

  const selected = state.ruleSnapshot.items
    .filter(
      rule =>
        rule.applicationId === applicationId &&
        (rule.targetMode === 'ALL' || rule.storeRefs.includes(requestedStoreRef)),
    )
    .sort(compareRulesDescending)[0];
  if (selected === undefined) return null;
  return Object.freeze({
    collectionHash,
    contextIdentity,
    selectedSpace: binding.groupWorkspaceKey,
    projectRef: path.value.projectRef,
    storeRef: requestedStoreRef,
    rule: selected,
  });
};
