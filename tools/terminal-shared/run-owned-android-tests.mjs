import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const terminalRoot = path.join(repositoryRoot, 'apps/terminal');
const gradleDirectory = path.join(terminalRoot, 'application/android/sample-terminal/android');
const gradleWrapper = path.join(gradleDirectory, 'gradlew');
const outputRoot = path.join(repositoryRoot, '.runtime/ter-third-party-usage-remediation/cp-a/a3');

function repositoryOwnedPath(inputPath, logicalRoot, label) {
  let resolvedPath;
  try {
    resolvedPath = fs.realpathSync(inputPath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
  const relativePath = path.relative(repositoryRoot, resolvedPath);
  if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    const input = path.relative(logicalRoot, inputPath).split(path.sep).join('/');
    throw new Error(`TERMINAL_ANDROID_TEST_INPUT_OUTSIDE_REPOSITORY input=${label ?? input}`);
  }
  return resolvedPath;
}

function walk(directory, result = [], logicalRoot = directory, visitedDirectories = new Set()) {
  const realDirectory = repositoryOwnedPath(directory, logicalRoot);
  if (realDirectory === null) return result;
  const directoryStat = fs.statSync(realDirectory);
  if (!directoryStat.isDirectory() || visitedDirectories.has(realDirectory)) return result;
  visitedDirectories.add(realDirectory);
  for (const entry of fs.readdirSync(realDirectory, {withFileTypes: true})) {
    if (
      (entry.isDirectory() || entry.isSymbolicLink()) &&
      [
        'node_modules',
        '.git',
        '.gradle',
        '.turbo',
        '.expo',
        '.runtime',
        '.yarn',
        '.cache',
        'coverage',
        'build',
        'dist',
      ].includes(entry.name)
    )
      continue;
    const target = path.join(realDirectory, entry.name);
    const realTarget = repositoryOwnedPath(target, logicalRoot);
    if (realTarget === null) {
      const input = path.relative(logicalRoot, target).split(path.sep).join('/');
      throw new Error(`TERMINAL_ANDROID_TEST_INPUT_UNRESOLVED input=${input}`);
    }
    const targetStat = fs.statSync(realTarget);
    if (targetStat.isDirectory()) walk(realTarget, result, logicalRoot, visitedDirectories);
    else if (targetStat.isFile()) result.push(target);
  }
  return result;
}

function stripKotlinComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

export function discoverKotlinTestClasses(moduleRoot) {
  const ownedModuleRoot = repositoryOwnedPath(moduleRoot, moduleRoot, 'module-root');
  if (ownedModuleRoot === null) throw new Error('TERMINAL_ANDROID_TEST_INPUT_UNRESOLVED input=module-root');
  const testRoot = path.join(ownedModuleRoot, 'src/test');
  return walk(testRoot, [], ownedModuleRoot)
    .filter(file => file.endsWith('.kt'))
    .map(file => {
      const source = stripKotlinComments(fs.readFileSync(file, 'utf8'));
      const packageName = source.match(/^\s*package\s+([\w.]+)/m)?.[1];
      const className = source.match(/\bclass\s+([A-Za-z_][\w]*)\b/)?.[1];
      const methodPattern =
        /@Test\b(?:\s*\([^)]*\))?\s*(?:@[\w.]+(?:\([^)]*\))?\s*)*(?:suspend\s+)?fun\s+(?:`([^`]+)`|([A-Za-z_][\w]*))/g;
      const testNames = [...source.matchAll(methodPattern)].map(match => match[1] ?? match[2]);
      if (!packageName || !className || testNames.length === 0) return null;
      return {
        file,
        packageName,
        className,
        qualifiedName: `${packageName}.${className}`,
        testCount: testNames.length,
        testNames,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.qualifiedName.localeCompare(right.qualifiedName));
}

function findKotlinTestClassByMethod(moduleRoot, methodName) {
  const methodPattern =
    /@Test\b(?:\s*\([^)]*\))?\s*(?:@[\w.]+(?:\([^)]*\))?\s*)*(?:suspend\s+)?fun\s+(?:`([^`]+)`|([A-Za-z_][\w]*))/g;
  const matches = discoverKotlinTestClasses(moduleRoot).filter(testClass =>
    [...stripKotlinComments(fs.readFileSync(testClass.file, 'utf8')).matchAll(methodPattern)].some(
      match => (match[1] ?? match[2]) === methodName,
    ),
  );
  if (matches.length !== 1) {
    throw new Error(`Kotlin test method owner must be unique: method=${methodName} matches=${matches.length}`);
  }
  return matches[0];
}

export function parseGradleProjectLocations(output, rootDirectory) {
  const projects = new Map();
  for (const line of String(output).split(/\r?\n/)) {
    const match = line.match(/^project '(:[^']+)' - (.+)$/);
    if (!match) continue;
    const location = match[2].trim().replace(/^\/+/, '');
    projects.set(match[1], path.resolve(rootDirectory, location));
  }
  return projects;
}

function xmlAttributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([A-Za-z][\w-]*)="([^"]*)"/g)].map(match => [match[1], match[2]]));
}

function parseJUnitReportSuites(reportFiles) {
  return reportFiles.flatMap(file => {
    const xml = fs.readFileSync(file, 'utf8');
    const suiteMatches = [...xml.matchAll(/<testsuite\b[^>]*>([\s\S]*?)<\/testsuite>/g)];
    const suiteStarts = xml.match(/<testsuite\b/g)?.length ?? 0;
    if (suiteMatches.length !== suiteStarts) throw new Error(`Malformed JUnit testsuite XML: ${file}`);
    return suiteMatches.map(match => {
      const openingTag = match[0].match(/^<testsuite\b[^>]*>/)?.[0];
      const body = match[1];
      if (openingTag === undefined || body === undefined) throw new Error(`Malformed JUnit testsuite XML: ${file}`);
      const caseMatches = [...body.matchAll(/<testcase\b[^>]*\/>|<testcase\b[^>]*>([\s\S]*?)<\/testcase>/g)];
      const caseStarts = body.match(/<testcase\b/g)?.length ?? 0;
      if (caseMatches.length !== caseStarts) throw new Error(`Malformed JUnit testcase XML: ${file}`);
      const testCases = caseMatches.map(caseMatch => {
        const tag = caseMatch[0].match(/^<testcase\b[^>]*>/)?.[0] ?? caseMatch[0];
        return {attributes: xmlAttributes(tag), body: caseMatch[1] ?? ''};
      });
      return {file, attributes: xmlAttributes(openingTag), testCases};
    });
  });
}

function junitResultCounts(suite) {
  const testCases = suite.testCases;
  return {
    tests: Number(suite.attributes.tests),
    skipped: Number(suite.attributes.skipped ?? 0),
    failures: Number(suite.attributes.failures ?? 0),
    errors: Number(suite.attributes.errors ?? 0),
    actualTests: testCases.length,
    actualSkipped: testCases.filter(testCase => /<skipped\b/.test(testCase.body)).length,
    actualFailures: testCases.filter(testCase => /<failure\b/.test(testCase.body)).length,
    actualErrors: testCases.filter(testCase => /<error\b/.test(testCase.body)).length,
  };
}

export function validateJUnitReports(testClasses, reportFiles, startedAtMs) {
  if (!Number.isFinite(startedAtMs)) throw new Error('JUnit run start timestamp is required');
  if (testClasses.length === 0) throw new Error('No Kotlin test classes were discovered');
  for (const testClass of testClasses) {
    if (
      !Array.isArray(testClass.testNames) ||
      testClass.testNames.length !== testClass.testCount ||
      testClass.testCount <= 0
    ) {
      throw new Error(`Invalid Kotlin test denominator for ${testClass.qualifiedName}`);
    }
  }
  const suites = parseJUnitReportSuites(reportFiles);
  const expectedByName = new Map();
  const missing = [];
  const mismatches = [];
  const duplicateSuites = [];
  const unmatchedSuites = [];
  const staleReports = reportFiles.filter(file => fs.statSync(file).mtimeMs < startedAtMs);
  for (const testClass of testClasses) {
    if (expectedByName.has(testClass.qualifiedName)) {
      throw new Error(`Duplicate discovered Kotlin test class: ${testClass.qualifiedName}`);
    }
    expectedByName.set(testClass.qualifiedName, testClass);
  }
  const matchedNames = new Set();
  for (const testClass of testClasses) {
    if (!suites.some(candidate => candidate.attributes.name === testClass.qualifiedName))
      missing.push(testClass.qualifiedName);
  }
  for (const suite of suites) {
    const suiteName = suite.attributes.name;
    const testClass = expectedByName.get(suiteName);
    if (testClass === undefined) {
      unmatchedSuites.push({name: suiteName ?? null, report: suite.file});
      continue;
    }
    if (matchedNames.has(suiteName)) {
      duplicateSuites.push({name: suiteName, report: suite.file});
      continue;
    }
    matchedNames.add(suiteName);
    const counts = junitResultCounts(suite);
    const caseNames = suite.testCases.map(testCase => testCase.attributes.name).sort();
    const expectedNames = [...(testClass.testNames ?? [])].sort();
    const caseClassnamesMatch = suite.testCases.every(testCase => testCase.attributes.classname === suiteName);
    if (
      counts.tests !== testClass.testCount ||
      counts.actualTests !== counts.tests ||
      counts.skipped !== 0 ||
      counts.failures !== 0 ||
      counts.errors !== 0 ||
      counts.actualSkipped !== counts.skipped ||
      counts.actualFailures !== counts.failures ||
      counts.actualErrors !== counts.errors ||
      !caseClassnamesMatch ||
      (expectedNames.length > 0 && JSON.stringify(caseNames) !== JSON.stringify(expectedNames))
    ) {
      mismatches.push({
        className: testClass.qualifiedName,
        declared: testClass.testCount,
        ...counts,
        expectedNames,
        caseNames,
        caseClassnamesMatch,
        report: suite.file,
      });
    }
  }
  const unmatchedReports = reportFiles.filter(file => !suites.some(suite => suite.file === file));
  if (
    missing.length ||
    mismatches.length ||
    duplicateSuites.length ||
    unmatchedSuites.length ||
    unmatchedReports.length ||
    staleReports.length
  ) {
    throw new Error(
      `JUnit report mismatch missing=${JSON.stringify(missing)} mismatches=${JSON.stringify(mismatches)} duplicateSuites=${JSON.stringify(duplicateSuites)} unmatchedSuites=${JSON.stringify(unmatchedSuites)} unmatchedReports=${JSON.stringify(unmatchedReports)} staleReports=${JSON.stringify(staleReports)}`,
    );
  }
  return {
    classes: testClasses.length,
    declaredTests: testClasses.reduce((total, testClass) => total + testClass.testCount, 0),
    reports: reportFiles.length,
  };
}

function assertExpectedJUnitResult(reportFiles, testClass, expected, startedAtMs) {
  if (!Number.isFinite(startedAtMs)) throw new Error('JUnit run start timestamp is required');
  if (reportFiles.length !== 1) throw new Error(`Expected exactly one JUnit report file; found=${reportFiles.length}`);
  const allSuites = parseJUnitReportSuites(reportFiles);
  if (allSuites.length !== 1) throw new Error(`Expected exactly one JUnit suite; found=${allSuites.length}`);
  const matchingSuites = allSuites.filter(suite => suite.attributes.name === testClass.qualifiedName);
  if (matchingSuites.length !== 1) {
    throw new Error(`Expected one JUnit suite for ${testClass.qualifiedName}; found=${matchingSuites.length}`);
  }
  const suite = matchingSuites[0];
  if (fs.statSync(suite.file).mtimeMs < startedAtMs) {
    throw new Error(`JUnit report predates this test run: ${suite.file}`);
  }
  const counts = junitResultCounts(suite);
  const caseNames = suite.testCases.map(testCase => testCase.attributes.name).sort();
  const expectedNames = [...testClass.testNames].sort();
  const caseClassnamesMatch = suite.testCases.every(
    testCase => testCase.attributes.classname === testClass.qualifiedName,
  );
  if (
    counts.tests !== expected.tests ||
    counts.actualTests !== expected.tests ||
    counts.skipped !== expected.skipped ||
    counts.actualSkipped !== expected.skipped ||
    counts.failures !== expected.failures ||
    counts.actualFailures !== expected.failures ||
    counts.errors !== expected.errors ||
    counts.actualErrors !== expected.errors ||
    !caseClassnamesMatch ||
    JSON.stringify(caseNames) !== JSON.stringify(expectedNames)
  ) {
    throw new Error(
      `JUnit test outcome mismatch class=${testClass.qualifiedName} counts=${JSON.stringify(counts)} caseNames=${JSON.stringify(caseNames)}`,
    );
  }
  return suite;
}

function sha256Files(files) {
  const hash = crypto.createHash('sha256');
  for (const file of [...files].sort()) {
    hash.update(path.relative(repositoryRoot, file));
    hash.update('\0');
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function writeEvent(logPath, runId, phase, fields = {}) {
  const event = {
    schemaVersion: 1,
    event: 'TERMINAL_ANDROID_UNIT_TEST',
    runId,
    phase,
    at: new Date().toISOString(),
    ...fields,
  };
  fs.appendFileSync(logPath, `${JSON.stringify(event)}\n`);
  process.stdout.write(`TERMINAL_ANDROID_UNIT_TEST ${JSON.stringify(event)}\n`);
}

export function parseProcessRows(output) {
  const lines = String(output)
    .split(/\r?\n/)
    .filter(line => line.trim() !== '');
  const rows = lines.flatMap(line => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/);
    if (match === null) throw new Error(`MANAGED_GRADLE_PROCESS_READBACK_MALFORMED:${line.trim().slice(0, 120)}`);
    return [{pid: Number(match[1]), pgid: Number(match[2]), startToken: match[3].replace(/\s+/g, ' ')}];
  });
  if (new Set(rows.map(row => row.pid)).size !== rows.length) {
    throw new Error('MANAGED_GRADLE_PROCESS_READBACK_DUPLICATE_PID');
  }
  return rows;
}

export function parseProcessReadback(result, {allowNoMatches = false} = {}) {
  if (result?.error) {
    const detail = result.error.code ?? result.error.name ?? result.error.message ?? 'UNKNOWN';
    throw new Error(`MANAGED_GRADLE_PROCESS_READBACK_FAILED:${detail}`);
  }
  if (
    allowNoMatches &&
    result?.status === 1 &&
    String(result.stdout ?? '').trim() === '' &&
    String(result.stderr ?? '').trim() === ''
  )
    return [];
  if (result?.status !== 0) {
    const stderr = String(result?.stderr ?? '').trim();
    const detail = result?.error?.code ?? result?.error?.name ?? (stderr || String(result?.status ?? 'UNKNOWN'));
    throw new Error(`MANAGED_GRADLE_PROCESS_READBACK_FAILED:${detail}`);
  }
  const rows = parseProcessRows(result.stdout);
  if (rows.length === 0) throw new Error('MANAGED_GRADLE_PROCESS_READBACK_EMPTY_SUCCESS');
  return rows;
}

function readProcessRows(args, {allowNoMatches = false} = {}) {
  const result = spawnSync('ps', args, {encoding: 'utf8'});
  return parseProcessReadback(result, {allowNoMatches});
}

function readProcessIdentity(pid) {
  return (
    readProcessRows(['-o', 'pid=,pgid=,lstart=', '-p', String(pid)], {allowNoMatches: true}).find(
      row => row.pid === pid,
    ) ?? null
  );
}

async function waitForProcessGroupEmpty(pgid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    if (!readProcessRows(['-axo', 'pid=,pgid=,lstart=']).some(row => row.pgid === pgid)) return true;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return !readProcessRows(['-axo', 'pid=,pgid=,lstart=']).some(row => row.pgid === pgid);
}

async function cleanupOwnedProcessGroup(record) {
  if (record.pid === null) return;
  if (process.platform === 'win32' || record.pgid !== record.pid) {
    throw new Error('MANAGED_GRADLE_PROCESS_GROUP_IDENTITY_UNAVAILABLE');
  }
  const members = readProcessRows(['-axo', 'pid=,pgid=,lstart=']).filter(row => row.pgid === record.pgid);
  if (members.length === 0) return;
  if (record.startToken === null) throw new Error('MANAGED_GRADLE_PROCESS_START_TOKEN_UNAVAILABLE');
  const currentLeader = readProcessIdentity(record.pid);
  if (
    currentLeader !== null &&
    (currentLeader.pgid !== record.pgid || currentLeader.startToken !== record.startToken)
  ) {
    throw new Error('MANAGED_GRADLE_PROCESS_GROUP_IDENTITY_CHANGED');
  }
  try {
    process.kill(-record.pgid, 'SIGTERM');
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
  if (await waitForProcessGroupEmpty(record.pgid, 2_000)) return;
  try {
    process.kill(-record.pgid, 'SIGKILL');
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
  if (!(await waitForProcessGroupEmpty(record.pgid, 2_000))) {
    throw new Error(`MANAGED_GRADLE_PROCESS_GROUP_REMAINS:${record.pgid}`);
  }
}

export function runOwnedCommand(command, args, cwd, logPath, runId, phase, manifest, {markCleanupOnClose = true} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    const startedAt = process.hrtime.bigint();
    let initialIdentity = null;
    let identityReadError = null;
    try {
      initialIdentity = child.pid ? readProcessIdentity(child.pid) : null;
    } catch (error) {
      identityReadError = error;
    }
    let output = '';
    let childError = null;
    let logError = null;
    let rawLog = null;
    let childClosed = false;
    let logClosed = true;
    let finalized = false;
    const record = {
      command,
      args,
      cwd,
      pid: child.pid ?? null,
      pgid: process.platform !== 'win32' ? (initialIdentity?.pgid ?? child.pid ?? null) : null,
      startToken: initialIdentity?.startToken ?? null,
      startedAt: new Date().toISOString(),
    };
    const terminateOwnedChild = () => {
      try {
        if (record.pid !== null && record.pgid === record.pid && record.startToken !== null) {
          const current = readProcessIdentity(record.pid);
          if (current?.pgid === record.pgid && current.startToken === record.startToken) {
            process.kill(-record.pgid, 'SIGTERM');
            return;
          }
        }
        child.kill('SIGTERM');
      } catch {}
    };
    let childExitCode = null;
    let childExitSignal = null;
    let childExited = false;
    let processGroupCleanup = null;
    let cleanupStatus = null;
    let cleanupError = null;
    const beginProcessGroupCleanup = () => {
      if (processGroupCleanup !== null) return processGroupCleanup;
      processGroupCleanup = cleanupOwnedProcessGroup(record)
        .then(() => {
          cleanupStatus = 'PASS';
        })
        .catch(error => {
          cleanupStatus = 'FAIL';
          cleanupError = error;
          childError =
            childError === null
              ? error
              : new AggregateError([childError, error], 'Gradle child and process-group cleanup failed');
        });
      return processGroupCleanup;
    };
    const finish = async () => {
      if (finalized || !childClosed || !logClosed) return;
      finalized = true;
      const elapsedMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
      await beginProcessGroupCleanup();
      const cleanup = cleanupStatus ?? 'FAIL';
      manifest.value.processes = cleanup === 'PASS' ? [] : [record];
      manifest.value.cleanup = cleanup === 'PASS' && !markCleanupOnClose ? 'RUNNING' : cleanup;
      try {
        fs.writeFileSync(manifest.path, JSON.stringify(manifest.value, null, 2));
        writeEvent(logPath, runId, `${phase}.finish`, {
          exitCode: childExitCode,
          signal: childExitSignal,
          elapsedMs,
          cleanup: manifest.value.cleanup,
          cleanupError: cleanupError?.message,
        });
      } catch (error) {
        childError =
          childError === null
            ? error
            : new AggregateError([childError, error], 'Gradle run and final log write both failed');
      }
      if (logError !== null) {
        reject(
          childError === null
            ? logError
            : new AggregateError([childError, logError], 'Gradle run and log stream both failed'),
        );
        return;
      }
      if (childError !== null) {
        reject(childError);
        return;
      }
      resolve({code: childExitCode, signal: childExitSignal, output, elapsedMs});
    };

    child.on('error', error => {
      childError =
        childError === null ? error : new AggregateError([childError, error], 'Gradle child emitted multiple errors');
      terminateOwnedChild();
    });
    child.once('exit', (code, signal) => {
      childExited = true;
      childExitCode = code;
      childExitSignal = signal;
      void beginProcessGroupCleanup();
    });
    child.once('close', (code, signal) => {
      childClosed = true;
      if (!childExited) {
        childExited = true;
        childExitCode = code;
        childExitSignal = signal;
        void beginProcessGroupCleanup();
      }
      if (rawLog !== null) rawLog.end();
      void finish();
    });
    try {
      rawLog = fs.createWriteStream(logPath, {flags: 'a'});
      logClosed = false;
      rawLog.once('close', () => {
        logClosed = true;
        void finish();
      });
      rawLog.on('error', error => {
        logError = error;
        terminateOwnedChild();
        rawLog?.destroy();
      });
    } catch (error) {
      logError = error;
      terminateOwnedChild();
    }
    const collect = stream =>
      stream.on('data', chunk => {
        const text = chunk.toString();
        output += text;
        rawLog?.write(text);
        process.stdout.write(text);
      });
    collect(child.stdout);
    collect(child.stderr);
    if (identityReadError !== null) childError = identityReadError;
    manifest.value.processes = [record];
    manifest.value.cleanup = 'RUNNING';
    try {
      fs.writeFileSync(manifest.path, JSON.stringify(manifest.value, null, 2));
      writeEvent(logPath, runId, `${phase}.start`, {
        pid: child.pid ?? null,
        pgid: record.pgid,
        startToken: record.startToken,
        command,
        args,
        cwd,
      });
      if (
        record.pid === null ||
        record.startToken === null ||
        (process.platform !== 'win32' && record.pgid !== record.pid)
      ) {
        throw new Error('MANAGED_GRADLE_CHILD_IDENTITY_UNAVAILABLE');
      }
    } catch (error) {
      childError = childError === null ? error : new AggregateError([childError, error], 'Gradle child setup failed');
      terminateOwnedChild();
    }
  });
}

function assertExecutedTask(output, taskPath) {
  const lines = String(output)
    .split(/\r?\n/)
    .filter(line => line.includes(taskPath));
  const executed = lines.some(line => line.trim().startsWith(`> Task ${taskPath}`));
  if (!executed || lines.some(line => /\b(SKIPPED|UP-TO-DATE|FROM-CACHE|NO-SOURCE)\b/.test(line))) {
    throw new Error(`Gradle test task was not freshly executed: ${taskPath}; lines=${JSON.stringify(lines)}`);
  }
}

function assertFailedTask(output, taskPath) {
  const line = String(output)
    .split(/\r?\n/)
    .find(value => value.trim() === `> Task ${taskPath} FAILED`);
  if (line === undefined) throw new Error(`Expected compile task failure was not observed: ${taskPath}`);
}

function fixtureInitScript(fixtureDirectory) {
  const initPath = path.join(fixtureDirectory, 'a3-fixture.init.gradle');
  fs.writeFileSync(
    initPath,
    `gradle.projectsEvaluated {\n  def targetPath = System.getProperty('ter.a3.fixture.project')\n  def targetDir = System.getProperty('ter.a3.fixture.directory')\n  def target = gradle.rootProject.findProject(targetPath)\n  if (target != null) {\n    target.extensions.getByName('android').sourceSets.getByName('test').java.srcDir(targetDir)\n  }\n}\n`,
  );
  return initPath;
}

function selfTest() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-owned-android-tests-'));
  try {
    const testModule = path.join(fixture, 'module');
    const testSourceRoot = path.join(testModule, 'src/test/java/sample');
    fs.mkdirSync(testSourceRoot, {recursive: true});
    fs.writeFileSync(
      path.join(testSourceRoot, 'AlphabeticallyFirstTest.kt'),
      'package sample\n\nimport org.junit.Test\n\nclass AlphabeticallyFirstTest {\n  // fun `target method`() {}\n  @Test fun unrelated() {}\n}\n',
    );
    fs.writeFileSync(
      path.join(testSourceRoot, 'TargetOwnerTest.kt'),
      'package sample\n\nimport org.junit.Test\n\nclass TargetOwnerTest {\n  @Test fun `target method`() {}\n}\n',
    );
    if (findKotlinTestClassByMethod(testModule, 'target method').className !== 'TargetOwnerTest') {
      throw new Error('Kotlin targeted-method owner discovery selected the wrong test class');
    }
    const testClass = [
      {
        qualifiedName: 'sample.ExampleTest',
        className: 'ExampleTest',
        testCount: 2,
        testNames: ['first behavior', 'second behavior'],
      },
    ];
    const report = path.join(fixture, 'TEST-sample.ExampleTest.xml');
    const validReport =
      '<testsuite name="sample.ExampleTest" tests="2" skipped="0" failures="0" errors="0">' +
      '<testcase name="first behavior" classname="sample.ExampleTest"/><testcase name="second behavior" classname="sample.ExampleTest"/>' +
      '</testsuite>';
    fs.writeFileSync(report, validReport);
    const reportStartedAt = fs.statSync(report).mtimeMs - 1;
    if (validateJUnitReports(testClass, [report], reportStartedAt).declaredTests !== 2)
      throw new Error('valid JUnit fixture was rejected');
    const validSuite = assertExpectedJUnitResult(
      [report],
      testClass[0],
      {tests: 2, skipped: 0, failures: 0, errors: 0},
      reportStartedAt,
    );
    if (validSuite.testCases.length !== 2) throw new Error('fresh exact JUnit fixture was rejected');

    let missingTimestampRejected = false;
    try {
      validateJUnitReports(testClass, [report]);
    } catch (error) {
      missingTimestampRejected = String(error).includes('run start timestamp is required');
    }
    if (!missingTimestampRejected) throw new Error('JUnit report validation accepted a missing run start timestamp');

    fs.writeFileSync(
      report,
      '<testsuite name="sample.ExampleTest" tests="2">' +
        '<testcase name="first behavior" classname="sample.ExampleTest"/><testcase name="second behavior" classname="sample.ExampleTest"/>',
    );
    let malformedXmlRejected = false;
    try {
      validateJUnitReports(testClass, [report], fs.statSync(report).mtimeMs - 1);
    } catch (error) {
      malformedXmlRejected = String(error).includes('Malformed JUnit testsuite XML');
    }
    if (!malformedXmlRejected) throw new Error('truncated JUnit XML was accepted');

    fs.writeFileSync(
      report,
      '<testsuite name="sample.ExampleTest" tests="2" skipped="1" failures="0" errors="0">' +
        '<testcase name="first behavior" classname="sample.ExampleTest"/><testcase name="second behavior" classname="sample.ExampleTest"><skipped/></testcase></testsuite>',
    );
    let rejected = false;
    try {
      validateJUnitReports(testClass, [report], fs.statSync(report).mtimeMs - 1);
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error('skipped or missing JUnit execution was accepted');
    let staleRejected = false;
    try {
      assertExpectedJUnitResult(
        [report],
        testClass[0],
        {tests: 2, skipped: 0, failures: 0, errors: 0},
        Date.now() + 60_000,
      );
    } catch (error) {
      staleRejected = String(error).includes('predates this test run');
    }
    if (!staleRejected) throw new Error('stale JUnit output was accepted as a fresh red-fixture result');
    const collisionReport = path.join(fixture, 'TEST-collision.xml');
    fs.writeFileSync(
      collisionReport,
      '<testsuite name="sample.AlphaTest" tests="1" skipped="0" failures="0" errors="0"></testsuite>',
    );
    let ambiguousCollisionRejected = false;
    try {
      validateJUnitReports(
        [
          {qualifiedName: 'sample.AlphaTest', className: 'AlphaTest', testCount: 1, testNames: ['one']},
          {qualifiedName: 'other.AlphaTest', className: 'AlphaTest', testCount: 1, testNames: ['one']},
        ],
        [collisionReport],
        fs.statSync(collisionReport).mtimeMs - 1,
      );
    } catch {
      ambiguousCollisionRejected = true;
    }
    if (!ambiguousCollisionRejected) throw new Error('one JUnit suite was reused for two same-simple-name classes');
    fs.writeFileSync(
      collisionReport,
      '<testsuite name="sample.ExampleTest" tests="2" skipped="0" failures="0" errors="0"></testsuite>' +
        '<testsuite name="unexpected.ExtraTest" tests="1" skipped="0" failures="0" errors="0"></testsuite>',
    );
    let extraSuiteRejected = false;
    try {
      validateJUnitReports(testClass, [collisionReport], fs.statSync(collisionReport).mtimeMs - 1);
    } catch {
      extraSuiteRejected = true;
    }
    if (!extraSuiteRejected) throw new Error('unmatched testsuite in a matched JUnit file was accepted');
    let extraExpectedRedSuiteRejected = false;
    try {
      assertExpectedJUnitResult(
        [collisionReport],
        testClass[0],
        {tests: 2, skipped: 0, failures: 0, errors: 0},
        fs.statSync(collisionReport).mtimeMs - 1,
      );
    } catch (error) {
      extraExpectedRedSuiteRejected = String(error).includes('Expected exactly one JUnit suite');
    }
    if (!extraExpectedRedSuiteRejected) throw new Error('targeted JUnit validation accepted an extra suite');
    const parsed = parseGradleProjectLocations(
      "project ':sample' - /../../../../adapter/sample/android",
      '/repo/apps/terminal/application/android/app/android',
    );
    if (parsed.get(':sample') !== '/repo/apps/terminal/adapter/sample/android')
      throw new Error('Gradle project location mapping failed');
    process.stdout.write('TERMINAL_ANDROID_UNIT_TESTS_SELF_TEST=PASS\n');
  } finally {
    fs.rmSync(fixture, {recursive: true, force: true});
  }
}

async function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  const mode = process.argv.includes('--red-fixtures') ? 'red-fixtures' : 'run';
  if (process.argv.includes('--a9-lock-red-fixture')) return runA9LockRedFixture();
  if (mode === 'red-fixtures') return runRedFixtures();
  const budget = spawnSync(
    path.join(repositoryRoot, 'scripts/env/check-runtime-resource-budget'),
    ['--profile', 'ter-validation-with-dev', path.join(repositoryRoot, '.runtime')],
    {cwd: repositoryRoot, encoding: 'utf8'},
  );
  process.stdout.write(budget.stdout ?? '');
  process.stderr.write(budget.stderr ?? '');
  if (budget.status !== 0) throw new Error('managed resource budget did not pass before Android unit tests');

  fs.mkdirSync(outputRoot, {recursive: true});
  const runId = `ter-a3-${process.pid}-${Date.now()}`;
  const logPath = path.join(outputRoot, `${runId}.jsonl`);
  const manifestPath = path.join(outputRoot, `${runId}.manifest.json`);
  const testSourceFiles = walk(terminalRoot).filter(file => /\/android\/src\/test\/.*\.kt$/.test(file));
  const moduleRoots = [
    ...new Set(testSourceFiles.map(file => file.slice(0, file.indexOf('/android/src/test')) + '/android')),
  ].sort();
  const classesByModule = new Map(moduleRoots.map(moduleRoot => [moduleRoot, discoverKotlinTestClasses(moduleRoot)]));
  const expectedModuleRoots = [
    'apps/terminal/adapter/android/device/android',
    'apps/terminal/adapter/android/dual-screen/android',
    'apps/terminal/adapter/android/persist-kv/android',
    'apps/terminal/application/base/android/android',
  ]
    .map(relative => path.join(repositoryRoot, relative))
    .sort();
  if (
    classesByModule.size !== expectedModuleRoots.length ||
    moduleRoots.some((moduleRoot, index) => moduleRoot !== expectedModuleRoots[index]) ||
    [...classesByModule.values()].some(classes => classes.length === 0)
  ) {
    throw new Error(`Kotlin test source-set denominator changed unexpectedly: modules=${moduleRoots.length}`);
  }
  const digestFiles = [
    ...testSourceFiles,
    ...walk(terminalRoot).filter(file => /\/android\/src\/main\/.*\.kt$/.test(file)),
    ...moduleRoots.map(root => path.join(root, 'build.gradle')),
    path.join(gradleDirectory, 'settings.gradle'),
    gradleWrapper,
    fileURLToPath(import.meta.url),
  ];
  const sourceSha256 = sha256Files(digestFiles);
  const value = {
    schemaVersion: 1,
    runId,
    sourceSha256,
    startedAt: new Date().toISOString(),
    mode,
    modules: [],
    processes: [],
    cleanup: 'RUNNING',
  };
  const manifest = {path: manifestPath, value, processes: []};
  fs.writeFileSync(manifestPath, JSON.stringify(value, null, 2));
  writeEvent(logPath, runId, 'run.start', {
    sourceSha256,
    moduleCount: moduleRoots.length,
    testClassCount: [...classesByModule.values()].flat().length,
  });
  try {
    const projectsLog = path.join(outputRoot, `${runId}-projects.log`);
    const projects = await runOwnedCommand(
      gradleWrapper,
      ['projects', '--no-daemon', '--console=plain'],
      gradleDirectory,
      projectsLog,
      runId,
      'projects',
      manifest,
    );
    if (projects.signal !== null || !Number.isInteger(projects.code) || projects.code !== 0) {
      throw new Error(`Gradle project discovery failed (exit=${projects.code}, signal=${projects.signal})`);
    }
    const projectLocations = parseGradleProjectLocations(projects.output, gradleDirectory);
    const tasks = [];
    for (const moduleRoot of moduleRoots) {
      const resolvedRoot = fs.realpathSync(moduleRoot);
      const match = [...projectLocations].find(
        ([, location]) => fs.existsSync(location) && fs.realpathSync(location) === resolvedRoot,
      );
      if (!match) throw new Error(`Gradle project location missing for test source root ${moduleRoot}`);
      tasks.push({moduleRoot, projectPath: match[0], classes: classesByModule.get(moduleRoot)});
    }
    value.moduleProjects = tasks.map(({moduleRoot, projectPath, classes}) => ({
      moduleRoot: path.relative(repositoryRoot, moduleRoot),
      projectPath,
      classes: classes.map(({qualifiedName, testCount}) => ({qualifiedName, testCount})),
    }));
    fs.writeFileSync(manifestPath, JSON.stringify(value, null, 2));
    for (const [index, task] of tasks.entries()) {
      const taskPath = `${task.projectPath}:testDebugUnitTest`;
      const moduleLog = path.join(outputRoot, `${runId}-module-${index + 1}.log`);
      const reportRoot = path.join(task.moduleRoot, 'build/test-results/testDebugUnitTest');
      fs.rmSync(reportRoot, {recursive: true, force: true});
      const startedAt = Date.now();
      const result = await runOwnedCommand(
        gradleWrapper,
        [taskPath, '--no-daemon', '--console=plain', '--rerun-tasks'],
        gradleDirectory,
        moduleLog,
        runId,
        `module-${index + 1}`,
        manifest,
      );
      if (result.signal !== null || !Number.isInteger(result.code) || result.code !== 0) {
        throw new Error(
          `Gradle unit test failed for ${taskPath}; exit=${result.code}, signal=${result.signal}; see ${moduleLog}`,
        );
      }
      assertExecutedTask(result.output, taskPath);
      const reports = walk(reportRoot).filter(file => file.endsWith('.xml'));
      const totals = validateJUnitReports(task.classes, reports, startedAt);
      const elapsedMs = Date.now() - startedAt;
      const moduleResult = {projectPath: task.projectPath, task: taskPath, elapsedMs, ...totals, outcome: 'PASS'};
      value.modules.push(moduleResult);
      fs.writeFileSync(manifestPath, JSON.stringify(value, null, 2));
      writeEvent(logPath, runId, 'module.pass', moduleResult);
    }
    value.outcome = 'PASS';
    if (value.cleanup === 'RUNNING' && value.processes.length === 0) value.cleanup = 'PASS';
    value.finishedAt = new Date().toISOString();
    fs.writeFileSync(manifestPath, JSON.stringify(value, null, 2));
    const methods = value.modules.reduce((total, module) => total + module.declaredTests, 0);
    writeEvent(logPath, runId, 'run.finish', {
      outcome: 'PASS',
      cleanup: value.cleanup,
      modules: value.modules.length,
      classes: value.modules.reduce((total, module) => total + module.classes, 0),
      declaredTests: methods,
      manifestPath,
    });
    process.stdout.write(
      `TERMINAL_ANDROID_UNIT_TESTS=PASS modules=${value.modules.length} classes=${value.modules.reduce((total, module) => total + module.classes, 0)} methods=${methods} runId=${runId}\n`,
    );
  } catch (error) {
    value.outcome = 'FAIL';
    if (value.cleanup === 'RUNNING' && value.processes.length === 0) value.cleanup = 'PASS';
    value.firstFailure = error instanceof Error ? error.message : String(error);
    value.finishedAt = new Date().toISOString();
    fs.writeFileSync(manifestPath, JSON.stringify(value, null, 2));
    writeEvent(logPath, runId, 'run.finish', {
      outcome: 'FAIL',
      cleanup: value.cleanup,
      firstFailure: value.firstFailure,
      manifestPath,
    });
    throw error;
  }
}

async function runA9LockRedFixture() {
  const budget = spawnSync(
    path.join(repositoryRoot, 'scripts/env/check-runtime-resource-budget'),
    ['--profile', 'ter-validation-with-dev', path.join(repositoryRoot, '.runtime')],
    {cwd: repositoryRoot, encoding: 'utf8'},
  );
  process.stdout.write(budget.stdout ?? '');
  process.stderr.write(budget.stderr ?? '');
  if (budget.status !== 0) throw new Error('managed resource budget did not pass before A9 lock-order red fixture');

  fs.mkdirSync(outputRoot, {recursive: true});
  const runId = `ter-a9-lock-red-${process.pid}-${Date.now()}`;
  const logPath = path.join(outputRoot, `${runId}.jsonl`);
  const manifestPath = path.join(outputRoot, `${runId}.manifest.json`);
  const moduleRoot = path.join(terminalRoot, 'application/base/android/android');
  const mainRoot = path.join(moduleRoot, 'src/main');
  const serverRelative = 'java/com/catering/v2s/terminal/application/base/android/TerminalTopologyServer.kt';
  const registryRelative = 'java/com/catering/v2s/terminal/application/base/android/TerminalTopologyHostRegistry.kt';
  const lockOrderMethod = 'production registry lock paths complete without a reverse lock cycle in ten fresh JVMs';
  const testClass = findKotlinTestClassByMethod(moduleRoot, lockOrderMethod);
  const value = {
    schemaVersion: 1,
    runId,
    mode: 'a9-lock-order-red-fixture',
    sourceSha256: null,
    startedAt: new Date().toISOString(),
    fixtureRoot: null,
    mutatedFiles: [],
    modules: [],
    processes: [],
    cleanup: 'RUNNING',
  };
  const manifest = {path: manifestPath, value, processes: []};
  fs.writeFileSync(manifestPath, JSON.stringify(value, null, 2));
  writeEvent(logPath, runId, 'red-fixture.start', {mode: value.mode});

  let fixtureRoot = null;
  let failure = null;
  try {
    fixtureRoot = fs.mkdtempSync(path.join(outputRoot, `${runId}-copy-`));
    const copiedMainRoot = path.join(fixtureRoot, 'src/main');
    const copiedServer = path.join(copiedMainRoot, serverRelative);
    const copiedRegistry = path.join(copiedMainRoot, registryRelative);
    const initPath = path.join(fixtureRoot, 'a9-lock-red.init.gradle');
    fs.cpSync(mainRoot, copiedMainRoot, {recursive: true});

    let serverSource = fs.readFileSync(copiedServer, 'utf8');
    const onCloseBefore = `      synchronized(peerLock) {\n        if (peer === this) peer = null\n      }\n      publishConnection("close", connectionId, safeCloseReason(reason))`;
    const onCloseAfter = `      synchronized(peerLock) {\n        if (peer === this) peer = null\n        publishConnection("close", connectionId, safeCloseReason(reason))\n      }`;
    if (serverSource.split(onCloseBefore).length !== 2)
      throw new Error('A9 server lock-order mutation anchor did not match exactly once');
    serverSource = serverSource.replace(onCloseBefore, onCloseAfter);
    fs.writeFileSync(copiedServer, serverSource);

    let registrySource = fs.readFileSync(copiedRegistry, 'utf8');
    const closePeerBefore = `    val active = synchronized(lock) { server }\n    active?.closePeer(reason)\n    return success(mapOf("completed" to true))`;
    const closePeerAfter = `    synchronized(lock) { server?.closePeer(reason) }\n    return success(mapOf("completed" to true))`;
    if (registrySource.split(closePeerBefore).length !== 2)
      throw new Error('A9 registry lock-order mutation anchor did not match exactly once');
    registrySource = registrySource.replace(closePeerBefore, closePeerAfter);
    fs.writeFileSync(copiedRegistry, registrySource);

    fs.writeFileSync(
      initPath,
      `gradle.projectsEvaluated {\n  def targetPath = System.getProperty('ter.a9.fixture.project')\n  def mainDir = System.getProperty('ter.a9.fixture.main')\n  def target = gradle.rootProject.findProject(targetPath)\n  if (target != null) {\n    def android = target.extensions.getByName('android')\n    android.sourceSets.getByName('main').java.setSrcDirs([mainDir])\n    def kotlin = target.extensions.findByName('kotlin')\n    kotlin.sourceSets.getByName('main').kotlin.setSrcDirs([mainDir])\n  }\n}\n`,
    );
    value.fixtureRoot = path.relative(repositoryRoot, fixtureRoot);
    value.mutatedFiles = [path.relative(repositoryRoot, copiedServer), path.relative(repositoryRoot, copiedRegistry)];

    const projectsLog = path.join(outputRoot, `${runId}-projects.log`);
    const projects = await runOwnedCommand(
      gradleWrapper,
      ['projects', '--no-daemon', '--console=plain'],
      gradleDirectory,
      projectsLog,
      runId,
      'a9-red-projects',
      manifest,
      {markCleanupOnClose: false},
    );
    if (projects.signal !== null || !Number.isInteger(projects.code) || projects.code !== 0) {
      throw new Error(
        `Gradle project discovery for A9 lock-order fixture failed: exit=${projects.code}, signal=${projects.signal}`,
      );
    }
    const locations = parseGradleProjectLocations(projects.output, gradleDirectory);
    const moduleProject = [...locations].find(
      ([, location]) => fs.existsSync(location) && fs.realpathSync(location) === fs.realpathSync(moduleRoot),
    );
    if (!moduleProject) throw new Error('Gradle project for A9 lock-order fixture was not discovered');
    const [projectPath] = moduleProject;
    const sourceFiles = [
      ...walk(mainRoot).filter(file => file.endsWith('.kt')),
      ...walk(path.join(moduleRoot, 'src/test')).filter(file => file.endsWith('.kt')),
      path.join(moduleRoot, 'build.gradle'),
      fileURLToPath(import.meta.url),
      copiedServer,
      copiedRegistry,
      initPath,
    ];
    value.sourceSha256 = sha256Files(sourceFiles);
    fs.writeFileSync(manifestPath, JSON.stringify(value, null, 2));
    writeEvent(logPath, runId, 'red-fixture.inputs-ready', {
      sourceSha256: value.sourceSha256,
      mutatedFiles: value.mutatedFiles,
    });

    const reportRoot = path.join(moduleRoot, 'build/test-results/testDebugUnitTest');
    const reportPath = path.join(reportRoot, `TEST-${testClass.qualifiedName}.xml`);
    fs.rmSync(reportPath, {force: true});
    const startedAtMs = Date.now();
    const args = [
      '-I',
      initPath,
      `-Dter.a9.fixture.project=${projectPath}`,
      `-Dter.a9.fixture.main=${path.join(fixtureRoot, 'src/main')}`,
      `${projectPath}:testDebugUnitTest`,
      '--tests',
      `${testClass.qualifiedName}*${lockOrderMethod}*`,
      '--no-daemon',
      '--console=plain',
      '--rerun-tasks',
    ];
    const result = await runOwnedCommand(
      gradleWrapper,
      args,
      gradleDirectory,
      logPath,
      runId,
      'a9-red-fixture',
      manifest,
      {
        markCleanupOnClose: false,
      },
    );
    assertExecutedTask(result.output, `${projectPath}:testDebugUnitTest`);
    const suite = assertExpectedJUnitResult(
      [reportPath],
      testClass,
      {tests: 1, skipped: 0, failures: 1, errors: 0},
      startedAtMs,
    );
    const reportText = suite.testCases[0]?.body ?? '';
    const redAttempts = [
      ...new Set(
        [...reportText.matchAll(/attempt=(\d+) exit=12 output=A9_LOCK_ORDER_DEADLOCK_CONFIRMED/g)].map(match =>
          Number(match[1]),
        ),
      ),
    ].sort((left, right) => left - right);
    const redCount = redAttempts.length;
    const methodFailurePresent = reportText.includes(lockOrderMethod);
    const preservedReport = path.join(outputRoot, `${runId}-junit.xml`);
    fs.copyFileSync(reportPath, preservedReport);
    value.junitReports = [path.relative(repositoryRoot, preservedReport)];
    value.expectedRedJvmCount = redCount;
    value.expectedRedJvmAttempts = redAttempts;
    if (
      result.signal !== null ||
      !Number.isInteger(result.code) ||
      result.code <= 0 ||
      redCount !== 10 ||
      redAttempts.some((attempt, index) => attempt !== index + 1) ||
      !methodFailurePresent
    ) {
      throw new Error(
        `A9 lock-order fixture did not produce ten independent intended red results; exit=${result.code}; redJvmCount=${redCount}; reports=${JSON.stringify(value.junitReports)}; log=${logPath}`,
      );
    }
    value.outcome = 'EXPECTED_RED';
    value.modules = [
      {
        projectPath,
        task: `${projectPath}:testDebugUnitTest`,
        declaredTests: 1,
        junitFailureMarkers: redCount,
        outcome: 'EXPECTED_RED',
      },
    ];
    fs.writeFileSync(manifestPath, JSON.stringify(value, null, 2));
    process.stdout.write(
      `TERMINAL_A9_LOCK_ORDER_RED=PASS independentJvmRed=${redCount} junit=${value.junitReports.join(',')} log=${logPath}\n`,
    );
  } catch (error) {
    failure = error;
    value.outcome = 'FAIL';
    value.firstFailure = error instanceof Error ? error.message : String(error);
  } finally {
    let cleanupFailure = null;
    if (fixtureRoot !== null) {
      try {
        fs.rmSync(fixtureRoot, {recursive: true, force: true});
      } catch (error) {
        cleanupFailure = error instanceof Error ? error.message : String(error);
      }
    }
    const fixtureDirectoryClean = fixtureRoot === null || !fs.existsSync(fixtureRoot);
    const ownedProcessCleanupFailed = value.cleanup === 'FAIL' || value.processes.length > 0;
    value.cleanup = !ownedProcessCleanupFailed && fixtureDirectoryClean ? 'PASS' : 'FAIL';
    if (cleanupFailure !== null) value.cleanupFailure = cleanupFailure;
    if (value.cleanup !== 'PASS' && failure === null) {
      failure = new Error(`A9 lock-order fixture cleanup failed: ${cleanupFailure ?? 'fixture directory remains'}`);
      value.outcome = 'FAIL';
      value.firstFailure = failure.message;
    }
    value.finishedAt = new Date().toISOString();
    try {
      fs.writeFileSync(manifestPath, JSON.stringify(value, null, 2));
      writeEvent(logPath, runId, 'red-fixture.finish', {
        outcome: value.outcome,
        cleanup: value.cleanup,
        expectedRedJvmCount: value.expectedRedJvmCount ?? null,
        firstFailure: value.firstFailure ?? null,
        manifestPath,
      });
    } catch (error) {
      failure =
        failure === null
          ? error
          : new AggregateError([failure, error], 'A9 lock-order fixture failed and finalization also failed');
    }
    process.stdout.write(`TERMINAL_A9_LOCK_ORDER_RED_FIXTURE_CLEANUP=${value.cleanup}\n`);
  }
  if (failure) throw failure;
  if (value.cleanup !== 'PASS') throw new Error('A9 lock-order fixture cleanup failed');
}

async function runRedFixtures() {
  const budget = spawnSync(
    path.join(repositoryRoot, 'scripts/env/check-runtime-resource-budget'),
    ['--profile', 'ter-validation-with-dev', path.join(repositoryRoot, '.runtime')],
    {cwd: repositoryRoot, encoding: 'utf8'},
  );
  process.stdout.write(budget.stdout ?? '');
  process.stderr.write(budget.stderr ?? '');
  if (budget.status !== 0) throw new Error('managed resource budget did not pass before Kotlin red fixtures');
  fs.mkdirSync(outputRoot, {recursive: true});
  const runId = `ter-a3-red-${process.pid}-${Date.now()}`;
  const logPath = path.join(outputRoot, `${runId}.jsonl`);
  const manifestPath = path.join(outputRoot, `${runId}.manifest.json`);
  const baseModule = path.join(terminalRoot, 'application/base/android/android');
  const sourceFiles = [
    ...walk(path.join(baseModule, 'src/main')).filter(file => file.endsWith('.kt')),
    ...walk(path.join(baseModule, 'src/test')).filter(file => file.endsWith('.kt')),
    path.join(baseModule, 'build.gradle'),
    fileURLToPath(import.meta.url),
  ];
  const value = {
    schemaVersion: 1,
    runId,
    mode: 'a3-red-fixtures',
    sourceSha256: sha256Files(sourceFiles),
    startedAt: new Date().toISOString(),
    fixtureRoot: null,
    modules: [],
    processes: [],
    cleanup: 'RUNNING',
  };
  const manifest = {path: manifestPath, value, processes: []};
  fs.writeFileSync(manifestPath, JSON.stringify(value, null, 2));
  let fixtureRoot = null;
  let failure = null;
  try {
    fixtureRoot = fs.mkdtempSync(path.join(outputRoot, 'red-fixture-'));
    value.fixtureRoot = path.relative(repositoryRoot, fixtureRoot);
    fs.writeFileSync(manifestPath, JSON.stringify(value, null, 2));
    writeEvent(logPath, runId, 'red-fixtures.start', {sourceSha256: value.sourceSha256});
    const fixtureLogRoot = path.join(outputRoot, 'red-fixture-logs');
    fs.mkdirSync(fixtureLogRoot, {recursive: true});
    const [baseTest] = discoverKotlinTestClasses(baseModule);
    if (!baseTest) throw new Error('application-base Android test class is required for TP-A4 red fixtures');
    const relativeTestPath = path.relative(path.join(baseModule, 'src/test'), baseTest.file);
    const fixtureSourceDirectory = path.join(fixtureRoot, 'src/test', path.dirname(relativeTestPath));
    fs.mkdirSync(fixtureSourceDirectory, {recursive: true});
    const projectsLog = path.join(fixtureLogRoot, `${runId}-projects.log`);
    const projects = await runOwnedCommand(
      gradleWrapper,
      ['projects', '--no-daemon', '--console=plain'],
      gradleDirectory,
      projectsLog,
      runId,
      'red-fixtures.projects',
      manifest,
    );
    if (projects.signal !== null || !Number.isInteger(projects.code) || projects.code !== 0) {
      throw new Error(
        `Gradle project discovery for red fixtures failed: exit=${projects.code}, signal=${projects.signal}`,
      );
    }
    const locations = parseGradleProjectLocations(projects.output, gradleDirectory);
    const baseProject = [...locations].find(
      ([, location]) => fs.existsSync(location) && fs.realpathSync(location) === fs.realpathSync(baseModule),
    );
    if (!baseProject)
      throw new Error('Gradle project path for application-base Android test source was not discovered');
    const [baseProjectPath] = baseProject;
    const fixtureSourceRoot = path.join(fixtureRoot, 'src/test');
    const projectArgs = [
      '-I',
      fixtureInitScript(fixtureRoot),
      `-Dter.a3.fixture.project=${baseProjectPath}`,
      `-Dter.a3.fixture.directory=${fixtureSourceRoot}`,
    ];
    const makeSource = (className, body) =>
      `package ${baseTest.packageName}\n\nimport org.junit.Test\n\nclass ${className} {\n  @Test\n  fun fixture() {\n${body}\n  }\n}\n`;
    const runFixture = async (name, className, source, {expectedOutput, expectedCompileTask, expectedJUnit}) => {
      const file = path.join(fixtureSourceDirectory, `${name}.kt`);
      fs.writeFileSync(file, source);
      const fixtureOutputLog = path.join(fixtureLogRoot, `${runId}-${name}.log`);
      const reportRoot = path.join(baseModule, 'build/test-results/testDebugUnitTest');
      const testClassName = `${baseTest.packageName}.${className}`;
      const reportPath = path.join(reportRoot, `TEST-${testClassName}.xml`);
      fs.rmSync(reportPath, {force: true});
      const testClass = {
        qualifiedName: testClassName,
        className,
        testCount: 1,
        testNames: ['fixture'],
      };
      const startedAtMs = Date.now();
      const result = await runOwnedCommand(
        gradleWrapper,
        [
          `${baseProjectPath}:testDebugUnitTest`,
          ...projectArgs,
          '--tests',
          `${baseTest.packageName}.${className}`,
          '--no-daemon',
          '--console=plain',
          '--rerun-tasks',
        ],
        gradleDirectory,
        fixtureOutputLog,
        runId,
        `red-fixtures.${name}`,
        manifest,
      );
      if (
        result.signal !== null ||
        !Number.isInteger(result.code) ||
        result.code <= 0 ||
        !expectedOutput.test(result.output)
      ) {
        throw new Error(
          `${name} fixture did not fail for the expected reason; exit=${result.code}; log=${fixtureOutputLog}`,
        );
      }
      if (expectedCompileTask !== undefined) {
        assertFailedTask(result.output, expectedCompileTask);
      } else {
        assertExecutedTask(result.output, `${baseProjectPath}:testDebugUnitTest`);
      }
      if (expectedJUnit !== undefined) {
        const suite = assertExpectedJUnitResult([reportPath], testClass, expectedJUnit, startedAtMs);
        const failureBody = suite.testCases[0]?.body ?? '';
        if (!failureBody.includes('A3 assertion fixture must execute')) {
          throw new Error('A3 assertion red was not recorded on its exact JUnit testcase');
        }
      }
      process.stdout.write(`TERMINAL_ANDROID_UNIT_TEST_RED=${name} PASS exit=${result.code} log=${fixtureOutputLog}\n`);
    };
    await runFixture(
      'compile-fail',
      'A3CompileFailFixture',
      makeSource(
        'A3CompileFailFixture',
        `TerminalTopologyHostRegistry.HostConfig(\n      port = 43172, basePath = "/terminal-topology", heartbeatIntervalMs = 10000L,\n      heartbeatTimeoutMs = 30000L, nodeId = "test-node", displayName = "TER test",\n      instanceMode = "MASTER", displayRole = "CHIEF",\n    )`,
      ),
      {
        expectedOutput: /no value passed for parameter 'moduleName'/i,
        expectedCompileTask: `${baseProjectPath}:compileDebugUnitTestKotlin`,
      },
    );
    fs.rmSync(path.join(fixtureSourceDirectory, 'compile-fail.kt'), {force: true});
    await runFixture(
      'assertion-fail',
      'A3AssertionFailFixture',
      makeSource('A3AssertionFailFixture', 'org.junit.Assert.fail("A3 assertion fixture must execute")'),
      {
        expectedOutput: /A3AssertionFailFixture > fixture FAILED/,
        expectedJUnit: {tests: 1, skipped: 0, failures: 1, errors: 0},
      },
    );
    value.outcome = 'PASS';
  } catch (error) {
    failure = error;
    value.outcome = 'FAIL';
    value.firstFailure = error instanceof Error ? error.message : String(error);
  } finally {
    let cleanupError = null;
    try {
      if (fixtureRoot !== null) fs.rmSync(fixtureRoot, {recursive: true, force: true});
    } catch (error) {
      cleanupError = error instanceof Error ? error.message : String(error);
    }
    const fixtureDirectoryClean = fixtureRoot === null || !fs.existsSync(fixtureRoot);
    const ownedProcessCleanupFailed = value.cleanup === 'FAIL' || value.processes.length > 0;
    value.cleanup = !ownedProcessCleanupFailed && fixtureDirectoryClean ? 'PASS' : 'FAIL';
    if (cleanupError !== null) value.cleanupError = cleanupError;
    if (value.cleanup !== 'PASS' && failure === null) {
      failure = new Error(
        `Kotlin red fixture temporary directory cleanup failed: ${cleanupError ?? 'directory remains'}`,
      );
      value.outcome = 'FAIL';
      value.firstFailure = failure.message;
    }
    value.finishedAt = new Date().toISOString();
    try {
      fs.writeFileSync(manifestPath, JSON.stringify(value, null, 2));
      writeEvent(logPath, runId, 'red-fixtures.finish', {
        outcome: value.outcome,
        cleanup: value.cleanup,
        firstFailure: value.firstFailure ?? null,
        manifestPath,
      });
    } catch (error) {
      const finalizationError = error instanceof Error ? error : new Error(String(error));
      failure =
        failure === null
          ? finalizationError
          : new AggregateError([failure, finalizationError], 'Kotlin red fixture and finalization both failed');
    }
    process.stdout.write(`TERMINAL_ANDROID_UNIT_TEST_RED_FIXTURE_CLEANUP=${value.cleanup}\n`);
  }
  if (failure) throw failure;
  if (value.cleanup !== 'PASS') throw new Error('Kotlin red fixture temporary directory cleanup failed');
  process.stdout.write(`TERMINAL_ANDROID_UNIT_TEST_RED_FIXTURES=PASS runId=${runId} manifest=${manifestPath}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(
      `TERMINAL_ANDROID_UNIT_TESTS=FAIL ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
