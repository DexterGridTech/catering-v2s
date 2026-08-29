import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const testPath = path.join(toolDirectory, 'check-static.test.mjs');
const checkPath = path.join(toolDirectory, 'check-static.mjs');

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
console.log('TERMINAL_STATIC=PASS');
