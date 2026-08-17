import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const wrapperPropertiesPath = 'gradle/wrapper/gradle-wrapper.properties';

function wrapperDistributionMetadata(root, readFile = fs.readFileSync) {
  const propertiesFile = path.join(root, wrapperPropertiesPath);
  if (!fs.existsSync(propertiesFile)) throw new Error('GRADLE_WRAPPER_PROPERTIES_MISSING');
  const properties = readFile(propertiesFile, 'utf8');
  const distributionUrl = properties
    .match(/^distributionUrl=(.+)$/m)?.[1]
    ?.trim()
    ?.replaceAll('\\:', ':');
  if (!distributionUrl) throw new Error('GRADLE_WRAPPER_DISTRIBUTION_URL_MISSING');
  let archiveName;
  try {
    archiveName = path.posix.basename(new URL(distributionUrl).pathname);
  } catch {
    throw new Error('GRADLE_WRAPPER_DISTRIBUTION_URL_INVALID');
  }
  if (!/^gradle-[^/]+-(?:bin|all|src)\.zip$/.test(archiveName))
    throw new Error('GRADLE_WRAPPER_DISTRIBUTION_ARCHIVE_INVALID');
  return {
    archiveName: archiveName.slice(0, -4),
    homeName: archiveName.slice(0, -4).replace(/-(?:bin|all|src)$/, ''),
  };
}

function gradleUserHome(root, environment) {
  const configured =
    typeof environment.GRADLE_USER_HOME === 'string' && environment.GRADLE_USER_HOME.trim() !== ''
      ? environment.GRADLE_USER_HOME.trim()
      : path.join(os.homedir(), '.gradle');
  return path.isAbsolute(configured) ? configured : path.resolve(root, configured);
}

export function validateGradleHome(value, {distributionAvailable = true, exists = fs.existsSync} = {}) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error('ENV_GRADLE_HOME_REQUIRED');
  if (!path.isAbsolute(value)) throw new Error('ENV_GRADLE_HOME_INVALID');
  if (!distributionAvailable || !exists(path.join(value, 'bin', 'gradle')))
    throw new Error('ENV_GRADLE_DISTRIBUTION_UNAVAILABLE');
  return value;
}

export function findWrapperDistributionHome({
  root = defaultRoot,
  environment = process.env,
  exists = fs.existsSync,
  readdir = fs.readdirSync,
} = {}) {
  const metadata = wrapperDistributionMetadata(root);
  const distributionRoot = path.join(gradleUserHome(root, environment), 'wrapper', 'dists', metadata.archiveName);
  if (!exists(distributionRoot)) return undefined;
  for (const entry of readdir(distributionRoot, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const home = path.join(distributionRoot, entry.name, metadata.homeName);
    if (exists(path.join(home, 'bin', 'gradle'))) return home;
  }
  return undefined;
}

export function resolveWrapperDistributionHome({
  root = defaultRoot,
  environment = process.env,
  wrapperPath = path.join(root, 'gradlew'),
  execute = spawnSync,
  locateWrapperDistributionHome,
  exists = fs.existsSync,
} = {}) {
  if (!exists(wrapperPath)) throw new Error('GRADLE_WRAPPER_MISSING');
  const locate = locateWrapperDistributionHome ?? (() => findWrapperDistributionHome({root, environment}));
  let home = locate();
  if (home) return home;
  const result = execute(wrapperPath, ['--version'], {cwd: root, encoding: 'utf8', env: {...environment}});
  if (result?.status !== 0)
    throw new Error(`GRADLE_WRAPPER_BOOTSTRAP_FAILED:${String(result?.stderr ?? result?.stdout ?? '').trim()}`);
  home = locate();
  if (!home) throw new Error('GRADLE_WRAPPER_DISTRIBUTION_UNAVAILABLE');
  return home;
}

export function resolveGradleHome({root = defaultRoot, environment = process.env, ...options} = {}) {
  if (typeof environment.V2S_GRADLE_HOME === 'string' && environment.V2S_GRADLE_HOME.trim() !== '') {
    return {
      path: validateGradleHome(environment.V2S_GRADLE_HOME.trim(), {exists: options.exists}),
      source: 'V2S_GRADLE_HOME',
    };
  }
  return {
    path: resolveWrapperDistributionHome({root, environment, ...options}),
    source: 'GRADLE_WRAPPER',
  };
}

export function resolveGradleCommand({root = defaultRoot, environment = process.env, ...options} = {}) {
  if (typeof environment.V2S_GRADLE_HOME === 'string' && environment.V2S_GRADLE_HOME.trim() !== '') {
    const home = validateGradleHome(environment.V2S_GRADLE_HOME.trim(), {exists: options.exists});
    return {command: path.join(home, 'bin', 'gradle'), source: 'V2S_GRADLE_HOME'};
  }
  const wrapper = options.wrapperPath ?? path.join(root, 'gradlew');
  const exists = options.exists ?? fs.existsSync;
  if (!exists(wrapper)) throw new Error('GRADLE_WRAPPER_MISSING');
  return {command: wrapper, source: 'GRADLE_WRAPPER'};
}
