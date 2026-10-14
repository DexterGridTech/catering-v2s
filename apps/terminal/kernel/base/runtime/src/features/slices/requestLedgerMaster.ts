import {createRequestLedgerSlice, requestLedgerSliceNameForMode} from '../../foundations/requestLedgerState';

export const runtimeRequestLedgerMasterSliceName = requestLedgerSliceNameForMode('MASTER');
const requestLedgerMaster = createRequestLedgerSlice('MASTER');

export const runtimeRequestLedgerMasterSlice = requestLedgerMaster.registration;
export const requestLedgerMasterActions = requestLedgerMaster.slice.actions;
