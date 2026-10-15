import type {Page} from 'playwright';
import {liveKitSignalSocketProtocol, projectBrowserRtcDiagnostics, safeBrowserRequestFailureReason} from './browserNetworkDiagnostics.js';

type RtcDiagnosticLogger = (event: string, fields?: Readonly<Record<string, string | number | boolean>>) => void;

export const installBrowserRtcProbe = async (page: Page, label: 'operations' | 'terminal', log: RtcDiagnosticLogger): Promise<void> => {
  await page.addInitScript(() => {
    type CandidateCounts = Record<
      'hostUdp' | 'hostTcp' | 'srflxUdp' | 'srflxTcp' | 'prflxUdp' | 'prflxTcp' | 'relayUdp' | 'relayTcp',
      number
    >;
    type ProbePeer = {
      peerId: number;
      peer: RTCPeerConnection;
      candidateCounts: CandidateCounts;
    };
    type ProbeWindow = Window & {
      RTCPeerConnection?: typeof RTCPeerConnection;
      __terBrowserRtcProbe?: {
        probeStatus: 'INSTALLED' | 'UNAVAILABLE';
        createdCount: number;
        overflowCount: number;
        peers: ProbePeer[];
      };
    };
    const target = window as ProbeWindow;
    const nativeConstructor = target.RTCPeerConnection;
    const probe: NonNullable<ProbeWindow['__terBrowserRtcProbe']> = {
      probeStatus: typeof nativeConstructor === 'function' ? 'INSTALLED' : 'UNAVAILABLE',
      createdCount: 0,
      overflowCount: 0,
      peers: [],
    };
    try {
      Object.defineProperty(target, '__terBrowserRtcProbe', {value: probe, configurable: false});
    } catch {
      return;
    }
    if (typeof nativeConstructor !== 'function') return;

    const wrappedConstructor = new Proxy(nativeConstructor, {
      construct(constructor, argumentsList, newTarget) {
        const peer = Reflect.construct(
          constructor,
          argumentsList,
          newTarget === wrappedConstructor ? constructor : newTarget,
        ) as RTCPeerConnection;
        probe.createdCount += 1;
        if (probe.peers.length >= 8) {
          probe.overflowCount += 1;
          return peer;
        }

        const record: ProbePeer = {
          peerId: probe.createdCount,
          peer,
          candidateCounts: {
            hostUdp: 0,
            hostTcp: 0,
            srflxUdp: 0,
            srflxTcp: 0,
            prflxUdp: 0,
            prflxTcp: 0,
            relayUdp: 0,
            relayTcp: 0,
          },
        };
        peer.addEventListener('icecandidate', event => {
          const candidate = event.candidate?.candidate;
          if (typeof candidate === 'string') {
            const protocol = /^candidate:[^ ]+\s+\d+\s+(udp|tcp)\s/iu.exec(candidate)?.[1]?.toLowerCase();
            const type = /\btyp\s+(host|srflx|prflx|relay)\b/iu.exec(candidate)?.[1]?.toLowerCase();
            if (protocol !== undefined && type !== undefined) {
              const bucket = `${type}${protocol === 'udp' ? 'Udp' : 'Tcp'}` as keyof CandidateCounts;
              record.candidateCounts[bucket] += 1;
            }
          }
        });
        probe.peers.push(record);
        return peer;
      },
    });
    try {
      Object.defineProperty(target, 'RTCPeerConnection', {
        value: wrappedConstructor,
        configurable: true,
        writable: true,
      });
    } catch {
      probe.probeStatus = 'UNAVAILABLE';
    }
  });
  log(`${label}.webrtc.probe-registered`, {boundedPeerCapture: 8, candidateProtocolBuckets: 8});
};

export const attachLiveKitSignalDiagnostics = (page: Page, label: 'operations' | 'terminal', log: RtcDiagnosticLogger): void => {
  let attempt = 0;
  page.on('websocket', socket => {
    const protocol = liveKitSignalSocketProtocol(socket.url());
    if (protocol === undefined) return;
    const attemptId = ++attempt;
    const startedAt = Date.now();
    let sentFrames = 0;
    let receivedFrames = 0;
    log(`${label}.livekit.signal.socket-observed`, {attempt: attemptId, protocol});
    socket.on('framesent', () => { sentFrames += 1; });
    socket.on('framereceived', () => { receivedFrames += 1; });
    socket.on('socketerror', errorText => log(`${label}.livekit.signal.socket-error`, {
      attempt: attemptId,
      protocol,
      reason: safeBrowserRequestFailureReason(errorText),
      detail: errorText,
    }));
    socket.on('close', () => log(`${label}.livekit.signal.socket-closed`, {
      attempt: attemptId,
      protocol,
      sentFrames,
      receivedFrames,
      elapsedMs: Date.now() - startedAt,
    }));
  });
};

const readBrowserRtcDiagnostics = async (page: Page): Promise<unknown> => page.evaluate(async () => {
  type ProbeWindow = Window & {
    __terBrowserRtcProbe?: {
      probeStatus: 'INSTALLED' | 'UNAVAILABLE';
      createdCount: number;
      overflowCount: number;
      peers: Array<{
        peerId: number;
        peer: RTCPeerConnection;
        candidateCounts: Record<string, number>;
      }>;
    };
  };
  const probe = (window as ProbeWindow).__terBrowserRtcProbe;
  if (probe === undefined) return {probeStatus: 'UNAVAILABLE', peerCount: 0, overflowCount: 0, peers: []};

  const peers = await Promise.all(probe.peers.map(async record => {
    let statsStatus: 'READ' | 'UNAVAILABLE' = 'UNAVAILABLE';
    let candidatePairs: Array<Record<string, unknown>> = [];
    let videoRtpReports: Array<Record<string, unknown>> = [];
    try {
      const stats = await new Promise<RTCStatsReport>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('RTC_STATS_TIMEOUT')), 1_000);
        record.peer.getStats().then(
          value => {
            window.clearTimeout(timer);
            resolve(value);
          },
          error => {
            window.clearTimeout(timer);
            reject(error);
          },
        );
      });
      statsStatus = 'READ';
      const rows = Array.from(stats.values(), value => value as unknown as Record<string, unknown>);
      const count = (value: unknown): number =>
        typeof value === 'number' && Number.isFinite(value) && value >= 0
          ? Math.min(Math.floor(value), 1_000_000)
          : 0;
      const metric = (value: unknown): number =>
        typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(value, 1_000_000) : 0;
      const candidates = new Map<string, {type: string; protocol: string; address: string; port: number}>();
      const selectedPairIds = new Set<string>();
      for (const row of rows) {
        if ((row.type === 'local-candidate' || row.type === 'remote-candidate') && typeof row.id === 'string') {
          candidates.set(row.id, {
            type: typeof row.candidateType === 'string' ? row.candidateType : 'unknown',
            protocol: typeof row.protocol === 'string' ? row.protocol : 'unknown',
            address: typeof row.address === 'string' ? row.address : 'unknown',
            port: typeof row.port === 'number' && Number.isFinite(row.port) ? row.port : 0,
          });
        }
        if (row.type === 'transport' && typeof row.selectedCandidatePairId === 'string') {
          selectedPairIds.add(row.selectedCandidatePairId);
        }
      }
      candidatePairs = rows
        .filter(row => row.type === 'candidate-pair')
        .sort((left, right) => {
          const leftSelected = left.selected === true || (typeof left.id === 'string' && selectedPairIds.has(left.id));
          const rightSelected = right.selected === true || (typeof right.id === 'string' && selectedPairIds.has(right.id));
          if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
          const priority = (value: unknown): number => value === 'succeeded' ? 0 : value === 'in-progress' ? 1 : 2;
          return priority(left.state) - priority(right.state);
        })
        .slice(0, 8)
        .map(row => {
          const local = typeof row.localCandidateId === 'string' ? candidates.get(row.localCandidateId) : undefined;
          const remote = typeof row.remoteCandidateId === 'string' ? candidates.get(row.remoteCandidateId) : undefined;
          const roundTripTime = typeof row.currentRoundTripTime === 'number' && Number.isFinite(row.currentRoundTripTime)
            ? Math.round(row.currentRoundTripTime * 1_000)
            : 0;
          return {
            state: row.state,
            selected: row.selected === true || (typeof row.id === 'string' && selectedPairIds.has(row.id)),
            nominated: row.nominated === true,
            localType: local?.type ?? 'unknown',
            localProtocol: local?.protocol ?? 'unknown',
            localAddress: local?.address ?? 'unknown',
            localPort: local?.port ?? 0,
            remoteType: remote?.type ?? 'unknown',
            remoteProtocol: remote?.protocol ?? 'unknown',
            remoteAddress: remote?.address ?? 'unknown',
            remotePort: remote?.port ?? 0,
            bytesSent: count(row.bytesSent),
            bytesReceived: count(row.bytesReceived),
            roundTripTimeMs: roundTripTime,
          };
        });
      videoRtpReports = rows
        .filter(row => (row.type === 'inbound-rtp' || row.type === 'outbound-rtp') && (row.kind === 'video' || row.mediaType === 'video'))
        .slice(0, 8)
        .map(row => ({
          direction: row.type === 'outbound-rtp' ? 'outbound' : 'inbound',
          mid: typeof row.mid === 'string' ? row.mid : 'unknown',
          packets: count(row.type === 'outbound-rtp' ? row.packetsSent : row.packetsReceived),
          bytes: count(row.type === 'outbound-rtp' ? row.bytesSent : row.bytesReceived),
          framesReceived: count(row.framesReceived),
          framesDecoded: count(row.framesDecoded),
          framesPerSecond: metric(row.framesPerSecond),
          frameWidth: count(row.frameWidth),
          frameHeight: count(row.frameHeight),
        }));
    } catch {
      statsStatus = 'UNAVAILABLE';
    }

    return {
      peerId: record.peerId,
      connectionState: record.peer.connectionState,
      iceConnectionState: record.peer.iceConnectionState,
      iceGatheringState: record.peer.iceGatheringState,
      signalingState: record.peer.signalingState,
      statsStatus,
      candidateCounts: record.candidateCounts,
      candidatePairs,
      videoRtpReports,
    };
  }));
  return {
    probeStatus: probe.probeStatus,
    peerCount: probe.createdCount,
    overflowCount: probe.overflowCount,
    peers,
  };
});

export const captureBrowserRtcDiagnostics = async (page: Page, label: 'operations' | 'terminal', log: RtcDiagnosticLogger): Promise<void> => {
  try {
    const diagnostics = projectBrowserRtcDiagnostics(await readBrowserRtcDiagnostics(page));
    if (diagnostics === undefined) {
      log(`${label}.webrtc.snapshot-unavailable`, {reason: 'INVALID_DIAGNOSTIC'});
      return;
    }
    log(`${label}.webrtc.snapshot`, {
      probeStatus: diagnostics.probeStatus,
      peerCount: diagnostics.peerCount,
      overflowCount: diagnostics.overflowCount,
    });
    for (const peer of diagnostics.peers) {
      log(`${label}.webrtc.peer-state`, {
        peerId: peer.peerId,
        connectionState: peer.connectionState,
        iceConnectionState: peer.iceConnectionState,
        iceGatheringState: peer.iceGatheringState,
        signalingState: peer.signalingState,
        statsStatus: peer.statsStatus,
        ...peer.candidateCounts,
      });
      peer.candidatePairs.forEach((pair, index) => log(`${label}.webrtc.candidate-pair`, {
        peerId: peer.peerId,
        pair: index + 1,
        state: pair.state,
        selected: pair.selected,
        nominated: pair.nominated,
        localType: pair.localType,
        localProtocol: pair.localProtocol,
        localAddress: pair.localAddress,
        remoteType: pair.remoteType,
        remoteProtocol: pair.remoteProtocol,
        remoteAddress: pair.remoteAddress,
        localPort: pair.localPort,
        remotePort: pair.remotePort,
        bytesSent: pair.bytesSent,
        bytesReceived: pair.bytesReceived,
        roundTripTimeMs: pair.roundTripTimeMs,
      }));
      peer.videoRtpReports.forEach((report, index) => log(`${label}.webrtc.video-rtp`, {
        peerId: peer.peerId,
        report: index + 1,
        direction: report.direction,
        mid: report.mid,
        packets: report.packets,
        bytes: report.bytes,
        framesReceived: report.framesReceived,
        framesDecoded: report.framesDecoded,
        framesPerSecond: report.framesPerSecond,
        frameWidth: report.frameWidth,
        frameHeight: report.frameHeight,
      }));
    }
  } catch (error) {
    log(`${label}.webrtc.snapshot-unavailable`, {
      reason: error instanceof Error ? error.name : 'UNKNOWN',
    });
  }
};
