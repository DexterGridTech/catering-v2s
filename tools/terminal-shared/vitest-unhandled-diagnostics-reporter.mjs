const validReason = new Set(['passed', 'interrupted', 'failed']);
const validErrorName = /^[A-Za-z][A-Za-z0-9_$]{0,63}$/;
const validErrorCode = /^[A-Z][A-Z0-9_]{1,63}$/;
const sourceFrame = /^\s*at (?:.*?\s+\()?(.+):(\d+):(\d+)\)?$/;

const safeFrames = stack => {
  if (typeof stack !== 'string') return [];
  return stack.split(/\r?\n/).slice(1)
    .map(line => line.match(sourceFrame))
    .filter(Boolean)
    .slice(0, 4)
    .map(([, file, line, column]) => `${file.split(/[\\/]/).pop()}:${line}:${column}`);
};

export const formatUnhandledDiagnostics = (errors, reason) => {
  const safeReason = validReason.has(reason) ? reason : 'unknown';
  const boundedErrors = Array.isArray(errors) ? errors.slice(0, 8) : [];
  const lines = [`VITEST_RUN_END reason=${safeReason} unhandled=${Array.isArray(errors) ? errors.length : 'invalid'}`];
  boundedErrors.forEach((error, index) => {
    const name = typeof error?.name === 'string' && validErrorName.test(error.name) ? error.name : 'UnknownError';
    const code = typeof error?.code === 'string' && validErrorCode.test(error.code) ? error.code : 'none';
    const frames = safeFrames(error?.stack);
    lines.push(`VITEST_UNHANDLED_ERROR index=${index} type=${name} code=${code} frames=${frames.join('>') || 'unavailable'}`);
  });
  if (Array.isArray(errors) && errors.length > boundedErrors.length)
    lines.push(`VITEST_UNHANDLED_ERROR_TRUNCATED count=${errors.length - boundedErrors.length}`);
  return lines;
};

export default class VitestUnhandledDiagnosticsReporter {
  onTestRunEnd(_testModules, unhandledErrors, reason) {
    for (const line of formatUnhandledDiagnostics(unhandledErrors, reason)) console.error(line);
  }
}
