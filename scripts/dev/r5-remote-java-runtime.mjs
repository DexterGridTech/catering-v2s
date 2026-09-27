#!/usr/bin/env node

// Shared remote application lifecycle used by DEV and isolated browser L2.
// The DEV CLI remains the owning implementation; this capability module keeps
// browser L2 from copying process identity, readiness, log, and cleanup code.
export {
  cleanupRemoteJavaRoot,
  collectRemoteLog,
  collectRemoteTdsLog,
  assertRemotePortsAvailable,
  remoteHttpPortPreflight,
  remoteJavaReadiness,
  remoteTdsReadiness,
  probeLocalTdsWebSocket,
  remoteResourcePreflight,
  startRemoteJava,
  startRemoteTds,
  stopRemoteJava,
  stopRemoteTds,
  syncRemoteSource,
  waitForRemoteTdsReady,
  waitForRemoteBusinessReady,
} from './r5-dev-runner.mjs';
