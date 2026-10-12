import type {PortResult} from './result';

export type RemoteControlScreen = 'main' | 'secondary';
export type RemoteControlPointerPhase = 'down' | 'move' | 'up' | 'cancel';

export interface RemoteControlLocalScreen {
  readonly screen: RemoteControlScreen;
  readonly surfaceKey: 'PRIMARY' | 'SECONDARY';
  readonly windowIdentity: string;
  readonly generation: number;
}

export interface RemoteControlSessionInput {
  /** Current server-config address selected by composition; passed to the SDK unchanged and never comes from the CBS grant. */
  readonly signalUrl: string;
  readonly sessionId: string;
  readonly roomName: string;
  readonly participantIdentity: string;
  readonly token: string;
  readonly localScreens: readonly RemoteControlLocalScreen[];
}

export interface RemoteControlPointerInput {
  readonly sessionId: string;
  readonly screen: RemoteControlScreen;
  readonly streamId: string;
  readonly gestureId: string;
  readonly phase: RemoteControlPointerPhase;
  readonly u?: number;
  readonly v?: number;
}

export type RemoteControlPortEvent =
  | Readonly<{type: 'connected'; sessionId: string}>
  | Readonly<{type: 'disconnected'; sessionId: string; reason: string; participantIdentity?: string | null}>
  | Readonly<{
      type: 'screen-ready';
      sessionId: string;
      screen: RemoteControlScreen;
      streamId: string;
      trackSid: string;
      widthPx: number;
      heightPx: number;
    }>
  | Readonly<{type: 'data'; sessionId: string; senderIdentity: string; payload: Uint8Array}>
  | Readonly<{type: 'geometry-changed'; sessionId: string; screen: RemoteControlScreen; generation: number}>
  | Readonly<{type: 'capture-failed'; sessionId: string; screen: RemoteControlScreen; reason: string}>
  | Readonly<{type: 'local-input-conflict'; sessionId: string; screen: RemoteControlScreen}>
  | Readonly<{type: 'cleanup-failed'; sessionId: string; resource: string; reason: string}>;

export interface RemoteControlCleanupFacts {
  readonly roomLeft: boolean;
  readonly tracksReleased: number;
  readonly inputCancelled: boolean;
}

/** Platform-level media/input transport. It contains no TER business policy. */
export interface RemoteControlPort {
  subscribeEvents(listener: (event: RemoteControlPortEvent) => void): () => void;
  readLocalScreens(screens: readonly Readonly<{screen: RemoteControlScreen; surfaceKey: 'PRIMARY' | 'SECONDARY'}>[]): Promise<PortResult<readonly RemoteControlLocalScreen[]>>;
  begin(input: RemoteControlSessionInput): Promise<PortResult<Readonly<{started: true}>>>;
  sendData(input: Readonly<{
    sessionId: string;
    destinationIdentities: readonly string[];
    payload: Uint8Array;
  }>): Promise<PortResult<Readonly<{sent: true}>>>;
  dispatchPointer(input: RemoteControlPointerInput): Promise<PortResult<Readonly<{dispatched: boolean}>>>;
  end(input: Readonly<{sessionId: string}>): Promise<PortResult<RemoteControlCleanupFacts>>;
}
