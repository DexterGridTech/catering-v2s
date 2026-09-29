const text = value => String(value ?? '').replace(/\r/g, '');

export const parsePidofResult = (pidof, deviceState = null) => {
  if (pidof?.error !== undefined && pidof.error !== null) {
    throw new Error(`TERMINAL_TOPOLOGY_PIDOF_EXECUTION_FAILED:${pidof.error.code ?? 'UNKNOWN'}`);
  }
  const stdout = text(pidof?.stdout).trim();
  const stderr = text(pidof?.stderr).trim();
  if (pidof?.status === 0) {
    const tokens = stdout.length === 0 ? [] : stdout.split(/\s+/);
    if (
      stderr.length > 0 ||
      tokens.length === 0 ||
      tokens.some(token => !/^\d+$/.test(token) || Number(token) <= 0)
    ) {
      throw new Error('TERMINAL_TOPOLOGY_PIDOF_SUCCESS_OUTPUT_INVALID');
    }
    return Object.freeze(tokens);
  }
  if (pidof?.status === 1 && stdout.length === 0 && stderr.length === 0) {
    if (deviceState?.error !== undefined && deviceState.error !== null) {
      throw new Error(`TERMINAL_TOPOLOGY_DEVICE_STATE_READBACK_FAILED:${deviceState.error.code ?? 'UNKNOWN'}`);
    }
    if (
      deviceState?.status === 0 &&
      text(deviceState.stdout).trim() === 'device' &&
      text(deviceState.stderr).trim().length === 0
    ) {
      return Object.freeze([]);
    }
    const deviceStateDetail = text(deviceState?.stderr).trim() || text(deviceState?.stdout).trim();
    throw new Error(
      `TERMINAL_TOPOLOGY_DEVICE_STATE_READBACK_FAILED:${deviceStateDetail || `exit=${deviceState?.status ?? 'missing'}`}`,
    );
  }
  const detail = stderr || stdout || `exit=${pidof?.status ?? 'unknown'}`;
  throw new Error(`TERMINAL_TOPOLOGY_PIDOF_READBACK_FAILED:${detail}`);
};

export const parseProcStatStartTicks = (value, expectedPid) => {
  const stat = text(value).trim();
  const expected = String(expectedPid ?? '');
  if (!/^[1-9]\d*$/.test(expected)) {
    throw new Error('TERMINAL_TOPOLOGY_PROC_STAT_PID_INVALID');
  }
  const actualPid = stat.match(/^([1-9]\d*)\s+\(/)?.[1];
  if (actualPid === undefined) {
    throw new Error('TERMINAL_TOPOLOGY_PROC_STAT_PID_INVALID');
  }
  if (actualPid !== expected) {
    throw new Error('TERMINAL_TOPOLOGY_PROC_STAT_PID_MISMATCH');
  }
  const endOfComm = stat.lastIndexOf(')');
  const fieldsAfterComm = endOfComm < 0 ? [] : stat.slice(endOfComm + 2).trim().split(/\s+/);
  const startTicks = fieldsAfterComm[19] ?? '';
  if (!/^\d+$/.test(startTicks)) throw new Error('TERMINAL_TOPOLOGY_PROC_STAT_START_TICKS_INVALID');
  return startTicks;
};
