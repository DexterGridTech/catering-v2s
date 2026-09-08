#!/usr/bin/env node

// Shared remote application lifecycle used by DEV and isolated browser L2.
// The DEV CLI remains the owning implementation; this capability module keeps
// browser L2 from copying process identity, readiness, log, and cleanup code.
export {
  cleanupRemoteJavaRoot,
  collectRemoteLog,
  remoteHttpPortPreflight,
  remoteJavaReadiness,
  remoteResourcePreflight,
  startRemoteJava,
  stopRemoteJava,
  syncRemoteSource,
  waitForRemoteBusinessReady,
} from './r5-dev-runner.mjs';
