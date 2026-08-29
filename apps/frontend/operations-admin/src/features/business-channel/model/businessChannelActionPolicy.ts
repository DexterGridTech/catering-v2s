import type {BusinessChannelView} from '../../../app/api/generated/operations-edge';
import {isKnownClosedCode} from '@catering-v2s/admin-ui-foundation';
import {lifecycleStatusLabels} from './businessChannelCodeLabels';

export type BusinessChannelActionAvailability = {
  canEdit: boolean;
  canMaintainBinding: boolean;
  canDisable: boolean;
  canEnable: boolean;
};

/**
 * Channel write actions are controlled by the channel's own lifecycle state.
 * Upstream status dimensions only describe business facts and never disable
 * management edits or recovery of a non-terminal channel.
 */
export function businessChannelActionAvailability(
  status: BusinessChannelView['status'],
): BusinessChannelActionAvailability {
  if (!isKnownClosedCode(lifecycleStatusLabels, status)) {
    return {canEdit: false, canMaintainBinding: false, canDisable: false, canEnable: false};
  }
  return {
    canEdit: status !== 'VOIDED',
    canMaintainBinding: status !== 'VOIDED',
    canDisable: status === 'ENABLED',
    canEnable: status === 'DISABLED',
  };
}

export function canTransitionBusinessChannelStatus(
  currentStatus: BusinessChannelView['status'],
  targetStatus: BusinessChannelView['status'],
): boolean {
  if (
    !isKnownClosedCode(lifecycleStatusLabels, currentStatus) ||
    !isKnownClosedCode(lifecycleStatusLabels, targetStatus)
  ) {
    return false;
  }
  if (targetStatus === 'DISABLED') return currentStatus === 'ENABLED';
  if (targetStatus === 'ENABLED') return currentStatus === 'DISABLED';
  return false;
}
