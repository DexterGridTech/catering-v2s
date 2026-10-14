import type {RuntimeInstanceMode} from '../../types/role';
import {requestLedgerMasterActions} from './requestLedgerMaster';
import {requestLedgerSlaveActions} from './requestLedgerSlave';

export const requestLedgerActionsForMode = (mode: RuntimeInstanceMode) =>
  mode === 'MASTER' ? requestLedgerMasterActions : requestLedgerSlaveActions;
