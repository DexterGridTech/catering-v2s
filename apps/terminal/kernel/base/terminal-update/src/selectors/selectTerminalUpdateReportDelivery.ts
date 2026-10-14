import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import {readTerminalUpdateState} from '../foundations/readTerminalUpdateState';

export const selectTerminalUpdateReportDelivery = defineStateSelector(
  moduleName,
  'selectTerminalUpdateReportDelivery',
  {
    parameters: [],
    selector: (root: StateRoot) => {
      const descriptor = readTerminalUpdateState(root).reportDescriptor;
      return Object.freeze({
        pendingCount: Object.keys(descriptor?.pendingReports ?? {}).length,
        sendPaused: descriptor?.sendPaused ?? false,
        latestDeliveryFailure: descriptor?.latestDeliveryFailure ?? null,
      });
    },
  },
);
