const { spawnSync } = require('child_process');

function spawnSyncWithAutoShell(command, args, options) {
  return spawnSync(command, args, { ...options, shell: process.platform === 'win32' });
}

module.exports = { spawnSyncWithAutoShell };
