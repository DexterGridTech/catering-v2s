import assert from 'node:assert/strict';
import test from 'node:test';
import {assertSeedDryRunPass, runRemoteReset, verifyRemoteResetTranscript} from './r5-reset.mjs';

const residentDoris = {
  schemaVersion: 1,
  kind: 'r5-managed-doris-resident',
  host: 'catering-remote-dev',
  hostFingerprint: 'a'.repeat(64),
  bootId: '01234567-89ab-cdef-0123-456789abcdef',
  containerName: 'catering-v2s-r5-doris-resident',
  containerId: 'b'.repeat(64),
  imageRef: 'apache/doris:all-in-one-4.1.3',
  imageId: 'sha256:82a5cabc7900ebcd3d080412d636c0cebd6602799fffe2605c652b2ea7d42609',
  repoDigest: 'apache/doris@sha256:82a5cabc7900ebcd3d080412d636c0cebd6602799fffe2605c652b2ea7d42609',
  feVolumeId: 'c'.repeat(64),
  beVolumeId: 'd'.repeat(64),
  endpoint: 'http://127.0.0.1:8040',
  database: 'terminal_connection_history',
  table: 'connection_history',
  username: 'tds_history_writer',
  health: 'healthy',
  ports: {mysql: '127.0.0.1:9030', http: '127.0.0.1:8030', load: '127.0.0.1:8040'},
};

test('reset refuses before destructive execution when the complete seed dry-run fails', () => {
  let destructiveCall = false;
  assert.throws(
    () => {
      assertSeedDryRunPass({
        executor: () => ({status: 2, stdout: '', stderr: 'R5_COMPLETE_SEED_DRY_RUN=FAIL; FIRST_FAILURE=STATIC_PLAN'}),
      });
      destructiveCall = true;
    },
    /SEED_DRY_RUN_REQUIRED_BEFORE_RESET:STATIC_PLAN/,
  );
  assert.equal(destructiveCall, false);
});

test('Doris truncate and zero readback are ordered before PostgreSQL reset and required by its transcript', () => {
  let remoteScript = '';
  const output = [
    'R5_REMOTE_RESET_DORIS_TRUNCATE=PASS',
    'R5_REMOTE_RESET_DORIS_READBACK=0',
    'R5_REMOTE_RESET_TERMINATE=PASS',
    'R5_REMOTE_RESET_DROP=PASS',
    'R5_REMOTE_RESET_READBACK_ABSENT=PASS',
    'R5_REMOTE_RESET_ASSET_CLEANUP=PASS',
  ].join('\n');
  const result = runRemoteReset({
    host: residentDoris.host,
    fingerprint: residentDoris.hostFingerprint,
    targetDatabase: 'catering_v2s_dev_alpha',
    residentDoris,
    executor: (_command, _args, options) => {
      remoteScript = options.input;
      return {status: 0, stdout: output, stderr: ''};
    },
  });
  assert.equal(result.dorisReadback, '0');
  assert.ok(remoteScript.indexOf('TRUNCATE TABLE terminal_connection_history.connection_history') < remoteScript.indexOf('DROP DATABASE IF EXISTS'));
  assert.match(remoteScript, /docker image inspect/);
  assert.match(remoteScript, /DORIS_RESET_CONTAINER_IDENTITY_MISMATCH/);
  assert.doesNotMatch(remoteScript, /docker volume rm|docker rm -f|docker image rm/);
  assert.throws(() => verifyRemoteResetTranscript(output.replace('R5_REMOTE_RESET_DORIS_READBACK=0', 'R5_REMOTE_RESET_DORIS_READBACK=1')), /REMOTE_EXECUTION_PROTOCOL_INVALID|POST_DROP_READBACK_FAILED/);
});

test('reset refuses missing or host-mismatched resident Doris ownership before remote execution', () => {
  let executed = false;
  const executor = () => { executed = true; return {status: 0, stdout: '', stderr: ''}; };
  assert.throws(() => runRemoteReset({host: residentDoris.host, fingerprint: residentDoris.hostFingerprint, targetDatabase: 'catering_v2s_dev_alpha', executor}), /DORIS_RESIDENT_MANIFEST_REQUIRED_BEFORE_RESET/);
  assert.throws(() => runRemoteReset({host: 'other-host', fingerprint: residentDoris.hostFingerprint, targetDatabase: 'catering_v2s_dev_alpha', residentDoris, executor}), /DORIS_RESIDENT_HOST_BINDING_INVALID/);
  assert.equal(executed, false);
});
