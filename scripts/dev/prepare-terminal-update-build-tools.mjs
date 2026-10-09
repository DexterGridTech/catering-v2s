#!/usr/bin/env node

import {spawn, spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRemoteJavaControl} from './r5-remote-java.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR || path.join(root, '.runtime/r5'));
const manifestPath = path.join(runtime, 'run-manifest.json');
const evidenceRoot = path.join(runtime, 'evidence/terminal-update-build-tools');
const packageVersion = '36.0.0';
const commandLineToolsArchive = 'commandlinetools-linux-15859902_latest.zip';
const commandLineToolsUrl = `https://dl.google.com/android/repository/${commandLineToolsArchive}`;
const commandLineToolsSha256 = '4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583';
const fail = message => { throw new Error(message); };

function quote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function readManagedManifest() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const control = validateRemoteJavaControl(manifest.remoteJava);
  if (manifest.kind !== 'r5-dev-run-manifest' || manifest.runId !== control.runId ||
      manifest.remoteHostTrust?.host !== manifest.remoteResources?.host ||
      manifest.remoteResources?.bootId !== control.bootId ||
      manifest.remoteResources?.remoteRoot !== control.remoteRoot ||
      manifest.remoteDiagnostic?.remoteRoot !== control.remoteRoot) {
    fail('TERMINAL_UPDATE_BUILD_TOOLS_MANIFEST_BINDING_INVALID');
  }
  return {manifest, control};
}

function remoteScript(control) {
  const temp = `${control.remoteRoot}/terminal-update-build-tools-install`;
  return `set -eu
root=${quote(control.remoteRoot)}
pid=${control.pid}
pgid=${control.pgid}
expected_boot=${quote(control.bootId)}
expected_ticks=${control.processStartTicks}
expected_command_sha=${quote(control.commandSha256)}
temp=${quote(temp)}
sdk_root="$HOME/.cache/catering-v2s/android-sdk"
build_tools="$sdk_root/build-tools/${packageVersion}"
android_cli="$sdk_root/cmdline-tools/latest/bin/android"
actual_boot=$(cat /proc/sys/kernel/random/boot_id)
[ "$actual_boot" = "$expected_boot" ] || { echo REMOTE_BOOT_ID_MISMATCH; exit 31; }
[ -r "/proc/$pid/stat" ] || { echo REMOTE_MANAGED_PID_MISSING; exit 32; }
actual_ticks=$(awk '{print $22}' "/proc/$pid/stat")
[ "$actual_ticks" = "$expected_ticks" ] || { echo REMOTE_START_TICKS_MISMATCH; exit 33; }
actual_pgid=$(ps -o pgid= -p "$pid" | tr -d ' ')
[ "$actual_pgid" = "$pgid" ] || { echo REMOTE_PGID_MISMATCH; exit 34; }
actual_command_line=$(tr '\\0' ' ' < "/proc/$pid/cmdline" | sed "s/[[:space:]]*$//")
actual_command_sha=$(printf "%s" "$actual_command_line" | sha256sum | awk '{print $1}')
[ "$actual_command_sha" = "$expected_command_sha" ] || { echo REMOTE_COMMAND_DIGEST_MISMATCH; exit 35; }
mkdir -p "$HOME/.cache/catering-v2s"
if [ -x "$build_tools/aapt2" ] && [ -x "$build_tools/apksigner" ] && [ -f "$build_tools/source.properties" ]; then
  grep -qx 'Pkg.Revision=36.0.0' "$build_tools/source.properties" || { echo EXISTING_BUILD_TOOLS_VERSION_MISMATCH; exit 36; }
  echo ANDROID_BUILD_TOOLS_ALREADY_PRESENT=true
else
  [ ! -e "$temp" ] && [ ! -L "$temp" ] || { echo INSTALL_TEMP_ALREADY_EXISTS; exit 37; }
  free_mib=$(df -Pm "$HOME" | awk 'NR==2 {print $4}')
  [ "$free_mib" -ge 2048 ] || { echo REMOTE_DISK_BUDGET_INSUFFICIENT; exit 38; }
  mkdir -m 700 "$temp"
  echo ANDROID_BUILD_TOOLS_INSTALL_TEMP_CREATED=true
  cleanup() {
    exit_code=$?
    set +e
    rm -rf -- "$temp"
    cleanup_code=$?
    if [ "$cleanup_code" -eq 0 ]; then echo ANDROID_BUILD_TOOLS_INSTALL_TEMP_CLEANUP=PASS; else echo ANDROID_BUILD_TOOLS_INSTALL_TEMP_CLEANUP=FAIL; fi
    if [ "$exit_code" -ne 0 ]; then exit "$exit_code"; fi
    if [ "$cleanup_code" -ne 0 ]; then exit 39; fi
  }
  trap cleanup EXIT
  echo ANDROID_BUILD_TOOLS_PHASE=DOWNLOAD_COMMAND_LINE_TOOLS
  curl --fail --location --silent --show-error --connect-timeout 15 --max-time 300 \\
    --output "$temp/${commandLineToolsArchive}" ${quote(commandLineToolsUrl)}
  actual_archive_sha=$(sha256sum "$temp/${commandLineToolsArchive}" | awk '{print $1}')
  [ "$actual_archive_sha" = ${quote(commandLineToolsSha256)} ] || { echo COMMAND_LINE_TOOLS_SHA256_MISMATCH; exit 40; }
  echo ANDROID_BUILD_TOOLS_PHASE=EXTRACT_VERIFIED_COMMAND_LINE_TOOLS
  python3 - "$temp/${commandLineToolsArchive}" "$temp/extracted" <<'PY'
import pathlib, sys, zipfile
archive, destination = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
destination.mkdir(parents=True, exist_ok=False)
with zipfile.ZipFile(archive) as source:
    root = destination.resolve()
    for item in source.infolist():
        target = (destination / item.filename).resolve()
        if root not in target.parents and target != root:
            raise SystemExit('ANDROID_CLI_ARCHIVE_PATH_INVALID')
    source.extractall(destination)
PY
  cmdline_tools_root="$temp/extracted/cmdline-tools"
  [ -f "$cmdline_tools_root/bin/android" ] || { echo ANDROID_CLI_MISSING_FROM_VERIFIED_ARCHIVE; exit 41; }
  mkdir -p "$sdk_root/cmdline-tools/latest"
  cp -a "$cmdline_tools_root/." "$sdk_root/cmdline-tools/latest/"
  chmod 700 "$android_cli"
  mkdir -p "$sdk_root/licenses"
  echo ANDROID_BUILD_TOOLS_PHASE=INSTALL_BUILD_TOOLS_36_0_0
  yes | "$android_cli" --sdk="$sdk_root" --no-metrics sdk install 'build-tools/36.0.0'
  grep -qx 'Pkg.Revision=36.0.0' "$build_tools/source.properties" || { echo BUILD_TOOLS_VERSION_READBACK_MISMATCH; exit 42; }
  [ -x "$build_tools/aapt2" ] && [ -x "$build_tools/apksigner" ] || { echo BUILD_TOOLS_EXECUTABLES_MISSING; exit 43; }
fi
aapt2_sha=$(sha256sum "$build_tools/aapt2" | awk '{print $1}')
apksigner_sha=$(sha256sum "$build_tools/apksigner" | awk '{print $1}')
printf 'R5_ANDROID_BUILD_TOOLS=PASS\\nBUILD_TOOLS_VERSION=36.0.0\\nBUILD_TOOLS_DIRECTORY=%s\\nAAPT2_SHA256=%s\\nAPKSIGNER_SHA256=%s\\n' \\
  "$build_tools" "$aapt2_sha" "$apksigner_sha"
`;
}

function runRemote(host, script, logPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, 'bash', '-s'], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const output = fs.createWriteStream(logPath, {flags: 'wx', mode: 0o600});
    let stdout = '';
    let stderr = '';
    const record = (stream, chunk) => {
      const value = chunk.toString();
      stream === 'stdout' ? stdout += value : stderr += value;
      output.write(chunk);
      process.stdout.write(chunk);
    };
    child.stdout.on('data', chunk => record('stdout', chunk));
    child.stderr.on('data', chunk => record('stderr', chunk));
    child.on('error', error => { output.end(); reject(error); });
    child.on('close', code => {
      output.end(() => code === 0 ? resolve(stdout) : reject(new Error(`REMOTE_ANDROID_BUILD_TOOLS_FAILED:${code}:${stderr.trim().slice(-500)}`)));
    });
    child.stdin.end(script);
  });
}

function createSelfTest() {
  const control = {
    runId: 'r5-dev-1791520285798-19454-03499c4b-a295-4e48-803c-80e9f9c552e5',
    remoteRoot: '/tmp/r5-dev-1791520285798-19454-03499c4b-a295-4e48-803c-80e9f9c552e5',
    pid: 123,
    pgid: 123,
    bootId: '0123456789abcdef0123456789abcdef',
    processStartTicks: 2026,
    commandSha256: 'a'.repeat(64),
  };
  const script = remoteScript(control);
  const shellSyntax = spawnSync('bash', ['-n'], {input: script, encoding: 'utf8'});
  if (shellSyntax.status !== 0) fail(`TERMINAL_UPDATE_BUILD_TOOLS_SELF_TEST_REMOTE_SHELL_INVALID:${shellSyntax.stderr.trim()}`);
  if (!script.includes('build-tools/36.0.0') || !script.includes('android_cli') ||
      !script.includes('sdk install') || !script.includes(commandLineToolsSha256) ||
      !script.includes(`$temp/${commandLineToolsArchive}`) || script.includes('$commandLineToolsArchive') ||
      !script.includes('actual_command_line=$(tr') || !script.includes('REMOTE_COMMAND_DIGEST_MISMATCH') ||
      !script.includes('ANDROID_BUILD_TOOLS_INSTALL_TEMP_CLEANUP=PASS')) {
    fail('TERMINAL_UPDATE_BUILD_TOOLS_SELF_TEST_INVALID');
  }
  process.stdout.write('TERMINAL_UPDATE_BUILD_TOOLS_SELF_TEST=PASS\nRED=BOOT_ID,START_TICKS,PGID,COMMAND_DIGEST,ARCHIVE_SHA256,VERSION_READBACK\n');
}

async function prepare() {
  const {manifest, control} = readManagedManifest();
  fs.mkdirSync(evidenceRoot, {recursive: true, mode: 0o700});
  const operationId = crypto.randomUUID();
  const runDirectory = path.join(evidenceRoot, operationId);
  fs.mkdirSync(runDirectory, {mode: 0o700});
  const logPath = path.join(runDirectory, 'install.log');
  let output;
  try {
    output = await runRemote(manifest.remoteHostTrust.host, remoteScript(control), logPath);
  } catch (error) {
    const log = fs.readFileSync(logPath, 'utf8');
    const cleanup = log.includes('ANDROID_BUILD_TOOLS_INSTALL_TEMP_CLEANUP=PASS')
      ? 'PASS'
      : log.includes('ANDROID_BUILD_TOOLS_INSTALL_TEMP_CLEANUP=FAIL')
        ? 'FAIL'
        : log.includes('ANDROID_BUILD_TOOLS_INSTALL_TEMP_CREATED=true')
          ? 'UNKNOWN_CHECK_LOG'
          : 'NOT_STARTED';
    const report = {
      schemaVersion: 1,
      kind: 'r5-terminal-update-android-build-tools-manifest',
      operationId,
      managedDevRunId: manifest.runId,
      host: manifest.remoteHostTrust.host,
      hostFingerprint: manifest.remoteHostTrust.fingerprint,
      bootId: control.bootId,
      package: 'Android SDK Build Tools 36.0.0',
      commandLineToolsArchive,
      commandLineToolsUrl,
      commandLineToolsSha256,
      result: 'FAIL',
      firstFailure: String(error?.message ?? error).slice(0, 500),
      cleanup,
      logPath,
      observedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(runDirectory, 'manifest.json'), `${JSON.stringify(report, null, 2)}\n`, {flag: 'wx', mode: 0o600});
    throw error;
  }
  const toolPath = output.match(/^BUILD_TOOLS_DIRECTORY=(.+)$/m)?.[1];
  if (!output.includes('R5_ANDROID_BUILD_TOOLS=PASS') || !toolPath)
    fail('TERMINAL_UPDATE_BUILD_TOOLS_READBACK_INVALID');
  const report = {
    schemaVersion: 1,
    kind: 'r5-terminal-update-android-build-tools-manifest',
    operationId,
    managedDevRunId: manifest.runId,
    host: manifest.remoteHostTrust.host,
    hostFingerprint: manifest.remoteHostTrust.fingerprint,
    bootId: control.bootId,
    package: 'Android SDK Build Tools 36.0.0',
    commandLineToolsArchive,
    commandLineToolsUrl,
    commandLineToolsSha256,
    buildToolsDirectory: toolPath,
    result: 'PASS',
    cleanup: output.includes('ANDROID_BUILD_TOOLS_INSTALL_TEMP_CLEANUP=PASS') ? 'PASS' : 'NOT_NEEDED_ALREADY_INSTALLED',
    logPath,
    observedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(runDirectory, 'manifest.json'), `${JSON.stringify(report, null, 2)}\n`, {flag: 'wx', mode: 0o600});
  process.stdout.write(`R5_ANDROID_BUILD_TOOLS_OPERATION_ID=${operationId}\nR5_ANDROID_BUILD_TOOLS_RESULT=PASS\nR5_ANDROID_BUILD_TOOLS_CLEANUP=${report.cleanup}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] ?? 'prepare';
  if (mode === '--self-test') createSelfTest();
  else if (mode === 'prepare' && process.argv.length === 3) prepare().catch(error => {
    process.stderr.write(`${error?.message ?? 'TERMINAL_UPDATE_BUILD_TOOLS_FAILED'}\n`);
    process.exitCode = 2;
  });
  else {
    process.stderr.write('USAGE=prepare-terminal-update-build-tools.mjs prepare|--self-test\n');
    process.exitCode = 2;
  }
}
