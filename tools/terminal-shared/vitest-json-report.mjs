import path from 'node:path';

function normalizedFiles(files) {
  return files.map(file => path.resolve(file)).sort((left, right) => left.localeCompare(right));
}

function assertionStatuses(report) {
  if (!Array.isArray(report?.testResults)) throw new Error('VITEST_JSON_TEST_RESULTS_MISSING');
  const results = report.testResults.flatMap(file => {
    if (!Array.isArray(file?.assertionResults)) throw new Error('VITEST_JSON_ASSERTIONS_MISSING');
    return file.assertionResults.map(assertion => ({...assertion, file: path.resolve(file.name)}));
  });
  return results;
}

function safeFailureLine(value) {
  return String(value ?? '')
    .split(/\r?\n/, 1)[0]
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .replace(/\b\+?\d[\d ().-]{7,}\d\b/g, '[REDACTED_NUMBER]')
    .replace(/\b(password|passcode|token|cookie|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .slice(0, 300);
}

export function summarizeVitestFailureReport(report) {
  if (!Array.isArray(report?.testResults)) {
    const keys =
      Object.keys(report ?? {})
        .sort()
        .join(',') || 'none';
    return `VITEST_FAILURE_REPORT_SHAPE keys=${keys}`;
  }
  const failedAssertions = report.testResults.flatMap(file => {
    if (!Array.isArray(file?.assertionResults)) return [];
    return file.assertionResults
      .filter(assertion => assertion.status === 'failed')
      .map(assertion => ({
        file: path.basename(file.name ?? 'unknown-test-file'),
        test: safeFailureLine(assertion.fullName ?? assertion.title ?? 'unknown test'),
        detail: safeFailureLine(assertion.failureMessages?.[0] ?? ''),
      }));
  });
  if (failedAssertions.length === 0) {
    const failedFiles = report.testResults
      .filter(file => file?.status === 'failed')
      .map(file => ({file: path.basename(file.name ?? 'unknown-test-file'), detail: safeFailureLine(file.message)}));
    if (failedFiles.length === 0) {
      return `VITEST_FAILURE_REPORT_NO_FAILED_ITEMS files=${report.testResults.length} success=${String(report.success)} total=${String(report.numTotalTests)} failed=${String(report.numFailedTests)} pending=${String(report.numPendingTests)}`;
    }
    return failedFiles
      .slice(0, 10)
      .map(({file, detail}) => `VITEST_FAILED_FILE file=${file}${detail ? ` detail=${detail}` : ''}`)
      .join('\n');
  }
  return failedAssertions
    .slice(0, 10)
    .map(({file, test, detail}) => `VITEST_FAILED_TEST file=${file} test=${test}${detail ? ` detail=${detail}` : ''}`)
    .join('\n');
}

export function validateVitestJsonReport(report, {expectedFiles, mode, devTestFiles = []}) {
  if (!['PROD', 'DEV'].includes(mode)) throw new Error('VITEST_JSON_MODE_INVALID');
  const expected = normalizedFiles(expectedFiles);
  const actual = normalizedFiles(report?.testResults?.map(result => result?.name ?? '') ?? []);
  if (
    expected.some(file => !file) ||
    new Set(expected).size !== expected.length ||
    new Set(actual).size !== actual.length ||
    expected.length !== actual.length ||
    expected.some((file, index) => file !== actual[index])
  ) {
    throw new Error(
      `VITEST_JSON_FILE_SET_MISMATCH expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`,
    );
  }
  if (report.success !== true) throw new Error('VITEST_JSON_RUN_NOT_SUCCESSFUL');

  const allowedProdSkipFiles = new Set(normalizedFiles(devTestFiles));
  const statuses = assertionStatuses(report);
  if (statuses.length === 0) throw new Error('VITEST_JSON_NO_ASSERTIONS_EXECUTED');
  let skipped = 0;
  let todo = 0;
  let failed = 0;
  for (const result of report.testResults) {
    if (result.status !== 'passed' || result.assertionResults.length === 0) {
      throw new Error(`VITEST_JSON_FILE_NOT_PASSED file=${result.name} status=${result.status}`);
    }
    for (const assertion of result.assertionResults) {
      if (assertion.status === 'passed') continue;
      if (assertion.status === 'failed') {
        failed += 1;
        continue;
      }
      if (assertion.status === 'todo') {
        todo += 1;
        continue;
      }
      if (assertion.status === 'skipped') {
        skipped += 1;
        if (mode !== 'PROD' || !allowedProdSkipFiles.has(path.resolve(result.name))) {
          throw new Error(
            `VITEST_JSON_UNEXPECTED_SKIP file=${result.name} test=${assertion.fullName ?? assertion.title ?? ''}`,
          );
        }
        continue;
      }
      throw new Error(`VITEST_JSON_UNKNOWN_ASSERTION_STATUS file=${result.name} status=${assertion.status}`);
    }
  }

  const passed = statuses.filter(result => result.status === 'passed').length;
  const pending = skipped + todo;
  if (
    failed !== 0 ||
    todo !== 0 ||
    report.numTotalTests !== statuses.length ||
    report.numPassedTests !== passed ||
    report.numFailedTests !== failed ||
    report.numPendingTests !== pending ||
    report.numTodoTests !== todo
  ) {
    throw new Error(
      `VITEST_JSON_SUMMARY_MISMATCH ${JSON.stringify({
        total: report.numTotalTests,
        assertions: statuses.length,
        passed: report.numPassedTests,
        actualPassed: passed,
        failed: report.numFailedTests,
        actualFailed: failed,
        pending: report.numPendingTests,
        actualPending: pending,
        todo: report.numTodoTests,
        actualTodo: todo,
        skipped,
      })}`,
    );
  }
  const devAssertions = statuses.filter(result => allowedProdSkipFiles.has(result.file));
  if (mode === 'DEV' && devAssertions.length === 0) throw new Error('VITEST_JSON_DEV_TESTS_NOT_EXECUTED');
  return Object.freeze({files: expected.length, tests: statuses.length, skipped, mode});
}

export function validateVitestExpectedSingleFailure(report, {expectedFile, expectedTestTitle, expectedFailureMessage}) {
  if (report?.success !== false || !Array.isArray(report.testResults)) {
    throw new Error('VITEST_JSON_EXPECTED_RED_RUN_DID_NOT_FAIL');
  }
  if (typeof expectedFailureMessage !== 'string' || expectedFailureMessage.length === 0) {
    throw new Error('VITEST_JSON_RED_EXPECTED_FAILURE_MESSAGE_REQUIRED');
  }
  const expectedPath = path.resolve(expectedFile);
  const matchingFiles = report.testResults.filter(result => path.resolve(result.name) === expectedPath);
  if (report.testResults.length !== 1 || matchingFiles.length !== 1 || matchingFiles[0]?.status !== 'failed') {
    throw new Error(`VITEST_JSON_RED_FILE_MISMATCH count=${matchingFiles.length} results=${report.testResults.length}`);
  }
  const statuses = assertionStatuses(report);
  const failures = statuses.filter(result => result.status === 'failed');
  const unexpected = statuses.filter(result => result.status !== 'passed' && result.status !== 'failed');
  const targetFailures = failures.filter(result => result.file === expectedPath && result.title === expectedTestTitle);
  const actualFailureMessage = failures[0]?.failureMessages?.join('\n') ?? '';
  if (
    report.numFailedTests !== 1 ||
    failures.length !== 1 ||
    targetFailures.length !== 1 ||
    report.numTotalTests !== statuses.length ||
    report.numPassedTests !== statuses.length - 1 ||
    report.numPendingTests !== 0 ||
    report.numTodoTests !== 0 ||
    unexpected.length !== 0 ||
    !Array.isArray(failures[0]?.failureMessages) ||
    failures[0].failureMessages.length === 0 ||
    !actualFailureMessage.includes(expectedFailureMessage)
  ) {
    throw new Error(
      `VITEST_JSON_RED_CAUSE_MISMATCH ${JSON.stringify({
        totalTests: report.numTotalTests,
        assertionCount: statuses.length,
        passedTests: report.numPassedTests,
        failedTests: report.numFailedTests,
        pendingTests: report.numPendingTests,
        todoTests: report.numTodoTests,
        actualFailures: failures.map(result => ({file: result.file, title: result.title})),
        failureMessageMatched: actualFailureMessage.includes(expectedFailureMessage),
        unexpectedStatuses: unexpected.map(result => ({file: result.file, title: result.title, status: result.status})),
      })}`,
    );
  }
  return Object.freeze({failedFile: expectedPath, failedTest: expectedTestTitle});
}
