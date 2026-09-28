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

function walk(directory, result = []) {
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (entry.isDirectory() && ['node_modules', '.git', '.gradle'].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target, result);
    else if (entry.isFile()) result.push(target);
  }
  return result;
}

export function discoverKotlinTestClasses(moduleRoot) {
  const testRoot = path.join(moduleRoot, 'src/test');
  return walk(testRoot)
    .filter(file => file.endsWith('.kt'))
    .map(file => {
      const source = fs
        .readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      const packageName = source.match(/^\s*package\s+([\w.]+)/m)?.[1];
      const className = source.match(/\bclass\s+([A-Za-z_][\w]*)\b/)?.[1];
      const methodPattern =
        /@Test\b(?:\s*\([^)]*\))?\s*(?:@[\w.]+(?:\([^)]*\))?\s*)*(?:suspend\s+)?fun\s+(?:`[^`]+`|[A-Za-z_][\w]*)/g;
      const testCount = [...source.matchAll(methodPattern)].length;
      if (!packageName || !className || testCount === 0) return null;
      return {file, packageName, className, qualifiedName: `${packageName}.${className}`, testCount};
    })
    .filter(Boolean)
    .sort((left, right) => left.qualifiedName.localeCompare(right.qualifiedName));
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

export function validateJUnitReports(testClasses, reportFiles) {
  const suites = [];
  for (const file of reportFiles) {
    const xml = fs.readFileSync(file, 'utf8');
    for (const match of xml.matchAll(/<testsuite\b[^>]*>/g)) {
      suites.push({file, ...xmlAttributes(match[0])});
    }
  }
  const missing = [];
  const mismatches = [];
  const matchedFiles = new Set();
  for (const testClass of testClasses) {
    const suite = suites.find(
      candidate =>
        candidate.name === testClass.qualifiedName ||
        candidate.name?.endsWith(`.${testClass.className}`) ||
        path.basename(candidate.file).includes(testClass.className),
    );
    if (!suite) {
      missing.push(testClass.qualifiedName);
      continue;
    }
    matchedFiles.add(suite.file);
    const tests = Number(suite.tests);
    const skipped = Number(suite.skipped ?? 0);
    const failures = Number(suite.failures ?? 0);
    const errors = Number(suite.errors ?? 0);
    if (tests !== testClass.testCount || skipped !== 0 || failures !== 0 || errors !== 0) {
      mismatches.push({
        className: testClass.qualifiedName,
        declared: testClass.testCount,
        tests,
        skipped,
        failures,
        errors,
        report: suite.file,
      });
    }
  }
  const unmatchedReports = reportFiles.filter(file => !matchedFiles.has(file));
  if (missing.length || mismatches.length || unmatchedReports.length) {
    throw new Error(
      `JUnit report mismatch missing=${JSON.stringify(missing)} mismatches=${JSON.stringify(mismatches)} unmatched=${JSON.stringify(unmatchedReports)}`,
    );
  }
  return {
    classes: testClasses.length,
    declaredTests: testClasses.reduce((total, testClass) => total + testClass.testCount, 0),
    reports: reportFiles.length,
  };
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

function readStartToken(pid) {
  const result = spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], {encoding: 'utf8'});
  return result.status === 0 ? result.stdout.trim().replace(/\s+/g, ' ') : null;
}

function runCommand(command, args, cwd, logPath, runId, phase, manifest, {markCleanupOnClose = true} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    const startedAt = process.hrtime.bigint();
    const rawLog = fs.createWriteStream(logPath, {flags: 'a'});
    let output = '';
    const record = {
      command,
      args,
      cwd,
      pid: child.pid ?? null,
      startToken: child.pid ? readStartToken(child.pid) : null,
      startedAt: new Date().toISOString(),
    };
    manifest.value.processes = [record];
    fs.writeFileSync(manifest.path, JSON.stringify(manifest.value, null, 2));
    writeEvent(logPath, runId, `${phase}.start`, {
      pid: child.pid ?? null,
      startToken: record.startToken,
      command,
      args,
      cwd,
    });
    const collect = stream =>
      stream.on('data', chunk => {
        const text = chunk.toString();
        output += text;
        rawLog.write(text);
        process.stdout.write(text);
      });
    collect(child.stdout);
    collect(child.stderr);
    child.on('error', error => {
      rawLog.end();
      reject(error);
    });
    child.on('close', (code, signal) => {
      rawLog.end();
      manifest.processes = [];
      const elapsedMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
      manifest.value.processes = [];
      manifest.value.cleanup = markCleanupOnClose ? 'PASS' : 'RUNNING';
      fs.writeFileSync(manifest.path, JSON.stringify(manifest.value, null, 2));
      writeEvent(logPath, runId, `${phase}.finish`, {exitCode: code, signal, elapsedMs, cleanup: 'PASS'});
      resolve({code, signal, output, elapsedMs});
    });
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
    const testClass = [{qualifiedName: 'sample.ExampleTest', className: 'ExampleTest', testCount: 2}];
    const report = path.join(fixture, 'TEST-sample.ExampleTest.xml');
    fs.writeFileSync(
      report,
      '<testsuite name="sample.ExampleTest" tests="2" skipped="0" failures="0" errors="0"></testsuite>',
    );
    if (validateJUnitReports(testClass, [report]).declaredTests !== 2)
      throw new Error('valid JUnit fixture was rejected');
    fs.writeFileSync(
      report,
      '<testsuite name="sample.ExampleTest" tests="1" skipped="1" failures="0" errors="0"></testsuite>',
    );
    let rejected = false;
    try {
      validateJUnitReports(testClass, [report]);
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error('skipped or missing JUnit execution was accepted');
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
    [path.join(repositoryRoot, '.runtime')],
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
    const projects = await runCommand(
      gradleWrapper,
      ['projects', '--no-daemon', '--console=plain'],
      gradleDirectory,
      projectsLog,
      runId,
      'projects',
      manifest,
    );
    if (projects.code !== 0) throw new Error(`Gradle project discovery failed (${projects.code})`);
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
      const startedAt = Date.now();
      const result = await runCommand(
        gradleWrapper,
        [taskPath, '--no-daemon', '--console=plain', '--rerun-tasks'],
        gradleDirectory,
        moduleLog,
        runId,
        `module-${index + 1}`,
        manifest,
      );
      if (result.code !== 0) throw new Error(`Gradle unit test failed for ${taskPath}; see ${moduleLog}`);
      assertExecutedTask(result.output, taskPath);
      const reportRoot = path.join(task.moduleRoot, 'build/test-results/testDebugUnitTest');
      const reports = walk(reportRoot).filter(file => file.endsWith('.xml'));
      const totals = validateJUnitReports(task.classes, reports);
      const elapsedMs = Date.now() - startedAt;
      const moduleResult = {projectPath: task.projectPath, task: taskPath, elapsedMs, ...totals, outcome: 'PASS'};
      value.modules.push(moduleResult);
      fs.writeFileSync(manifestPath, JSON.stringify(value, null, 2));
      writeEvent(logPath, runId, 'module.pass', moduleResult);
    }
    value.outcome = 'PASS';
    value.cleanup = 'PASS';
    value.finishedAt = new Date().toISOString();
    fs.writeFileSync(manifestPath, JSON.stringify(value, null, 2));
    const methods = value.modules.reduce((total, module) => total + module.declaredTests, 0);
    writeEvent(logPath, runId, 'run.finish', {
      outcome: 'PASS',
      cleanup: 'PASS',
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
    value.cleanup = 'PASS';
    value.firstFailure = error instanceof Error ? error.message : String(error);
    value.finishedAt = new Date().toISOString();
    fs.writeFileSync(manifestPath, JSON.stringify(value, null, 2));
    writeEvent(logPath, runId, 'run.finish', {
      outcome: 'FAIL',
      cleanup: 'PASS',
      firstFailure: value.firstFailure,
      manifestPath,
    });
    throw error;
  }
}

async function runA9LockRedFixture() {
  const budget = spawnSync(
    path.join(repositoryRoot, 'scripts/env/check-runtime-resource-budget'),
    [path.join(repositoryRoot, '.runtime')],
    {cwd: repositoryRoot, encoding: 'utf8'},
  );
  process.stdout.write(budget.stdout ?? '');
  process.stderr.write(budget.stderr ?? '');
  if (budget.status !== 0) throw new Error('managed resource budget did not pass before A9 lock-order red fixture');

  fs.mkdirSync(outputRoot, {recursive: true});
  const runId = `ter-a9-lock-red-${process.pid}-${Date.now()}`;
  const fixtureRoot = fs.mkdtempSync(path.join(outputRoot, `${runId}-copy-`));
  const logPath = path.join(outputRoot, `${runId}.jsonl`);
  const manifestPath = path.join(outputRoot, `${runId}.manifest.json`);
  const moduleRoot = path.join(terminalRoot, 'application/base/android/android');
  const mainRoot = path.join(moduleRoot, 'src/main');
  const copiedMainRoot = path.join(fixtureRoot, 'src/main');
  const serverRelative = 'java/com/catering/v2s/terminal/application/base/android/TerminalTopologyServer.kt';
  const registryRelative = 'java/com/catering/v2s/terminal/application/base/android/TerminalTopologyHostRegistry.kt';
  const copiedServer = path.join(copiedMainRoot, serverRelative);
  const copiedRegistry = path.join(copiedMainRoot, registryRelative);
  const initPath = path.join(fixtureRoot, 'a9-lock-red.init.gradle');
  const [testClass] = discoverKotlinTestClasses(moduleRoot);
  if (!testClass) throw new Error('application-base Android test class is required for A9 lock-order fixture');

  fs.cpSync(mainRoot, copiedMainRoot, {recursive: true});
  let serverSource = fs.readFileSync(copiedServer, 'utf8');
  const onCloseBefore = `      synchronized(peerLock) {\n        if (peer === this) peer = null\n      }\n      publishConnection("close", connectionId, safeCloseReason(reason))`;
  const onCloseAfter = `      synchronized(peerLock) {\n        if (peer === this) peer = null\n        publishConnection("close", connectionId, safeCloseReason(reason))\n      }`;
  if (serverSource.split(onCloseBefore).length !== 2) {
    fs.rmSync(fixtureRoot, {recursive: true, force: true});
    throw new Error('A9 server lock-order mutation anchor did not match exactly once');
  }
  serverSource = serverSource.replace(onCloseBefore, onCloseAfter);
  fs.writeFileSync(copiedServer, serverSource);

  let registrySource = fs.readFileSync(copiedRegistry, 'utf8');
  const closePeerBefore = `    val active = synchronized(lock) { server }\n    active?.closePeer(reason)\n    return success(mapOf("completed" to true))`;
  const closePeerAfter = `    synchronized(lock) { server?.closePeer(reason) }\n    return success(mapOf("completed" to true))`;
  if (registrySource.split(closePeerBefore).length !== 2) {
    fs.rmSync(fixtureRoot, {recursive: true, force: true});
    throw new Error('A9 registry lock-order mutation anchor did not match exactly once');
  }
  registrySource = registrySource.replace(closePeerBefore, closePeerAfter);
  fs.writeFileSync(copiedRegistry, registrySource);

  fs.writeFileSync(
    initPath,
    `gradle.projectsEvaluated {\n  def targetPath = System.getProperty('ter.a9.fixture.project')\n  def mainDir = System.getProperty('ter.a9.fixture.main')\n  def target = gradle.rootProject.findProject(targetPath)\n  if (target != null) {\n    def android = target.extensions.getByName('android')\n    android.sourceSets.getByName('main').java.setSrcDirs([mainDir])\n    def kotlin = target.extensions.findByName('kotlin')\n    kotlin.sourceSets.getByName('main').kotlin.setSrcDirs([mainDir])\n  }\n}\n`,
  );

  const projects = spawnSync(gradleWrapper, ['projects', '--no-daemon', '--console=plain'], {
    cwd: gradleDirectory,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (projects.status !== 0) {
    fs.rmSync(fixtureRoot, {recursive: true, force: true});
    throw new Error(`Gradle project discovery for A9 lock-order fixture failed: ${projects.status}`);
  }
  const locations = parseGradleProjectLocations(projects.stdout, gradleDirectory);
  const moduleProject = [...locations].find(
    ([, location]) => fs.existsSync(location) && fs.realpathSync(location) === fs.realpathSync(moduleRoot),
  );
  if (!moduleProject) {
    fs.rmSync(fixtureRoot, {recursive: true, force: true});
    throw new Error('Gradle project for A9 lock-order fixture was not discovered');
  }
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
  const value = {
    schemaVersion: 1,
    runId,
    mode: 'a9-lock-order-red-fixture',
    sourceSha256: sha256Files(sourceFiles),
    startedAt: new Date().toISOString(),
    fixtureRoot: path.relative(repositoryRoot, fixtureRoot),
    mutatedFiles: [path.relative(repositoryRoot, copiedServer), path.relative(repositoryRoot, copiedRegistry)],
    modules: [],
    processes: [],
    cleanup: 'RUNNING',
  };
  const manifest = {path: manifestPath, value, processes: []};
  fs.writeFileSync(manifestPath, JSON.stringify(value, null, 2));
  writeEvent(logPath, runId, 'red-fixture.start', {sourceSha256: value.sourceSha256, mutatedFiles: value.mutatedFiles});

  let failure = null;
  try {
    const args = [
      '-I',
      initPath,
      `-Dter.a9.fixture.project=${projectPath}`,
      `-Dter.a9.fixture.main=${copiedMainRoot}`,
      `${projectPath}:testDebugUnitTest`,
      '--tests',
      `${testClass.qualifiedName}*lock paths complete without a reverse lock cycle in ten fresh JVMs*`,
      '--no-daemon',
      '--console=plain',
      '--rerun-tasks',
    ];
    const result = await runCommand(gradleWrapper, args, gradleDirectory, logPath, runId, 'a9-red-fixture', manifest, {
      markCleanupOnClose: false,
    });
    const reportRoot = path.join(moduleRoot, 'build/test-results/testDebugUnitTest');
    const reports = walk(reportRoot).filter(
      file => file.endsWith('.xml') && path.basename(file).includes(testClass.className),
    );
    const reportText = reports.map(file => fs.readFileSync(file, 'utf8')).join('\n');
    const redAttempts = [
      ...new Set(
        [...reportText.matchAll(/attempt=(\d+) exit=12 output=A9_LOCK_ORDER_DEADLOCK_CONFIRMED/g)].map(match =>
          Number(match[1]),
        ),
      ),
    ].sort((left, right) => left - right);
    const redCount = redAttempts.length;
    const methodFailurePresent = reportText.includes(
      'production registry lock paths complete without a reverse lock cycle in ten fresh JVMs',
    );
    const preservedReport = path.join(outputRoot, `${runId}-junit.xml`);
    if (reports.length === 1) fs.copyFileSync(reports[0], preservedReport);
    value.junitReports =
      reports.length === 1
        ? [path.relative(repositoryRoot, preservedReport)]
        : reports.map(file => path.relative(repositoryRoot, file));
    value.expectedRedJvmCount = redCount;
    value.expectedRedJvmAttempts = redAttempts;
    if (
      result.code === 0 ||
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
    fs.rmSync(fixtureRoot, {recursive: true, force: true});
    value.cleanup = 'PASS';
    value.finishedAt = new Date().toISOString();
    value.processes = [];
    fs.writeFileSync(manifestPath, JSON.stringify(value, null, 2));
    writeEvent(logPath, runId, 'red-fixture.finish', {
      outcome: value.outcome,
      cleanup: value.cleanup,
      expectedRedJvmCount: value.expectedRedJvmCount ?? null,
      firstFailure: value.firstFailure ?? null,
      manifestPath,
    });
    process.stdout.write(
      `TERMINAL_A9_LOCK_ORDER_RED_FIXTURE_CLEANUP=${fs.existsSync(fixtureRoot) ? 'FAIL' : 'PASS'}\n`,
    );
  }
  if (failure) throw failure;
}

async function runRedFixtures() {
  const budget = spawnSync(
    path.join(repositoryRoot, 'scripts/env/check-runtime-resource-budget'),
    [path.join(repositoryRoot, '.runtime')],
    {cwd: repositoryRoot, encoding: 'utf8'},
  );
  process.stdout.write(budget.stdout ?? '');
  process.stderr.write(budget.stderr ?? '');
  if (budget.status !== 0) throw new Error('managed resource budget did not pass before Kotlin red fixtures');
  fs.mkdirSync(outputRoot, {recursive: true});
  const fixtureRoot = fs.mkdtempSync(path.join(outputRoot, 'red-fixture-'));
  const fixtureLogRoot = path.join(outputRoot, 'red-fixture-logs');
  fs.mkdirSync(fixtureLogRoot, {recursive: true});
  const baseModule = path.join(terminalRoot, 'application/base/android/android');
  const [baseTest] = discoverKotlinTestClasses(baseModule);
  if (!baseTest) throw new Error('application-base Android test class is required for TP-A4 red fixtures');
  const relativeTestPath = path.relative(path.join(baseModule, 'src/test'), baseTest.file);
  const fixtureSourceDirectory = path.join(fixtureRoot, 'src/test', path.dirname(relativeTestPath));
  fs.mkdirSync(fixtureSourceDirectory, {recursive: true});
  const projects = spawnSync(gradleWrapper, ['projects', '--no-daemon', '--console=plain'], {
    cwd: gradleDirectory,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (projects.status !== 0) throw new Error(`Gradle project discovery for red fixtures failed: ${projects.status}`);
  const locations = parseGradleProjectLocations(projects.stdout, gradleDirectory);
  const baseProject = [...locations].find(
    ([, location]) => fs.existsSync(location) && fs.realpathSync(location) === fs.realpathSync(baseModule),
  );
  if (!baseProject) throw new Error('Gradle project path for application-base Android test source was not discovered');
  const [baseProjectPath] = baseProject;
  const fixtureSourceRoot = path.join(fixtureRoot, 'src/test');
  const initScript = fixtureInitScript(fixtureSourceRoot);
  const projectArgs = [
    '-I',
    initScript,
    `-Dter.a3.fixture.project=${baseProjectPath}`,
    `-Dter.a3.fixture.directory=${fixtureSourceRoot}`,
  ];
  const wrapper = gradleWrapper;
  const makeSource = (className, body) =>
    `package ${baseTest.packageName}\n\nimport org.junit.Test\n\nclass ${className} {\n  @Test\n  fun fixture() {\n${body}\n  }\n}\n`;
  const runFixture = (name, source, expectedPattern, expectedReportPattern) => {
    const file = path.join(fixtureSourceDirectory, `${name}.kt`);
    fs.writeFileSync(file, source);
    const logPath = path.join(fixtureLogRoot, `${name}.log`);
    const runId = `ter-a3-red-${name}-${Date.now()}`;
    const result = spawnSync(
      wrapper,
      [`${baseProjectPath}:testDebugUnitTest`, ...projectArgs, '--no-daemon', '--console=plain', '--rerun-tasks'],
      {cwd: gradleDirectory, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024},
    );
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    fs.writeFileSync(logPath, output);
    let reportOutput = '';
    if (expectedReportPattern) {
      const reports = walk(path.join(baseModule, 'build/test-results/testDebugUnitTest')).filter(
        report => report.endsWith('.xml') && path.basename(report).includes('A3AssertionFailFixture'),
      );
      reportOutput = reports.map(report => fs.readFileSync(report, 'utf8')).join('\n');
    }
    if (
      result.status === 0 ||
      !expectedPattern.test(output) ||
      (expectedReportPattern && !expectedReportPattern.test(reportOutput))
    ) {
      throw new Error(`${name} fixture did not fail for the expected reason; exit=${result.status}; log=${logPath}`);
    }
    process.stdout.write(`TERMINAL_ANDROID_UNIT_TEST_RED=${name} PASS exit=${result.status} log=${logPath}\n`);
  };
  try {
    runFixture(
      'compile-fail',
      makeSource(
        'A3CompileFailFixture',
        `TerminalTopologyHostRegistry.HostConfig(\n      port = 43172, basePath = "/terminal-topology", heartbeatIntervalMs = 10000L,\n      heartbeatTimeoutMs = 30000L, nodeId = "test-node", displayName = "TER test",\n      instanceMode = "MASTER", displayRole = "CHIEF",\n    )`,
      ),
      /no value passed for parameter 'moduleName'/i,
    );
    fs.rmSync(path.join(fixtureSourceDirectory, 'compile-fail.kt'), {force: true});
    runFixture(
      'assertion-fail',
      makeSource('A3AssertionFailFixture', 'org.junit.Assert.fail("A3 assertion fixture must execute")'),
      /A3AssertionFailFixture > fixture FAILED/,
      /<testsuite[^>]*tests="1"[^>]*failures="1"[^>]*errors="0"[\s\S]*A3 assertion fixture must execute/,
    );
  } finally {
    fs.rmSync(fixtureRoot, {recursive: true, force: true});
    process.stdout.write('TERMINAL_ANDROID_UNIT_TEST_RED_FIXTURE_CLEANUP=PASS\n');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(
      `TERMINAL_ANDROID_UNIT_TESTS=FAIL ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
