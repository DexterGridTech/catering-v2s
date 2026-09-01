import {spawnSync} from 'node:child_process';

export function spawnSyncWithAutoShell(command, args, options) {
  return spawnSync(command, args, {
    ...options,
    shell: process.platform === 'win32',
  });
}
