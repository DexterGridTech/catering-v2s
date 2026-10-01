export type TerminalAcceptanceDevAction =
  | 'drain-stop-a'
  | 'drain-force-stop-b'
  | 'restart-a'
  | 'restart-b'
  | 'ensure-ready-a'
  | 'ensure-ready-b';

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

export function executeManagedTerminalDevAction(input: Readonly<{
  manifestPath: string;
  runId: string;
  action: TerminalAcceptanceDevAction;
}>): Promise<Readonly<Record<string, unknown>>>;

export function readManagedTdsLatestState(input: Readonly<{
  manifestPath: string;
  runId: string;
  terminalRef: string;
}>): ManagedTdsLatestState | null;
