import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = path.resolve(scriptDirectory, '../..');
const eslintPath = path.join(repositoryRoot, 'node_modules/.bin/eslint');
const suppressionPath = path.join(repositoryRoot, 'apps/terminal/eslint-suppressions.json');
const sourceExtensions = new Set(['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx']);
const ignoredDirectories = new Set(['build', 'dist', 'node_modules']);

function fail(reason, fields = {}) {
  console.error(`TERMINAL_PACKAGE_LINT=FAIL ${JSON.stringify({reason, ...fields})}`);
  process.exitCode = 1;
}

export function collectOwnedSourceFiles(sourceDirectory) {
  const result = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) result.push(absolutePath);
    }
  };
  if (fs.existsSync(sourceDirectory)) visit(sourceDirectory);
  return result.sort();
}

function lintDiagnostics(reports, root) {
  return reports.flatMap(report =>
    report.messages
      .filter(message => message.severity > 0)
      .map(message => ({
        file: path.relative(root, report.filePath),
        line: message.line,
        column: message.column,
        ruleId: message.ruleId,
        message: message.message,
      })),
  );
}

function main() {
  const startedAt = performance.now();
  const packageRoot = process.cwd();
  const packagePath = path.relative(repositoryRoot, packageRoot);
  const manifestPath = path.join(packageRoot, 'package.json');
  const packageName = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).name;
  const sourceDirectory = path.join(packageRoot, 'src');
  const expectedFiles = collectOwnedSourceFiles(sourceDirectory);

  if (!expectedFiles.length) {
    fail('empty-source-denominator', {packageName, sourceDirectory: path.relative(repositoryRoot, sourceDirectory)});
    return;
  }
  if (!fs.existsSync(eslintPath)) {
    fail('eslint-not-resolved', {packageName});
    return;
  }
  if (!fs.existsSync(suppressionPath)) {
    fail('suppression-file-missing', {packageName, suppressionPath: path.relative(repositoryRoot, suppressionPath)});
    return;
  }

  const result = spawnSync(
    eslintPath,
    [
      path.relative(repositoryRoot, sourceDirectory),
      '--format',
      'json',
      '--suppressions-location',
      path.relative(repositoryRoot, suppressionPath),
    ],
    {cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024},
  );

  let reports;
  try {
    reports = JSON.parse(result.stdout ?? '');
  } catch {
    fail('eslint-json-invalid', {packageName, status: result.status, stderr: result.stderr?.trim()});
    return;
  }

  const actualFiles = reports.map(report => path.resolve(report.filePath)).sort();
  const missing = expectedFiles.filter(file => !actualFiles.includes(file));
  const extra = actualFiles.filter(file => !expectedFiles.includes(file));
  const errors = reports.reduce((sum, report) => sum + report.errorCount, 0);
  const warnings = reports.reduce((sum, report) => sum + report.warningCount, 0);
  const elapsedMs = Math.round(performance.now() - startedAt);
  const fields = {
    packageName,
    packagePath,
    expectedFiles: expectedFiles.length,
    actualFiles: actualFiles.length,
    errors,
    warnings,
    elapsedMs,
  };

  if (missing.length || extra.length) {
    fail('source-denominator-mismatch', {
      ...fields,
      missing: missing.map(file => path.relative(repositoryRoot, file)),
      extra: extra.map(file => path.relative(repositoryRoot, file)),
    });
    return;
  }
  if (result.error || result.status !== 0 || errors || warnings) {
    const diagnostics = lintDiagnostics(reports, repositoryRoot);
    fail('eslint-reported-violations', {
      ...fields,
      status: result.status,
      findings: diagnostics.slice(0, 20),
      omittedFindings: Math.max(0, diagnostics.length - 20),
      stderr: result.stderr?.trim(),
    });
    return;
  }

  console.log(`TERMINAL_PACKAGE_LINT=PASS ${JSON.stringify(fields)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
