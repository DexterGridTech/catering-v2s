#!/usr/bin/env node
import {spawn, spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 6)) {
  process.stderr.write('TERMINAL_AUTOMATION_NODE_VERSION_UNSUPPORTED minimum=22.6\n');
  process.exitCode = 2;
} else {
  const runner = path.join(root, 'tools/terminal-automation/src/runner.ts');
  const identity = spawnSync('ps', ['-o', 'lstart=', '-p', String(process.pid)], {encoding: 'utf8'});
  const wrapperStart = identity.status === 0 ? identity.stdout.trim().replace(/\s+/gu, ' ') : '';
  if (!wrapperStart) {
    process.stderr.write('TERMINAL_AUTOMATION_WRAPPER_IDENTITY_FAILED\n');
    process.exitCode = 1;
  } else {
    const child = spawn(process.execPath, ['--experimental-strip-types', runner, ...process.argv.slice(2)], {
      cwd: root,
      env: {
        ...process.env,
        TERMINAL_AUTOMATION_WRAPPER_PID: String(process.pid),
        TERMINAL_AUTOMATION_WRAPPER_START_TOKEN: wrapperStart,
      },
      stdio: 'inherit',
    });
    child.once('error', error => {
      process.stderr.write(`TERMINAL_AUTOMATION_RUNNER_START_FAILED code=${error.code ?? 'UNKNOWN'}\n`);
      process.exitCode = 1;
    });
    child.once('exit', (code, signal) => {
      if (signal) {
        process.stderr.write(`TERMINAL_AUTOMATION_RUNNER_SIGNAL=${signal}\n`);
        process.exitCode = 1;
      } else {
        process.exitCode = code ?? 1;
      }
    });
  }
}
