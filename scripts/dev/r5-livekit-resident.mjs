#!/usr/bin/env node

import {createHash, randomUUID} from 'node:crypto';
import {chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync, writeSync} from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveTrustedRemoteHost} from './r5-remote-host-trust.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const defaultRuntime = path.join(root, '.runtime/r5');
export const LIVEKIT_RESIDENT_SOURCE_IMAGE = 'livekit/livekit-server@sha256:6fd3b7088874c4d119160dd688798dfec852bc014786d392caad15f6f63912a3';
export const LIVEKIT_RESIDENT_IMAGE = 'livekit/livekit-server:r5-6fd3b7088874';
export const LIVEKIT_RESIDENT_CONTAINER = 'catering-v2s-livekit-resident';
export const LIVEKIT_RESIDENT_ENDPOINT = 'http://47.106.121.27:7880';
export const LIVEKIT_RESIDENT_SIGNAL_URL = 'ws://47.106.121.27:7880';
export const LIVEKIT_RESIDENT_UDP_PORT = 7882;
export const LIVEKIT_RESIDENT_KIND = 'r5-managed-livekit-resident';
export const LIVEKIT_RESIDENT_MANIFEST = path.join(root, '.runtime/livekit-resident/manifest.json');
export const LIVEKIT_RESIDENT_PROJECT = 'catering-v2s-livekit-resident';
export const LIVEKIT_RESIDENT_MIN_AVAILABLE_MEMORY_MIB = 2048;
export const LIVEKIT_RESIDENT_MIN_AVAILABLE_DISK_MIB = 2048;

export function livekitCredentialsPath(runtimeDirectory = process.env.V2S_RUNTIME_DIR) {
  return path.join(path.resolve(runtimeDirectory ?? defaultRuntime), 'credentials.env');
}

const ownerLabel = 'com.catering-v2s.managed';
const trustLabel = 'com.catering-v2s.host-fingerprint';
const configLabel = 'com.catering-v2s.config-sha256';
const attemptLabel = 'com.catering-v2s.attempt-id';
const shellQuote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = code => { const error = new Error(code); error.code = code; throw error; };

function remoteFailureReason(output) {
  const text = String(output ?? '');
  return text.match(/R5_LIVEKIT_RESIDENT=FAIL; REASON=([A-Z0-9_]+)/)?.[1]
    ?? text.match(/R5_LIVEKIT_RUNNER_CLEANUP=(FAIL_[A-Z0-9_]+)/)?.[1]
    ?? 'REMOTE_COMMAND_FAILED';
}

export function formatLivekitEnsureFailure(action, result) {
  const text = `${result?.stdout ?? ''}\n${result?.stderr ?? ''}`;
  const remote = text.match(/R5_LIVEKIT_RESIDENT_REMOTE_FAILED:[^:\s]+:([A-Z0-9_]+):([a-f0-9-]{36}\/(?:init|cache|import|check|start|stop)\.log)/i);
  const reason = remote?.[1] ?? result?.error?.code ?? String(result?.status ?? 'NONE');
  const log = remote?.[2] ?? 'LOG_NOT_AVAILABLE';
  return `R5_LIVEKIT_RESIDENT_${String(action).toUpperCase()}_FAILED:${reason}:${log}`;
}

export function livekitResidentAttemptLogPath(action, attemptId, repoRoot = root) {
  if (!['init', 'cache', 'import', 'check', 'start', 'stop'].includes(action) || !/^[a-f0-9-]{36}$/i.test(attemptId ?? '')) {
    fail('R5_LIVEKIT_RESIDENT_LOG_IDENTITY_INVALID');
  }
  return path.join(repoRoot, '.runtime/livekit-resident', attemptId, `${action}.log`);
}

export function livekitResidentLogAttemptId(action, lifecycleAttemptId) {
  return ['check', 'stop'].includes(action) ? randomUUID() : lifecycleAttemptId;
}

export function renderLivekitImageImportCommand({expectedBootId, platform, expectedImageId}) {
  if (!/^[a-f0-9-]{36}$/i.test(expectedBootId ?? '') || !['linux/amd64', 'linux/arm64'].includes(platform ?? '') ||
      !/^sha256:[a-f0-9]{64}$/.test(expectedImageId ?? '')) {
    fail('R5_LIVEKIT_IMAGE_IMPORT_INPUT_INVALID');
  }
  const inspectFormat = '{{.Id}}|{{.Os}}|{{.Architecture}}';
  const platformArch = platform.slice('linux/'.length);
  return [
    'set -Eeuo pipefail',
    `expected_boot_id=${shellQuote(expectedBootId)}`,
    `expected_image_id=${shellQuote(expectedImageId)}`,
    `image_ref=${shellQuote(LIVEKIT_RESIDENT_IMAGE)}`,
    `source_image_ref=${shellQuote(LIVEKIT_RESIDENT_SOURCE_IMAGE)}`,
    `container_name=${shellQuote(LIVEKIT_RESIDENT_CONTAINER)}`,
    `platform=${shellQuote(platform)}`,
    `platform_arch=${shellQuote(platformArch)}`,
    `minimum_disk_kib=${LIVEKIT_RESIDENT_MIN_AVAILABLE_DISK_MIB * 1024}`,
    'cache_marker="$HOME/.local/state/catering-v2s/livekit-resident-image-cache"',
    'fail() { echo "R5_LIVEKIT_RESIDENT=FAIL; REASON=$1" >&2; exit 31; }',
    'boot_id=$(cat /proc/sys/kernel/random/boot_id) || fail HOST_BOOT_ID_READ_FAILED',
    'test "$boot_id" = "$expected_boot_id" || fail HOST_BOOT_ID_CHANGED',
    'docker info --format "{{.ID}}" >/dev/null || fail DOCKER_DAEMON_UNAVAILABLE',
    'docker_root=$(docker info --format "{{.DockerRootDir}}") || fail DOCKER_ROOT_READ_FAILED',
    'available_disk_kib=$(df -Pk "$docker_root" | awk \'NR==2 {print $4}\') || fail DOCKER_DISK_READ_FAILED',
    '[[ "$available_disk_kib" =~ ^[0-9]+$ ]] || fail DOCKER_DISK_VALUE_INVALID',
    'test "$available_disk_kib" -ge "$minimum_disk_kib" || fail RESOURCE_BUDGET_INSUFFICIENT_DOCKER_DISK',
    'if docker inspect "$container_name" >/dev/null 2>&1; then fail RESIDENT_CONTAINER_EXISTS; fi',
    'docker image load >/dev/null || fail IMAGE_IMPORT_FAILED',
    'docker image tag "$expected_image_id" "$image_ref" || fail IMAGE_TAG_FAILED',
    `readback=$(docker image inspect --platform "$platform" --format ${shellQuote(inspectFormat)} "$image_ref") || fail IMAGE_CACHE_READBACK_FAILED`,
    "IFS='|' read -r image_id image_os image_arch <<< \"$readback\"",
    'test "$image_id" = "$expected_image_id" || fail IMAGE_ID_MISMATCH',
    'test "$image_os" = linux && test "$image_arch" = "$platform_arch" || fail IMAGE_PLATFORM_MISMATCH',
    'cache_directory=$(dirname "$cache_marker") || fail CACHE_MARKER_PATH_FAILED',
    'mkdir -p "$cache_directory" || fail CACHE_MARKER_DIRECTORY_CREATE_FAILED',
    'test ! -L "$cache_directory" && test ! -L "$cache_marker" || fail CACHE_MARKER_SYMLINK',
    'marker_tmp="$cache_marker.$expected_boot_id.tmp"',
    'printf "%s\\t%s\\t%s\\n" "$source_image_ref" "$platform" "$image_id" > "$marker_tmp" || fail CACHE_MARKER_WRITE_FAILED',
    'chmod 600 "$marker_tmp" && mv -f "$marker_tmp" "$cache_marker" || fail CACHE_MARKER_COMMIT_FAILED',
    'printf "R5_LIVEKIT_IMAGE_READBACK\\tSOURCE_DIGEST\\t%s\\nR5_LIVEKIT_IMAGE_READBACK\\tID\\t%s\\nR5_LIVEKIT_IMAGE_READBACK\\tOS\\t%s\\nR5_LIVEKIT_IMAGE_READBACK\\tARCH\\t%s\\nR5_LIVEKIT_IMAGE_READBACK\\tPLATFORM\\t%s\\nR5_LIVEKIT_IMAGE_READBACK\\tAVAILABLE_DOCKER_DISK_KIB\\t%s\\n" "$source_image_ref" "$image_id" "$image_os" "$image_arch" "$platform" "$available_disk_kib"',
  ].join('\n') + '\n';
}

function validManifest(value, {host, fingerprint} = {}) {
  if (value?.schemaVersion !== 1 || value.kind !== LIVEKIT_RESIDENT_KIND || value.host !== host ||
      value.hostFingerprint !== fingerprint || value.containerName !== LIVEKIT_RESIDENT_CONTAINER ||
      !/^[a-f0-9]{64}$/.test(value.containerId ?? '') || !/^sha256:[a-f0-9]{64}$/.test(value.imageId ?? '') ||
      value.imageRef !== LIVEKIT_RESIDENT_IMAGE || value.sourceImageRef !== LIVEKIT_RESIDENT_SOURCE_IMAGE || !/^[a-f0-9]{64}$/.test(value.configSha256 ?? '') ||
      !/^[a-f0-9-]{36}$/i.test(value.attemptId ?? '') || !/^[a-f0-9-]{36}$/i.test(value.bootId ?? '') ||
      value.endpoint !== LIVEKIT_RESIDENT_ENDPOINT || value.signalUrl !== LIVEKIT_RESIDENT_SIGNAL_URL ||
      value.udpPort !== LIVEKIT_RESIDENT_UDP_PORT || !['RUNNING', 'STOPPED'].includes(value.state)) {
    fail('R5_LIVEKIT_RESIDENT_MANIFEST_INVALID');
  }
  return Object.freeze({...value});
}

export function readLivekitManifest(filePath = LIVEKIT_RESIDENT_MANIFEST, expected) {
  if (!existsSync(filePath)) return null;
  try { return validManifest(JSON.parse(readFileSync(filePath, 'utf8')), expected); }
  catch (error) {
    if (error?.code === 'R5_LIVEKIT_RESIDENT_MANIFEST_INVALID') throw error;
    fail('R5_LIVEKIT_RESIDENT_MANIFEST_INVALID');
  }
}

export function validateLivekitDevBinding({developmentResident, currentResident, host, fingerprint, expectedBootId} = {}) {
  if (!/^[a-z0-9._-]{3,128}$/i.test(host ?? '') || !/^[a-f0-9]{64}$/i.test(fingerprint ?? '') ||
      !/^[a-f0-9-]{36}$/i.test(expectedBootId ?? '')) fail('R5_LIVEKIT_DEV_BINDING_INPUT_INVALID');
  const development = validManifest(developmentResident, {host, fingerprint});
  const current = validManifest(currentResident, {host, fingerprint});
  if (development.state !== 'RUNNING' || current.state !== 'RUNNING') fail('R5_LIVEKIT_DEV_RESIDENT_NOT_RUNNING');
  if (development.bootId !== expectedBootId || current.bootId !== expectedBootId ||
      development.containerId !== current.containerId || development.imageId !== current.imageId ||
      development.endpoint !== current.endpoint || development.signalUrl !== current.signalUrl ||
      current.endpoint !== LIVEKIT_RESIDENT_ENDPOINT || current.signalUrl !== LIVEKIT_RESIDENT_SIGNAL_URL) {
    fail('R5_LIVEKIT_DEV_RESIDENT_IDENTITY_MISMATCH');
  }
  return Object.freeze({
    state: 'RUNNING',
    bootId: current.bootId,
    containerId: current.containerId,
    imageId: current.imageId,
    endpointRef: 'LIVEKIT_RESIDENT_ENDPOINT',
    signalTransport: 'WS',
  });
}

function writeManifest(filePath, value) {
  validManifest(value, {host: value.host, fingerprint: value.hostFingerprint});
  mkdirSync(path.dirname(filePath), {recursive: true, mode: 0o700});
  const temporary = `${filePath}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {flag: 'wx', mode: 0o600});
  renameSync(temporary, filePath);
  chmodSync(filePath, 0o600);
}

export function renderLivekitConfig(template, {apiKey, apiSecret}) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(apiKey ?? '') || !/^[A-Za-z0-9_-]{32,128}$/.test(apiSecret ?? '')) {
    fail('R5_LIVEKIT_RESIDENT_CREDENTIAL_INVALID');
  }
  if (!template.includes('__LIVEKIT_API_KEY__') || !template.includes('__LIVEKIT_API_SECRET__')) {
    fail('R5_LIVEKIT_RESIDENT_CONFIG_TEMPLATE_INVALID');
  }
  return template.replace('__LIVEKIT_API_KEY__', apiKey).replace('__LIVEKIT_API_SECRET__', apiSecret);
}

function parseCredentials(filePath) {
  if (!existsSync(filePath)) fail('R5_LIVEKIT_RESIDENT_CREDENTIAL_FILE_MISSING');
  const values = Object.fromEntries(readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean).map(line => {
    const separator = line.indexOf('=');
    if (separator < 1) fail('R5_LIVEKIT_RESIDENT_CREDENTIAL_FILE_INVALID');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
  return {
    apiKey: values.V2S_LIVEKIT_API_KEY,
    apiSecret: values.V2S_LIVEKIT_API_SECRET,
  };
}

function b64(value) { return Buffer.from(value, 'utf8').toString('base64'); }

export function renderLivekitRemoteScript({action, fingerprint, attemptId, configSha256, configBase64, composeBase64, expected}) {
  if (!['init', 'cache', 'check', 'start', 'stop'].includes(action) || !/^[a-f0-9]{64}$/i.test(fingerprint ?? '') ||
      !/^[a-f0-9-]{36}$/i.test(attemptId ?? '') || !/^[a-f0-9]{64}$/.test(configSha256 ?? '') ||
      (configBase64 !== undefined && !/^[A-Za-z0-9+/=]+$/.test(configBase64)) ||
      (composeBase64 !== undefined && !/^[A-Za-z0-9+/=]+$/.test(composeBase64))) fail('R5_LIVEKIT_RESIDENT_INPUT_INVALID');
  const containerId = expected?.containerId ?? '';
  const expectedBootId = expected?.bootId ?? '';
  if (['check', 'stop'].includes(action) &&
      (!/^[a-f0-9]{64}$/.test(containerId) || !/^[a-f0-9-]{36}$/i.test(expectedBootId))) {
    fail('R5_LIVEKIT_RESIDENT_EXPECTED_IDENTITY_INVALID');
  }
  const lines = [
    'set -Eeuo pipefail',
    `owner=${shellQuote('livekit-resident')}`,
    `fingerprint=${shellQuote(fingerprint)}`,
    `attempt_id=${shellQuote(attemptId)}`,
    `config_sha256=${shellQuote(configSha256)}`,
    `container_name=${shellQuote(LIVEKIT_RESIDENT_CONTAINER)}`,
    `image_ref=${shellQuote(LIVEKIT_RESIDENT_IMAGE)}`,
    `source_image_ref=${shellQuote(LIVEKIT_RESIDENT_SOURCE_IMAGE)}`,
    'cache_marker="$HOME/.local/state/catering-v2s/livekit-resident-image-cache"',
    `expected_container_id=${shellQuote(containerId)}`,
    `expected_boot_id=${shellQuote(expectedBootId)}`,
    `project_name=${shellQuote(`${LIVEKIT_RESIDENT_PROJECT}-${attemptId}`)}`,
    'root="$HOME/.local/state/catering-v2s/livekit-resident"',
    'boot_id=$(cat /proc/sys/kernel/random/boot_id) || { echo R5_LIVEKIT_HOST_BOOT_ID_READ_FAILED; exit 31; }',
    'test -n "$HOME" || { echo R5_LIVEKIT_HOME_MISSING; exit 31; }',
    'fail() { echo "R5_LIVEKIT_RESIDENT=FAIL; REASON=$1"; exit 31; }',
    'progress() { printf "R5_LIVEKIT_PROGRESS\\t%s\\n" "$1"; }',
    'project_network_ids() { docker network ls -q --filter "label=com.docker.compose.project=$project_name"; }',
    'inspect_container() { docker inspect -f "{{.Id}}|{{.Image}}|{{.Config.Image}}|{{.State.Running}}|{{index .Config.Labels \\\"com.catering-v2s.managed\\\"}}|{{index .Config.Labels \\\"com.catering-v2s.host-fingerprint\\\"}}|{{index .Config.Labels \\\"com.catering-v2s.config-sha256\\\"}}|{{index .Config.Labels \\\"com.catering-v2s.attempt-id\\\"}}|{{json .NetworkSettings.Ports}}" "$1"; }',
  ];
  if (action === 'init') {
    lines.push(
      'command -v docker >/dev/null || fail DOCKER_UNAVAILABLE',
      'if docker compose version >/dev/null 2>&1; then compose_mode=docker-compose-plugin; elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then compose_mode=standalone-docker-compose; else fail DOCKER_COMPOSE_UNAVAILABLE; fi',
      'docker info --format "{{.ID}}" >/dev/null || fail DOCKER_DAEMON_UNAVAILABLE',
      'docker_root=$(docker info --format "{{.DockerRootDir}}") || fail DOCKER_ROOT_READ_FAILED',
      'registry_mirrors=$(docker info --format "{{.RegistryConfig.Mirrors}}") || fail REGISTRY_MIRROR_READ_FAILED; case "$registry_mirrors" in *aliyuncs.com*|*aliyun.com*) registry_mirror_kind=ALIYUN ;; *daocloud*) registry_mirror_kind=DAOCLOUD ;; *huaweicloud*|*hwcloud*) registry_mirror_kind=HUAWEI ;; *tencentyun*|*tencentcloud*) registry_mirror_kind=TENCENT ;; ""|"[]"|"<no value>") registry_mirror_kind=NONE ;; *) registry_mirror_kind=OTHER ;; esac',
      'host_arch=$(uname -m) || fail HOST_ARCH_READ_FAILED',
      'case "$host_arch" in x86_64) image_platform=linux/amd64 ;; aarch64|arm64) image_platform=linux/arm64 ;; *) fail HOST_ARCH_UNSUPPORTED ;; esac',
      'available_memory_mib=$(awk \'/^MemAvailable:/ {print int($2/1024)}\' /proc/meminfo) || fail HOST_MEMORY_READ_FAILED',
      'available_disk_kib=$(df -Pk "$HOME" | awk \'NR==2 {print $4}\') || fail HOST_DISK_READ_FAILED',
      'docker_available_disk_kib=$(df -Pk "$docker_root" | awk \'NR==2 {print $4}\') || fail DOCKER_DISK_READ_FAILED',
      'image_cached=false; image_id=""; if test -f "$cache_marker" && test ! -L "$cache_marker"; then IFS=$\'\\t\' read -r marker_source marker_platform marker_id < "$cache_marker" || true; if [ "$marker_source" = "$source_image_ref" ] && [ "$marker_platform" = "$image_platform" ] && [[ "$marker_id" =~ ^sha256:[a-f0-9]{64}$ ]]; then image_facts=$(docker image inspect --platform "$image_platform" --format "{{.Id}}|{{.Os}}|{{.Architecture}}" "$image_ref" 2>/dev/null || true); IFS=\'|\' read -r observed_id observed_os observed_arch <<< "$image_facts"; expected_arch=${image_platform#linux/}; if [ "$observed_id" = "$marker_id" ] && [ "$observed_os" = linux ] && [ "$observed_arch" = "$expected_arch" ]; then image_cached=true; image_id=$observed_id; fi; fi; fi',
      'printf "R5_LIVEKIT_RESIDENT\\tSTATUS\\tPASS\\nR5_LIVEKIT_RESIDENT\\tBOOT_ID\\t%s\\nR5_LIVEKIT_RESIDENT\\tHOST_ARCH\\t%s\\nR5_LIVEKIT_RESIDENT\\tAVAILABLE_MEMORY_MIB\\t%s\\nR5_LIVEKIT_RESIDENT\\tAVAILABLE_HOME_DISK_KIB\\t%s\\nR5_LIVEKIT_RESIDENT\\tAVAILABLE_DOCKER_DISK_KIB\\t%s\\nR5_LIVEKIT_RESIDENT\\tIMAGE_CACHED\\t%s\\nR5_LIVEKIT_RESIDENT\\tIMAGE_ID\\t%s\\nR5_LIVEKIT_RESIDENT\\tREGISTRY_MIRROR_KIND\\t%s\\nR5_LIVEKIT_RESIDENT\\tCOMPOSE_MODE\\t%s\\n" "$boot_id" "$host_arch" "$available_memory_mib" "$available_disk_kib" "$docker_available_disk_kib" "$image_cached" "$image_id" "$registry_mirror_kind" "$compose_mode"',
    );
  } else if (action === 'cache') {
    lines.push(
      'command -v docker >/dev/null || fail DOCKER_UNAVAILABLE',
      'docker info --format "{{.ID}}" >/dev/null || fail DOCKER_DAEMON_UNAVAILABLE',
      `minimum_disk_kib=${LIVEKIT_RESIDENT_MIN_AVAILABLE_DISK_MIB * 1024}`,
      'progress IMAGE_CACHE_PREFLIGHT',
      'docker_root=$(docker info --format "{{.DockerRootDir}}") || fail DOCKER_ROOT_READ_FAILED',
      'available_docker_disk_kib=$(df -Pk "$docker_root" | awk \'NR==2 {print $4}\') || fail DOCKER_DISK_READ_FAILED',
      '[[ "$available_docker_disk_kib" =~ ^[0-9]+$ ]] || fail DOCKER_DISK_VALUE_INVALID',
      'printf "R5_LIVEKIT_RESOURCE_PREFLIGHT\\tPHASE\\tIMAGE_CACHE\\nR5_LIVEKIT_RESOURCE_PREFLIGHT\\tAVAILABLE_DOCKER_DISK_KIB\\t%s\\nR5_LIVEKIT_RESOURCE_PREFLIGHT\\tMIN_AVAILABLE_DISK_MIB\\t%s\\n" "$available_docker_disk_kib" "$((minimum_disk_kib / 1024))"',
      'test "$available_docker_disk_kib" -ge "$minimum_disk_kib" || fail RESOURCE_BUDGET_INSUFFICIENT_DOCKER_DISK',
      'host_arch=$(uname -m) || fail HOST_ARCH_READ_FAILED; case "$host_arch" in x86_64) image_platform=linux/amd64 ;; aarch64|arm64) image_platform=linux/arm64 ;; *) fail HOST_ARCH_UNSUPPORTED ;; esac; platform_arch=${image_platform#linux/}',
      'image_cached_before=false; image_id=""; if test -f "$cache_marker" && test ! -L "$cache_marker"; then IFS=$\'\\t\' read -r marker_source marker_platform marker_id < "$cache_marker" || true; if [ "$marker_source" = "$source_image_ref" ] && [ "$marker_platform" = "$image_platform" ] && [[ "$marker_id" =~ ^sha256:[a-f0-9]{64}$ ]]; then facts=$(docker image inspect --platform "$image_platform" --format "{{.Id}}|{{.Os}}|{{.Architecture}}" "$image_ref" 2>/dev/null || true); IFS=\'|\' read -r observed_id observed_os observed_arch <<< "$facts"; if [ "$observed_id" = "$marker_id" ] && [ "$observed_os" = linux ] && [ "$observed_arch" = "$platform_arch" ]; then image_cached_before=true; image_id=$observed_id; fi; fi; fi',
      'if [ "$image_cached_before" = true ]; then progress IMAGE_CACHE_HIT; else if docker inspect "$container_name" >/dev/null 2>&1; then fail RESIDENT_CONTAINER_EXISTS; fi; progress IMAGE_PULL; docker pull "$source_image_ref" || fail PINNED_IMAGE_PULL_FAILED; source_digests=$(docker image inspect -f "{{json .RepoDigests}}" "$source_image_ref") || fail IMAGE_SOURCE_READBACK_FAILED; case "$source_digests" in *"$source_image_ref"*) ;; *) fail PINNED_SOURCE_DIGEST_MISMATCH ;; esac; docker image tag "$source_image_ref" "$image_ref" || fail IMAGE_TAG_FAILED; image_id=$(docker image inspect --platform "$image_platform" -f "{{.Id}}" "$image_ref") || fail IMAGE_CACHE_READBACK_FAILED; cache_directory=$(dirname "$cache_marker") || fail CACHE_MARKER_PATH_FAILED; mkdir -p "$cache_directory" || fail CACHE_MARKER_DIRECTORY_CREATE_FAILED; test ! -L "$cache_directory" && test ! -L "$cache_marker" || fail CACHE_MARKER_SYMLINK; marker_tmp="$cache_marker.$attempt_id.tmp"; printf "%s\\t%s\\t%s\\n" "$source_image_ref" "$image_platform" "$image_id" > "$marker_tmp" && chmod 600 "$marker_tmp" && mv -f "$marker_tmp" "$cache_marker" || fail CACHE_MARKER_COMMIT_FAILED; fi',
      'progress IMAGE_CACHE_READBACK',
      'image_facts=$(docker image inspect --platform "$image_platform" --format "{{.Id}}|{{.Os}}|{{.Architecture}}" "$image_ref") || fail IMAGE_CACHE_READBACK_FAILED; IFS=\'|\' read -r observed_id observed_os observed_arch <<< "$image_facts"; test "$observed_id" = "$image_id" && test "$observed_os" = linux && test "$observed_arch" = "$platform_arch" || fail IMAGE_CACHE_READBACK_MISMATCH',
      'printf "R5_LIVEKIT_RESIDENT\\tSTATUS\\tPASS\\nR5_LIVEKIT_RESIDENT\\tBOOT_ID\\t%s\\nR5_LIVEKIT_RESIDENT\\tIMAGE_ID\\t%s\\nR5_LIVEKIT_RESIDENT\\tIMAGE_CACHED_BEFORE\\t%s\\nR5_LIVEKIT_RESIDENT\\tIMAGE_CACHED\\ttrue\\nR5_LIVEKIT_RESIDENT\\tAVAILABLE_DOCKER_DISK_KIB\\t%s\\n" "$boot_id" "$image_id" "$image_cached_before" "$available_docker_disk_kib"',
    );
  } else if (action === 'start') {
    if (!configBase64 || !composeBase64) fail('R5_LIVEKIT_RESIDENT_START_INPUT_MISSING');
    lines.push(
      'command -v docker >/dev/null || fail DOCKER_UNAVAILABLE',
      'command -v curl >/dev/null || fail CURL_UNAVAILABLE',
      'if docker compose version >/dev/null 2>&1; then compose() { docker compose "$@"; }; elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then compose() { docker-compose "$@"; }; else fail DOCKER_COMPOSE_UNAVAILABLE; fi',
      'docker info --format "{{.ID}}" >/dev/null || fail DOCKER_DAEMON_UNAVAILABLE',
      'docker_root=$(docker info --format "{{.DockerRootDir}}") || fail DOCKER_ROOT_READ_FAILED',
      `minimum_memory_mib=${LIVEKIT_RESIDENT_MIN_AVAILABLE_MEMORY_MIB}`,
      `minimum_disk_kib=${LIVEKIT_RESIDENT_MIN_AVAILABLE_DISK_MIB * 1024}`,
      'resource_preflight() { phase="$1"; available_memory_mib=$(awk \'/^MemAvailable:/ {print int($2/1024)}\' /proc/meminfo) || fail HOST_MEMORY_READ_FAILED; available_home_disk_kib=$(df -Pk "$HOME" | awk \'NR==2 {print $4}\') || fail HOST_DISK_READ_FAILED; available_docker_disk_kib=$(df -Pk "$docker_root" | awk \'NR==2 {print $4}\') || fail DOCKER_DISK_READ_FAILED; [[ "$available_memory_mib" =~ ^[0-9]+$ && "$available_home_disk_kib" =~ ^[0-9]+$ && "$available_docker_disk_kib" =~ ^[0-9]+$ ]] || fail HOST_RESOURCE_VALUE_INVALID; printf "R5_LIVEKIT_RESOURCE_PREFLIGHT\\tPHASE\\t%s\\nR5_LIVEKIT_RESOURCE_PREFLIGHT\\tAVAILABLE_MEMORY_MIB\\t%s\\nR5_LIVEKIT_RESOURCE_PREFLIGHT\\tAVAILABLE_HOME_DISK_KIB\\t%s\\nR5_LIVEKIT_RESOURCE_PREFLIGHT\\tAVAILABLE_DOCKER_DISK_KIB\\t%s\\nR5_LIVEKIT_RESOURCE_PREFLIGHT\\tMIN_AVAILABLE_MEMORY_MIB\\t%s\\nR5_LIVEKIT_RESOURCE_PREFLIGHT\\tMIN_AVAILABLE_DISK_MIB\\t%s\\n" "$phase" "$available_memory_mib" "$available_home_disk_kib" "$available_docker_disk_kib" "$minimum_memory_mib" "$((minimum_disk_kib / 1024))"; test "$available_memory_mib" -ge "$minimum_memory_mib" || fail RESOURCE_BUDGET_INSUFFICIENT_MEMORY; test "$available_home_disk_kib" -ge "$minimum_disk_kib" || fail RESOURCE_BUDGET_INSUFFICIENT_HOME_DISK; test "$available_docker_disk_kib" -ge "$minimum_disk_kib" || fail RESOURCE_BUDGET_INSUFFICIENT_DOCKER_DISK; }',
      'if docker inspect "$container_name" >/dev/null 2>&1; then fail UNMANIFESTED_CONTAINER_EXISTS; fi',
      'stale_network_ids=$(project_network_ids) || fail PROJECT_NETWORK_READ_FAILED; test -z "$stale_network_ids" || fail UNMANIFESTED_PROJECT_NETWORK_EXISTS',
      'progress START_PREFLIGHT',
      'resource_preflight BEFORE_COMPOSE_UP',
      'progress IMAGE_CACHE_READBACK',
      'host_arch=$(uname -m) || fail HOST_ARCH_READ_FAILED; case "$host_arch" in x86_64) image_platform=linux/amd64 ;; aarch64|arm64) image_platform=linux/arm64 ;; *) fail HOST_ARCH_UNSUPPORTED ;; esac; platform_arch=${image_platform#linux/}',
      'test -f "$cache_marker" && test ! -L "$cache_marker" || fail IMAGE_NOT_CACHED; IFS=$\'\\t\' read -r marker_source marker_platform marker_id < "$cache_marker" || fail IMAGE_NOT_CACHED; test "$marker_source" = "$source_image_ref" && test "$marker_platform" = "$image_platform" || fail IMAGE_NOT_CACHED; image_facts=$(docker image inspect --platform "$image_platform" --format "{{.Id}}|{{.Os}}|{{.Architecture}}" "$image_ref") || fail IMAGE_NOT_CACHED; IFS=\'|\' read -r image_id image_os image_arch <<< "$image_facts"; test "$image_id" = "$marker_id" && test "$image_os" = linux && test "$image_arch" = "$platform_arch" || fail IMAGE_CACHE_READBACK_MISMATCH',
      'image_cached_before=true',
      'cleanup_start_failure() { result=$?; if [ "$result" -eq 0 ]; then return; fi; found=$(docker inspect -f "{{.Id}}" "$container_name" 2>/dev/null || true); network_ids=$(project_network_ids 2>/dev/null || true); if [ -n "$found" ]; then facts=$(inspect_container "$found" 2>/dev/null || true); case "$facts" in "$found|$image_id|$image_ref|"*"|$owner|$fingerprint|$config_sha256|$attempt_id|"*) ;; *) echo R5_LIVEKIT_RUNNER_CLEANUP=FAIL_UNOWNED_CONTAINER; return ;; esac; fi; if [ -n "$found" ] || [ -n "$network_ids" ]; then test -s "$root/docker-compose.yaml" && test -s "$root/.env" || { echo R5_LIVEKIT_RUNNER_CLEANUP=FAIL_COMPOSE_INPUT; return; }; compose --project-name "$project_name" --file "$root/docker-compose.yaml" --project-directory "$root" down || { echo R5_LIVEKIT_RUNNER_CLEANUP=FAIL_COMPOSE_DOWN; return; }; fi; found=$(docker inspect -f "{{.Id}}" "$container_name" 2>/dev/null || true); network_ids=$(project_network_ids) || { echo R5_LIVEKIT_RUNNER_CLEANUP=FAIL_NETWORK_READBACK; return; }; test -z "$found" && test -z "$network_ids" || { echo R5_LIVEKIT_RUNNER_CLEANUP=FAIL_RESOURCE_REMAINS; return; }; if [ -e "$root" ]; then grep -Fx "$fingerprint|$config_sha256|$attempt_id" "$root/owner.txt" >/dev/null 2>&1 || { echo R5_LIVEKIT_RUNNER_CLEANUP=FAIL_UNOWNED_CONFIG; return; }; rm -rf -- "$root" || { echo R5_LIVEKIT_RUNNER_CLEANUP=FAIL_CONFIG; return; }; fi; test ! -e "$root" || { echo R5_LIVEKIT_RUNNER_CLEANUP=FAIL_CONFIG_READBACK; return; }; echo R5_LIVEKIT_RUNNER_CLEANUP=PASS; return "$result"; }',
      'trap cleanup_start_failure EXIT',
      'mkdir -p "$(dirname "$root")" || fail REMOTE_CONFIG_PARENT_CREATE_FAILED',
      'chmod 700 "$(dirname "$root")"',
      'test ! -L "$root" || fail REMOTE_CONFIG_DIRECTORY_SYMLINK',
      'mkdir "$root" || fail REMOTE_CONFIG_DIRECTORY_CREATE_FAILED',
      `printf '%s' ${shellQuote(`${fingerprint}|${configSha256}|${attemptId}`)} > "$root/owner.txt" || fail REMOTE_OWNER_MARKER_WRITE_FAILED`,
      'progress CONFIG_WRITE',
      `printf '%s' ${shellQuote(configBase64)} | base64 -d > "$root/livekit.yaml" || fail REMOTE_CONFIG_WRITE_FAILED`,
      `printf '%s' ${shellQuote(composeBase64)} | base64 -d > "$root/docker-compose.yaml" || fail REMOTE_COMPOSE_WRITE_FAILED`,
      'chmod 600 "$root/livekit.yaml" "$root/docker-compose.yaml" "$root/owner.txt"',
      `printf 'LIVEKIT_HOST_FINGERPRINT=%s\\nLIVEKIT_CONFIG_SHA256=%s\\nLIVEKIT_ATTEMPT_ID=%s\\n' "$fingerprint" "$config_sha256" "$attempt_id" > "$root/.env"`,
      'progress COMPOSE_UP',
      'compose --project-name "$project_name" --file "$root/docker-compose.yaml" --project-directory "$root" up --detach || fail COMPOSE_UP_FAILED',
      'container_id=$(docker inspect -f "{{.Id}}" "$container_name") || fail CONTAINER_ID_READ_FAILED',
      'facts=$(inspect_container "$container_id") || fail CONTAINER_IDENTITY_READ_FAILED',
      'case "$facts" in "$container_id|$image_id|$image_ref|true|$owner|$fingerprint|$config_sha256|$attempt_id|"*) ;; *) fail CONTAINER_OWNERSHIP_MISMATCH ;; esac',
      'port_bindings=$(docker inspect -f "{{json .HostConfig.PortBindings}}" "$container_id") || fail PORT_BINDINGS_READ_FAILED',
      'python3 -c \'import json,sys; p=json.loads(sys.argv[1]); expected={"7880/tcp", "7882/udp"}; ok=set(p)==expected and all(len(p[k])==1 and p[k][0]["HostPort"]==k.split("/")[0] for k in expected); sys.exit(0 if ok else 1)\' "$port_bindings" || fail PORT_BINDINGS_MISMATCH',
      'grep -Fx "$fingerprint|$config_sha256|$attempt_id" "$root/owner.txt" >/dev/null || fail REMOTE_OWNER_MARKER_MISMATCH',
      'progress HEALTHCHECK',
      'curl --silent --output /dev/null --max-time 3 http://127.0.0.1:7880 || fail HTTP_ENDPOINT_NOT_READY',
      'docker_root=$(docker info --format "{{.DockerRootDir}}") || fail DOCKER_ROOT_READ_FAILED; docker_available_disk_kib=$(df -Pk "$docker_root" | awk \'NR==2 {print $4}\') || fail DOCKER_DISK_READ_FAILED',
      'printf "R5_LIVEKIT_RESIDENT\\tSTATUS\\tPASS\\nR5_LIVEKIT_RESIDENT\\tBOOT_ID\\t%s\\nR5_LIVEKIT_RESIDENT\\tCONTAINER_ID\\t%s\\nR5_LIVEKIT_RESIDENT\\tIMAGE_ID\\t%s\\nR5_LIVEKIT_RESIDENT\\tIMAGE_CACHED_BEFORE\\t%s\\nR5_LIVEKIT_RESIDENT\\tAVAILABLE_MEMORY_MIB\\t%s\\nR5_LIVEKIT_RESIDENT\\tAVAILABLE_HOME_DISK_KIB\\t%s\\nR5_LIVEKIT_RESIDENT\\tAVAILABLE_DOCKER_DISK_KIB\\t%s\\nR5_LIVEKIT_RESIDENT\\tHTTP_READY\\tPASS\\nR5_LIVEKIT_RESIDENT\\tWS_SIGNAL_READY\\tNOT_PROVEN\\nR5_LIVEKIT_RESIDENT\\tUDP_PORT_BOUND\\tPASS\\nR5_LIVEKIT_RESIDENT\\tUDP_MEDIA_PROOF\\tNOT_RUN\\nR5_LIVEKIT_RESIDENT\\tT04_STATUS\\tPARTIAL\\nR5_LIVEKIT_RESIDENT\\tENDPOINT_REF\\tLIVEKIT_RESIDENT_ENDPOINT\\nR5_LIVEKIT_RESIDENT\\tSIGNAL_TRANSPORT\\tWS\\n" "$boot_id" "$container_id" "$image_id" "$image_cached_before" "$available_memory_mib" "$available_home_disk_kib" "$available_docker_disk_kib"',
    );
  } else if (action === 'check') {
    lines.push(
      'command -v docker >/dev/null || fail DOCKER_UNAVAILABLE',
      'test "$boot_id" = "$expected_boot_id" || fail HOST_BOOT_ID_CHANGED',
      'network_ids=$(project_network_ids) || fail PROJECT_NETWORK_READ_FAILED; test -n "$network_ids" || fail PROJECT_NETWORK_MISSING',
      'facts=$(inspect_container "$expected_container_id") || fail CONTAINER_IDENTITY_READ_FAILED',
      `expected_prefix="$expected_container_id|${expected.imageId}|$image_ref|true|$owner|$fingerprint|$config_sha256|$attempt_id|"`,
      'case "$facts" in "$expected_prefix"*) ;; *) fail CONTAINER_OWNERSHIP_MISMATCH ;; esac',
      'test -f "$root/owner.txt" || fail REMOTE_OWNER_MARKER_MISSING',
      'grep -Fx "$fingerprint|$config_sha256|$attempt_id" "$root/owner.txt" >/dev/null || fail REMOTE_OWNER_MARKER_MISMATCH',
      'curl --silent --output /dev/null --max-time 3 http://127.0.0.1:7880 || fail HTTP_ENDPOINT_NOT_READY',
      'printf "R5_LIVEKIT_RESIDENT\\tSTATUS\\tPASS\\nR5_LIVEKIT_RESIDENT\\tBOOT_ID\\t%s\\nR5_LIVEKIT_RESIDENT\\tCONTAINER_ID\\t%s\\nR5_LIVEKIT_RESIDENT\\tHTTP_READY\\tPASS\\nR5_LIVEKIT_RESIDENT\\tWS_SIGNAL_READY\\tNOT_PROVEN\\nR5_LIVEKIT_RESIDENT\\tUDP_PORT_BOUND\\tPASS\\nR5_LIVEKIT_RESIDENT\\tUDP_MEDIA_PROOF\\tNOT_RUN\\nR5_LIVEKIT_RESIDENT\\tT04_STATUS\\tPARTIAL\\nR5_LIVEKIT_RESIDENT\\tIMAGE_ID\\t%s\\nR5_LIVEKIT_RESIDENT\\tENDPOINT_REF\\tLIVEKIT_RESIDENT_ENDPOINT\\nR5_LIVEKIT_RESIDENT\\tSIGNAL_TRANSPORT\\tWS\\n" "$boot_id" "$expected_container_id" ' + shellQuote(expected.imageId),
    );
  } else {
    lines.push(
      'facts=$(inspect_container "$expected_container_id") || fail CONTAINER_IDENTITY_READ_FAILED',
      `expected_prefix="$expected_container_id|${expected.imageId}|$image_ref|true|$owner|$fingerprint|$config_sha256|$attempt_id|"`,
      'case "$facts" in "$expected_prefix"*) ;; *) fail CONTAINER_OWNERSHIP_MISMATCH ;; esac',
      'test "$boot_id" = "$expected_boot_id" || fail HOST_BOOT_ID_CHANGED',
      'network_ids=$(project_network_ids) || fail PROJECT_NETWORK_READ_FAILED; test -n "$network_ids" || fail PROJECT_NETWORK_MISSING',
      'test -f "$root/owner.txt" || fail REMOTE_OWNER_MARKER_MISSING',
      'grep -Fx "$fingerprint|$config_sha256|$attempt_id" "$root/owner.txt" >/dev/null || fail REMOTE_OWNER_MARKER_MISMATCH',
      'command -v docker >/dev/null || fail DOCKER_UNAVAILABLE',
      'if docker compose version >/dev/null 2>&1; then compose() { docker compose "$@"; }; elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then compose() { docker-compose "$@"; }; else fail DOCKER_COMPOSE_UNAVAILABLE; fi',
      'compose --project-name "$project_name" --file "$root/docker-compose.yaml" --project-directory "$root" down || fail COMPOSE_DOWN_FAILED',
      'container_remaining=$(docker inspect -f "{{.Id}}" "$expected_container_id" 2>/dev/null || true); network_remaining=$(project_network_ids) || fail NETWORK_CLEANUP_READBACK_FAILED; test -z "$container_remaining" && test -z "$network_remaining" || fail COMPOSE_RESOURCE_CLEANUP_READBACK_FAILED',
      'rm -rf -- "$root" || fail REMOTE_CONFIG_CLEANUP_FAILED',
      'test ! -e "$root" || fail REMOTE_CONFIG_CLEANUP_READBACK_FAILED',
      'printf "R5_LIVEKIT_RESIDENT\tSTATUS\tSTOPPED\\nR5_LIVEKIT_RESIDENT\tCLEANUP\tPASS\\nR5_LIVEKIT_RESIDENT\tCONTAINER_ID\t%s\\nR5_LIVEKIT_RESIDENT\tBOOT_ID\t%s\\n" "$expected_container_id" "$boot_id"',
    );
  }
  return `${lines.join('\n')}\n`;
}

function parseReport(output) {
  const fields = {};
  for (const line of String(output ?? '').split(/\r?\n/)) {
    const match = line.match(/^R5_LIVEKIT_RESIDENT\t([A-Z_]+)\t([^\r\n]*)$/);
    if (match) fields[match[1]] = match[2];
  }
  if (!['PASS', 'STOPPED'].includes(fields.STATUS) || !/^[a-f0-9-]{36}$/i.test(fields.BOOT_ID ?? '')) fail('R5_LIVEKIT_RESIDENT_REPORT_INVALID');
  return fields;
}

export function redactLivekitOutput(output, secrets) {
  return secrets
    .filter(secret => typeof secret === 'string' && secret.length > 0)
    .reduce((redacted, secret) => redacted.replaceAll(secret, '[REDACTED]'), String(output ?? ''));
}

export function parseDockerPullLayerProgress(line) {
  const match = String(line ?? '').match(/^([a-f0-9]{12}): (Pulling fs layer|Waiting|Verifying Checksum|Download complete|Pull complete|Already exists|Downloading|Extracting)(?:\s+\[[^\]]*\])?(?:\s+([0-9.]+(?:B|kB|MB|GB|TB)\/[0-9.]+(?:B|kB|MB|GB|TB)))?$/i);
  return match ? {layer: match[1], status: match[2], transfer: match[3]} : null;
}

function inspectLocalImage(platform) {
  const result = spawnSync('docker', [
    'image', 'inspect', '--platform', platform,
    '--format', '{{.Id}}|{{.Os}}|{{.Architecture}}|{{json .RepoDigests}}',
    LIVEKIT_RESIDENT_SOURCE_IMAGE,
  ], {encoding: 'utf8', timeout: 30_000, maxBuffer: 16 * 1024});
  if (result.error || result.status !== 0) fail('R5_LIVEKIT_LOCAL_PINNED_IMAGE_NOT_AVAILABLE');
  const [imageId, osName, architecture, repoDigestsJson] = result.stdout.trim().split('|');
  let repoDigests;
  try { repoDigests = JSON.parse(repoDigestsJson); } catch { fail('R5_LIVEKIT_LOCAL_IMAGE_INSPECT_INVALID'); }
  const expectedArchitecture = platform.slice('linux/'.length);
  if (!/^sha256:[a-f0-9]{64}$/.test(imageId ?? '') || osName !== 'linux' || architecture !== expectedArchitecture ||
      !Array.isArray(repoDigests) || !repoDigests.includes(LIVEKIT_RESIDENT_SOURCE_IMAGE)) {
    fail('R5_LIVEKIT_LOCAL_PINNED_IMAGE_READBACK_MISMATCH');
  }
  return {imageId, platform, architecture};
}

export function parseLivekitImageImportReport(output) {
  const fields = {};
  for (const line of String(output ?? '').split(/\r?\n/)) {
    const match = line.match(/^R5_LIVEKIT_IMAGE_READBACK\t([A-Z_]+)\t([^\r\n]*)$/);
    if (match) fields[match[1]] = match[2];
  }
  const expectedArchitecture = fields.PLATFORM?.slice('linux/'.length);
  if (fields.SOURCE_DIGEST !== LIVEKIT_RESIDENT_SOURCE_IMAGE ||
      !/^sha256:[a-f0-9]{64}$/.test(fields.ID ?? '') || fields.OS !== 'linux' ||
      fields.ARCH !== expectedArchitecture || !['amd64', 'arm64'].includes(expectedArchitecture ?? '') ||
      !/^[0-9]+$/.test(fields.AVAILABLE_DOCKER_DISK_KIB ?? '')) {
    fail('R5_LIVEKIT_IMAGE_IMPORT_REPORT_INVALID');
  }
  return Object.freeze(fields);
}

function writeProgress(action, attemptId, stage, startedAt, extra = {}) {
  process.stdout.write(`${JSON.stringify({kind: 'R5_LIVEKIT_PROGRESS', action, attemptId, stage, elapsedMs: Date.now() - startedAt, ...extra})}\n`);
}

function safeLogLine(logDescriptor, source, line, secrets) {
  const safe = redactLivekitOutput(line, secrets);
  writeSync(logDescriptor, `${new Date().toISOString()}\t${source}\t${safe}\n`);
  return safe;
}

function runSshWithProgress({host, action, attemptId, script, logPath, secrets}) {
  return new Promise((resolve, reject) => {
    const logDescriptor = openSync(logPath, 'wx', 0o600);
    chmodSync(logPath, 0o600);
    const startedAt = Date.now();
    const child = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, 'bash', '-s'], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const captured = {stdout: '', stderr: ''};
    const buffered = {stdout: '', stderr: ''};
    let stage = 'REMOTE_COMMAND_START';
    let spawnError = null;
    let logError = null;
    let settled = false;
    const heartbeat = setInterval(() => {
      writeProgress(action, attemptId, stage, startedAt, {heartbeat: true});
    }, 15_000);
    writeProgress(action, attemptId, stage, startedAt);

    const consumeLine = (source, line) => {
      if (!line) return;
      let safe;
      try {
        safe = safeLogLine(logDescriptor, source, line, secrets);
      } catch (error) {
        logError = error;
        child.kill('SIGTERM');
        return;
      }
      const phase = safe.match(/^R5_LIVEKIT_PROGRESS\t([A-Z0-9_]+)$/);
      if (phase) {
        stage = phase[1];
        writeProgress(action, attemptId, stage, startedAt);
        return;
      }
      if (action === 'cache' && stage === 'IMAGE_PULL') {
        const layer = parseDockerPullLayerProgress(safe);
        if (layer) writeProgress(action, attemptId, stage, startedAt, layer);
      }
    };
    const consume = (source, chunk) => {
      const value = chunk.toString('utf8');
      captured[source] += value;
      buffered[source] += value;
      while (true) {
        const boundary = buffered[source].search(/[\r\n]/);
        if (boundary < 0) break;
        const line = buffered[source].slice(0, boundary);
        const delimiterLength = buffered[source][boundary] === '\r' && buffered[source][boundary + 1] === '\n' ? 2 : 1;
        buffered[source] = buffered[source].slice(boundary + delimiterLength);
        consumeLine(source, line);
      }
    };
    child.stdout.on('data', chunk => consume('stdout', chunk));
    child.stderr.on('data', chunk => consume('stderr', chunk));
    child.stdin.on('error', error => {
      if (error.code !== 'EPIPE') spawnError = error;
    });
    child.once('error', error => { spawnError = error; });
    const finish = (code, signal) => {
      if (settled) return;
      settled = true;
      clearInterval(heartbeat);
      for (const source of ['stdout', 'stderr']) {
        if (buffered[source]) consumeLine(source, buffered[source]);
      }
      try { closeSync(logDescriptor); } catch {}
      if (logError) {
        reject(Object.assign(new Error('R5_LIVEKIT_RESIDENT_LOG_WRITE_FAILED'), {code: 'R5_LIVEKIT_RESIDENT_LOG_WRITE_FAILED'}));
      } else if (spawnError) {
        reject(Object.assign(new Error(spawnError.code ?? 'R5_LIVEKIT_SSH_SPAWN_FAILED'), {code: spawnError.code ?? 'R5_LIVEKIT_SSH_SPAWN_FAILED'}));
      } else {
        resolve({status: code, signal, stdout: captured.stdout, stderr: captured.stderr});
      }
    };
    child.once('close', finish);
    child.stdin.end(script);
  });
}

function runDockerImageImport({host, attemptId, expectedBootId, image, logPath}) {
  return new Promise((resolve, reject) => {
    const logDescriptor = openSync(logPath, 'wx', 0o600);
    chmodSync(logPath, 0o600);
    const startedAt = Date.now();
    const remoteScript = renderLivekitImageImportCommand({expectedBootId, platform: image.platform, expectedImageId: image.imageId});
    const sshCommand = `bash -c ${shellQuote(remoteScript)}`;
    const dockerSave = spawn('docker', ['image', 'save', '--platform', image.platform, LIVEKIT_RESIDENT_SOURCE_IMAGE], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const ssh = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, sshCommand], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const captured = {stdout: '', stderr: ''};
    const buffered = {stdout: '', stderr: ''};
    let saveStatus;
    let sshStatus;
    let saveSignal;
    let sshSignal;
    let saveClosed = false;
    let sshClosed = false;
    let transferBytes = 0;
    let logError = null;
    let spawnError = null;
    let settled = false;
    let transferStage = 'IMAGE_EXPORT_AND_IMPORT';
    const onSignal = signal => {
      dockerSave.kill(signal);
      ssh.kill(signal);
    };
    const onSigint = () => onSignal('SIGINT');
    const onSigterm = () => onSignal('SIGTERM');
    process.on('SIGINT', onSigint);
    process.on('SIGTERM', onSigterm);
    const heartbeat = setInterval(() => {
      writeProgress('import', attemptId, transferStage, startedAt, {heartbeat: true, transferBytes});
    }, 15_000);
    writeProgress('import', attemptId, transferStage, startedAt, {platform: image.platform});

    const consumeLine = (source, line) => {
      if (!line) return;
      try { safeLogLine(logDescriptor, source, line, [host]); }
      catch (error) {
        logError = error;
        dockerSave.kill('SIGTERM');
        ssh.kill('SIGTERM');
        return;
      }
      if (source === 'stdout' && line.startsWith('R5_LIVEKIT_IMAGE_READBACK\t')) transferStage = 'REMOTE_IMAGE_READBACK';
    };
    const consume = (source, chunk) => {
      const value = chunk.toString('utf8');
      captured[source] += value;
      buffered[source] += value;
      if (captured[source].length > 64 * 1024) {
        logError = Object.assign(new Error('R5_LIVEKIT_IMAGE_IMPORT_OUTPUT_LIMIT'), {code: 'R5_LIVEKIT_IMAGE_IMPORT_OUTPUT_LIMIT'});
        dockerSave.kill('SIGTERM');
        ssh.kill('SIGTERM');
        return;
      }
      while (true) {
        const boundary = buffered[source].search(/[\r\n]/);
        if (boundary < 0) break;
        const line = buffered[source].slice(0, boundary);
        const delimiterLength = buffered[source][boundary] === '\r' && buffered[source][boundary + 1] === '\n' ? 2 : 1;
        buffered[source] = buffered[source].slice(boundary + delimiterLength);
        consumeLine(source, line);
      }
    };
    const finish = () => {
      if (settled || !saveClosed || !sshClosed) return;
      settled = true;
      clearInterval(heartbeat);
      process.off('SIGINT', onSigint);
      process.off('SIGTERM', onSigterm);
      for (const source of ['stdout', 'stderr']) if (buffered[source]) consumeLine(source, buffered[source]);
      try { closeSync(logDescriptor); } catch {}
      if (logError) reject(logError);
      else if (spawnError) reject(Object.assign(new Error(spawnError.code ?? 'R5_LIVEKIT_IMAGE_IMPORT_SPAWN_FAILED'), {code: spawnError.code ?? 'R5_LIVEKIT_IMAGE_IMPORT_SPAWN_FAILED'}));
      else resolve({
        status: sshStatus === 0 && saveStatus === 0 ? 0 : (sshStatus ?? saveStatus),
        signal: sshSignal ?? saveSignal,
        stdout: captured.stdout,
        stderr: `${captured.stderr}\nLOCAL_DOCKER_SAVE_STATUS=${saveStatus ?? 'NONE'}`,
        transferBytes,
      });
    };
    dockerSave.stdout.on('data', chunk => { transferBytes += chunk.length; });
    ssh.stdout.on('data', chunk => consume('stdout', chunk));
    ssh.stderr.on('data', chunk => consume('stderr', chunk));
    dockerSave.stderr.on('data', chunk => consume('stderr', chunk));
    dockerSave.once('error', error => { spawnError = error; ssh.kill('SIGTERM'); });
    ssh.once('error', error => { spawnError = error; dockerSave.kill('SIGTERM'); });
    ssh.stdin.once('error', error => { if (error.code !== 'EPIPE') spawnError = error; });
    dockerSave.once('close', (code, signal) => { saveStatus = code; saveSignal = signal; saveClosed = true; finish(); });
    ssh.once('close', (code, signal) => { sshStatus = code; sshSignal = signal; sshClosed = true; finish(); });
    dockerSave.stdout.pipe(ssh.stdin);
  });
}

async function command(action, environment = process.env, {silent = false} = {}) {
  if (!['init', 'cache', 'import', 'check', 'start', 'stop'].includes(action)) fail('R5_LIVEKIT_RESIDENT_ACTION_INVALID');
  const trust = resolveTrustedRemoteHost(environment);
  const current = readLivekitManifest(LIVEKIT_RESIDENT_MANIFEST, {host: trust.host, fingerprint: trust.fingerprint});
  if (['check', 'stop'].includes(action) && !current) fail('R5_LIVEKIT_RESIDENT_MANIFEST_REQUIRED');
  if (['cache', 'import'].includes(action) && current?.state === 'RUNNING') fail('R5_LIVEKIT_RESIDENT_IMAGE_CACHE_WHILE_RUNNING');
  if (action === 'start' && current?.state === 'RUNNING') fail('R5_LIVEKIT_RESIDENT_ALREADY_RUNNING_USE_CHECK');
  if (action === 'stop' && current?.state === 'STOPPED') {
    process.stdout.write(`R5_LIVEKIT_RESIDENT_STOP=PASS; HOST_REF=MANAGED_REMOTE_DEV; CONTAINER_ID=${current.containerId}; ALREADY_STOPPED=true; IMAGE_CACHE=RETAINED\n`);
    return;
  }
  const attemptId = current?.state === 'RUNNING' ? current.attemptId : randomUUID();
  const logAttemptId = livekitResidentLogAttemptId(action, attemptId);
  if (action === 'import') {
    const initPath = livekitResidentAttemptLogPath('init', attemptId);
    mkdirSync(path.dirname(initPath), {recursive: true, mode: 0o700});
    chmodSync(path.dirname(initPath), 0o700);
    const initScript = renderLivekitRemoteScript({
      action: 'init', fingerprint: trust.fingerprint, attemptId, configSha256: '0'.repeat(64),
    });
    const initResult = await runSshWithProgress({host: trust.host, action: 'import', attemptId, script: initScript, logPath: initPath, secrets: [trust.host]});
    if (initResult.status !== 0) fail(`R5_LIVEKIT_RESIDENT_REMOTE_FAILED:${initResult.signal ?? initResult.status ?? 'NONE'}:${remoteFailureReason(`${initResult.stdout ?? ''}\n${initResult.stderr ?? ''}`)}:${attemptId}/init.log`);
    const preflight = parseReport(`${initResult.stdout ?? ''}\n${initResult.stderr ?? ''}`);
    if (!['x86_64', 'aarch64', 'arm64'].includes(preflight.HOST_ARCH ?? '') || !/^[a-f0-9-]{36}$/i.test(preflight.BOOT_ID ?? '') ||
        !['true', 'false'].includes(preflight.IMAGE_CACHED ?? '')) fail('R5_LIVEKIT_IMAGE_IMPORT_PREFLIGHT_INVALID');
    if (preflight.IMAGE_CACHED === 'true') {
      process.stdout.write(`R5_LIVEKIT_RESIDENT_IMPORT=PASS; HOST_REF=MANAGED_REMOTE_DEV; IMAGE_CACHED_BEFORE=true; IMAGE_ID=${preflight.IMAGE_ID}; SOURCE=${LIVEKIT_RESIDENT_SOURCE_IMAGE}; LOG=${initPath}\n`);
      return;
    }
    const platform = preflight.HOST_ARCH === 'x86_64' ? 'linux/amd64' : 'linux/arm64';
    const image = inspectLocalImage(platform);
    const importPath = livekitResidentAttemptLogPath('import', attemptId);
    const importResult = await runDockerImageImport({host: trust.host, attemptId, expectedBootId: preflight.BOOT_ID, image, logPath: importPath});
    if (importResult.status !== 0) fail(`R5_LIVEKIT_RESIDENT_REMOTE_FAILED:${importResult.signal ?? importResult.status ?? 'NONE'}:${remoteFailureReason(`${importResult.stdout ?? ''}\n${importResult.stderr ?? ''}`)}:${attemptId}/import.log`);
    const readback = parseLivekitImageImportReport(importResult.stdout);
    if (readback.ID !== image.imageId || readback.PLATFORM !== image.platform || readback.ARCH !== image.architecture) fail('R5_LIVEKIT_IMAGE_IMPORT_READBACK_MISMATCH');
    process.stdout.write(`R5_LIVEKIT_RESIDENT_IMPORT=PASS; HOST_REF=MANAGED_REMOTE_DEV; SOURCE=${LIVEKIT_RESIDENT_SOURCE_IMAGE}; IMAGE=${LIVEKIT_RESIDENT_IMAGE}; IMAGE_ID=${readback.ID}; PLATFORM=${readback.PLATFORM}; TRANSFER_BYTES=${importResult.transferBytes}; LOG=${importPath}\n`);
    return;
  }
  let credentials = {apiKey: '', apiSecret: ''};
  let livekitConfig = '';
  let compose = '';
  if (action === 'start') {
    credentials = parseCredentials(livekitCredentialsPath());
    const template = readFileSync(path.join(root, 'scripts/dev/livekit/livekit.yaml.template'), 'utf8');
    livekitConfig = renderLivekitConfig(template, credentials);
    compose = readFileSync(path.join(root, 'scripts/dev/livekit/docker-compose.yaml'), 'utf8');
  }
  const configSha256 = ['init', 'cache'].includes(action) ? '0'.repeat(64) : action === 'start' ? digest(livekitConfig) : current.configSha256;
  const script = renderLivekitRemoteScript({
    action,
    fingerprint: trust.fingerprint,
    attemptId,
    configSha256,
    configBase64: action === 'start' ? b64(livekitConfig) : undefined,
    composeBase64: action === 'start' ? b64(compose) : undefined,
    expected: ['check', 'stop'].includes(action) ? current : undefined,
  });
  const logPath = livekitResidentAttemptLogPath(action, logAttemptId);
  const attemptLogDirectory = path.dirname(logPath);
  mkdirSync(attemptLogDirectory, {recursive: true, mode: 0o700});
  chmodSync(attemptLogDirectory, 0o700);
  const result = await runSshWithProgress({host: trust.host, action, attemptId: logAttemptId, script, logPath, secrets: [trust.host, credentials.apiSecret, credentials.apiKey]});
  const output = redactLivekitOutput(`${result.stdout ?? ''}${result.stderr ?? ''}`, [trust.host, credentials.apiSecret, credentials.apiKey]);
  if (result.status !== 0) fail(`R5_LIVEKIT_RESIDENT_REMOTE_FAILED:${result.signal ?? result.status ?? 'NONE'}:${remoteFailureReason(output)}:${logAttemptId}/${path.basename(logPath)}`);
  const report = parseReport(output);
  if (action === 'init') {
    if (!['NONE', 'ALIYUN', 'DAOCLOUD', 'HUAWEI', 'TENCENT', 'OTHER'].includes(report.REGISTRY_MIRROR_KIND ?? '')) fail('R5_LIVEKIT_RESIDENT_REGISTRY_MIRROR_REPORT_INVALID');
    if (!['x86_64', 'aarch64', 'arm64'].includes(report.HOST_ARCH ?? '')) fail('R5_LIVEKIT_RESIDENT_HOST_ARCH_REPORT_INVALID');
    process.stdout.write(`R5_LIVEKIT_RESIDENT_INIT=PASS; HOST_REF=MANAGED_REMOTE_DEV; BOOT_ID=${report.BOOT_ID}; ARCH=${report.HOST_ARCH}; IMAGE_CACHED=${report.IMAGE_CACHED}; REGISTRY_MIRROR=${report.REGISTRY_MIRROR_KIND}; LOG=${logPath}\n`);
    return;
  }
  if (action === 'cache') {
    if (report.IMAGE_CACHED !== 'true' || !/^sha256:[a-f0-9]{64}$/.test(report.IMAGE_ID ?? '') ||
        !/^[0-9]+$/.test(report.AVAILABLE_DOCKER_DISK_KIB ?? '') || !['true', 'false'].includes(report.IMAGE_CACHED_BEFORE ?? '')) {
      fail('R5_LIVEKIT_RESIDENT_CACHE_REPORT_INVALID');
    }
    process.stdout.write(`R5_LIVEKIT_RESIDENT_CACHE=PASS; HOST_REF=MANAGED_REMOTE_DEV; IMAGE=${LIVEKIT_RESIDENT_IMAGE}; IMAGE_ID=${report.IMAGE_ID}; IMAGE_CACHED_BEFORE=${report.IMAGE_CACHED_BEFORE}; LOG=${logPath}\n`);
    return;
  }
  if (action === 'start') {
    if (!/^[a-f0-9]{64}$/.test(report.CONTAINER_ID ?? '') || !/^sha256:[a-f0-9]{64}$/.test(report.IMAGE_ID ?? '') ||
        !/^[0-9]+$/.test(report.AVAILABLE_MEMORY_MIB ?? '') || !/^[0-9]+$/.test(report.AVAILABLE_HOME_DISK_KIB ?? '') ||
        !/^[0-9]+$/.test(report.AVAILABLE_DOCKER_DISK_KIB ?? '') || !['true', 'false'].includes(report.IMAGE_CACHED_BEFORE ?? '')) {
      fail('R5_LIVEKIT_RESIDENT_REPORT_IDENTITY_INVALID');
    }
    const manifest = validManifest({
      schemaVersion: 1, kind: LIVEKIT_RESIDENT_KIND, host: trust.host, hostFingerprint: trust.fingerprint,
      bootId: report.BOOT_ID, containerName: LIVEKIT_RESIDENT_CONTAINER, containerId: report.CONTAINER_ID,
      imageRef: LIVEKIT_RESIDENT_IMAGE, sourceImageRef: LIVEKIT_RESIDENT_SOURCE_IMAGE, imageId: report.IMAGE_ID, configSha256, attemptId,
      endpoint: LIVEKIT_RESIDENT_ENDPOINT, signalUrl: LIVEKIT_RESIDENT_SIGNAL_URL,
      resourceObservation: {
        availableMemoryMiB: Number(report.AVAILABLE_MEMORY_MIB),
        availableHomeDiskKiB: Number(report.AVAILABLE_HOME_DISK_KIB),
        availableDockerDiskKiB: Number(report.AVAILABLE_DOCKER_DISK_KIB),
        minimumMemoryMiB: LIVEKIT_RESIDENT_MIN_AVAILABLE_MEMORY_MIB,
        minimumDiskMiB: LIVEKIT_RESIDENT_MIN_AVAILABLE_DISK_MIB,
        imageCachedBefore: report.IMAGE_CACHED_BEFORE === 'true',
      },
      udpPort: LIVEKIT_RESIDENT_UDP_PORT, state: 'RUNNING', observedAt: new Date().toISOString(),
    }, {host: trust.host, fingerprint: trust.fingerprint});
    writeManifest(LIVEKIT_RESIDENT_MANIFEST, manifest);
    process.stdout.write(`R5_LIVEKIT_RESIDENT_START=PASS; HOST_REF=MANAGED_REMOTE_DEV; CONTAINER_ID=${manifest.containerId}; IMAGE_ID=${manifest.imageId}; ENDPOINT_REF=LIVEKIT_RESIDENT_ENDPOINT; SIGNAL_TRANSPORT=WS; LOG=${logPath}\n`);
    return;
  }
  if (action === 'check') {
    if (!silent) process.stdout.write(`R5_LIVEKIT_RESIDENT_CHECK=PASS; HOST_REF=MANAGED_REMOTE_DEV; CONTAINER_ID=${current.containerId}; IMAGE_ID=${current.imageId}; ENDPOINT_REF=LIVEKIT_RESIDENT_ENDPOINT; SIGNAL_TRANSPORT=WS; LOG=${logPath}\n`);
    return;
  }
  if (report.STATUS !== 'STOPPED' || report.CONTAINER_ID !== current.containerId) fail('R5_LIVEKIT_RESIDENT_STOP_REPORT_INVALID');
  writeManifest(LIVEKIT_RESIDENT_MANIFEST, {...current, state: 'STOPPED', stoppedAt: new Date().toISOString()});
  process.stdout.write(`R5_LIVEKIT_RESIDENT_STOP=PASS; HOST_REF=MANAGED_REMOTE_DEV; CONTAINER_ID=${current.containerId}; IMAGE_CACHE=RETAINED; LOG=${logPath}\n`);
}

export async function ensureLivekitResident({host, fingerprint, expectedBootId}) {
  if (!/^[a-z0-9._-]{3,128}$/i.test(host ?? '') || !/^[a-f0-9]{64}$/i.test(fingerprint ?? '') ||
      !/^[a-f0-9-]{36}$/i.test(expectedBootId ?? '')) fail('R5_LIVEKIT_RESIDENT_ENSURE_INPUT_INVALID');
  const environment = {
    ...process.env,
    V2S_DEV_REMOTE_HOST: host,
    V2S_DEV_REMOTE_HOST_SHA256: fingerprint,
  };
  const current = readLivekitManifest(LIVEKIT_RESIDENT_MANIFEST, {host, fingerprint});
  const action = current?.state === 'RUNNING' ? 'check' : 'start';
  try {
    await command(action, environment);
  } catch (error) {
    fail(formatLivekitEnsureFailure(action, {status: error?.code ?? 'REMOTE_FAILED', stderr: error?.message ?? ''}));
  }
  const manifest = readLivekitManifest(LIVEKIT_RESIDENT_MANIFEST, {host, fingerprint});
  if (manifest?.state !== 'RUNNING' || manifest.bootId !== expectedBootId) fail('R5_LIVEKIT_RESIDENT_HOST_BOOT_ID_MISMATCH');
  return manifest;
}

export async function checkLivekitResidentForManagedDev({host, fingerprint, expectedBootId, developmentResident} = {}) {
  const environment = {
    ...process.env,
    V2S_DEV_REMOTE_HOST: host,
    V2S_DEV_REMOTE_HOST_SHA256: fingerprint,
  };
  const current = readLivekitManifest(LIVEKIT_RESIDENT_MANIFEST, {host, fingerprint});
  const binding = validateLivekitDevBinding({developmentResident, currentResident: current, host, fingerprint, expectedBootId});
  await command('check', environment, {silent: true});
  const readback = readLivekitManifest(LIVEKIT_RESIDENT_MANIFEST, {host, fingerprint});
  return validateLivekitDevBinding({developmentResident, currentResident: readback, host, fingerprint, expectedBootId});
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  command(process.argv[2]).catch(error => {
    process.stderr.write(`${error?.code ?? error?.message ?? 'R5_LIVEKIT_RESIDENT_FAILED'}\n`);
    process.exitCode = 1;
  });
}
