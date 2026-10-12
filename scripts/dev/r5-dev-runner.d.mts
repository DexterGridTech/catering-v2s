export type TerminalAcceptanceDevAction =
  'drain-stop-a' | 'drain-force-stop-b' | 'restart-a' | 'restart-b' | 'ensure-ready-a' | 'ensure-ready-b';

export type ManagedTdsLatestState = Readonly<{
  group_workspace_key: string;
  terminal_ref: string;
  node_id: string;
  session_id: string;
  session_sequence: number;
  connected_at_epoch_millis: number;
  disconnected_at_epoch_millis: number | null;
  last_activity_at_epoch_millis: number;
  last_rtt_ms: number | null;
  close_reason: string | null;
}>;

export type ManagedDevDiagnosticSource = Readonly<{
  source: string;
  status: 'READ';
  tailBytes: number;
  eventCount: number;
  events: readonly Readonly<Record<string, string>>[];
}>;

export function readManagedDevDiagnosticEvents(
  input: Readonly<{
    manifestPath?: string;
    runId: string;
    maxBytesPerService?: number;
  }>,
): readonly ManagedDevDiagnosticSource[];

export function executeManagedTerminalDevAction(
  input: Readonly<{
    manifestPath: string;
    runId: string;
    action: TerminalAcceptanceDevAction;
  }>,
): Promise<Readonly<Record<string, unknown>>>;

export function readManagedTdsLatestState(
  input: Readonly<{
    manifestPath: string;
    runId: string;
    terminalRef: string;
  }>,
): ManagedTdsLatestState | null;

export function readManagedTerminalControlOperation(
  input: Readonly<{
    manifestPath?: string;
    runId: string;
    operationId: string;
  }>,
): Readonly<{operationId: string; commandName: string}> | null;
export function parseManagedTerminalControlOperationReadback(
  rows: readonly Readonly<Record<string, unknown>>[],
  operationId: string,
): Readonly<{operationId: string; commandName: string}> | null;

export function readManagedTerminalBindingByName(
  input: Readonly<{
    manifestPath?: string;
    runId: string;
    groupWorkspaceKey: string;
    terminalNames: readonly string[];
  }>,
): readonly Readonly<{
  name: string;
  terminalRef: string;
  storeRef: string;
  terminalStatus: 'ENABLED' | 'DISABLED' | 'VOIDED';
  bindingStatus: 'UNBOUND' | 'ACTIVE' | 'ENDED';
  generation: number | null;
  boundDeviceId: string | null;
}>[];
export function parseManagedTerminalBindingReadback(
  rows: readonly Readonly<Record<string, unknown>>[],
  terminalNames: readonly string[],
): readonly Readonly<{
  name: string;
  terminalRef: string;
  storeRef: string;
  terminalStatus: 'ENABLED' | 'DISABLED' | 'VOIDED';
  bindingStatus: 'UNBOUND' | 'ACTIVE' | 'ENDED';
  generation: number | null;
  boundDeviceId: string | null;
}>[];
