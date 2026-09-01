import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const testPath = path.join(toolDirectory, 'check-static.test.mjs');
const checkPath = path.join(toolDirectory, 'check-static.mjs');
const contractsTestPath = path.join(toolDirectory, '../terminal-contracts/check-static.test.mjs');
const contractsCheckPath = path.join(toolDirectory, '../terminal-contracts/check-static.mjs');
const platformPortsTestPath = path.join(toolDirectory, '../terminal-platform-ports/check-static.test.mjs');
const platformPortsCheckPath = path.join(toolDirectory, '../terminal-platform-ports/check-static.mjs');
const stateTestPath = path.join(toolDirectory, '../terminal-state/check-static.test.mjs');
const stateCheckPath = path.join(toolDirectory, '../terminal-state/check-static.mjs');
const runtimeTestPath = path.join(toolDirectory, '../terminal-runtime/check-static.test.mjs');
const runtimeCheckPath = path.join(toolDirectory, '../terminal-runtime/check-static.mjs');

function run(label, command, args) {
  const result = spawnSync(command, args, {cwd: path.resolve(toolDirectory, '../..'), encoding: 'utf8'});
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.status !== 0) {
    console.error(`TERMINAL_STATIC_FIRST_FAILURE:${label}:exit=${String(result.status)}`);
    process.exit(result.status ?? 1);
  }
}

run('model-test', process.execPath, [testPath]);
run('real-static-tree', process.execPath, [checkPath]);
run('contracts-model-test', process.execPath, [contractsTestPath]);
run('contracts-real-static', process.execPath, [contractsCheckPath]);
run('platform-ports-model-test', process.execPath, [platformPortsTestPath]);
run('platform-ports-real-static', process.execPath, [platformPortsCheckPath]);
run('state-model-test', process.execPath, [stateTestPath]);
run('state-real-static', process.execPath, [stateCheckPath]);
run('runtime-model-test', process.execPath, [runtimeTestPath]);
run('runtime-real-static', process.execPath, [runtimeCheckPath]);
console.log('TERMINAL_STATIC=PASS');
