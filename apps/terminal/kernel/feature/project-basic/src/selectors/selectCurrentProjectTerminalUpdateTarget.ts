import {selectStoreBasicBinding} from '@catering-v2s/kernel-feature-store-basic';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {FixedUpdateTarget} from '@catering-v2s/kernel-base-terminal-update';
import {moduleName} from '../moduleName';
import {fixedTargetFromProjectCandidate} from './fixedTargetFromProjectCandidate';
import {selectProjectTerminalUpdateCandidate} from './selectProjectTerminalUpdateCandidate';

const selectCurrentTarget = (
  root: StateRoot,
  applicationId: string,
  expectedRuleRef: string,
  expectedCollectionHash: string,
  expectedContextIdentity: string,
): FixedUpdateTarget | null => {
  const binding = selectStoreBasicBinding(root);
  if (binding === null) return null;
  const candidate = selectProjectTerminalUpdateCandidate(root, applicationId, binding.storeRef);
  if (candidate === null) return null;
  if (
    candidate.rule.ruleRef !== expectedRuleRef ||
    candidate.collectionHash !== expectedCollectionHash ||
    candidate.contextIdentity !== expectedContextIdentity
  )
    return null;
  const target = fixedTargetFromProjectCandidate(candidate);
  return target;
};

export const selectCurrentProjectTerminalUpdateTarget = defineStateSelector(
  moduleName,
  'selectCurrentProjectTerminalUpdateTarget',
  {
    parameters: [{kind: 'string'}, {kind: 'string'}, {kind: 'string'}, {kind: 'string'}],
    selector: selectCurrentTarget,
  },
);
