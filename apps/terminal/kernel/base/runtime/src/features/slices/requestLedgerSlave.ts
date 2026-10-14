import {createRequestLedgerSlice, requestLedgerSliceNameForMode} from '../../foundations/requestLedgerState';

export const runtimeRequestLedgerSlaveSliceName = requestLedgerSliceNameForMode('SLAVE');
const requestLedgerSlave = createRequestLedgerSlice('SLAVE');

export const runtimeRequestLedgerSlaveSlice = requestLedgerSlave.registration;
export const requestLedgerSlaveActions = requestLedgerSlave.slice.actions;
