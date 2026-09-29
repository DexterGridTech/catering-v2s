export const waitForRoleOccupancyProbe = (socket, timeoutMs = 5_000, timers = {setTimeout, clearTimeout}) =>
  new Promise((resolve, reject) => {
    let settled = false;
    let timeout = null;
    let closeObserved = false;
    const onMessage = value => {
      try {
        const message = JSON.parse(String(value));
        if (message.type === 'hello-rejected') {
          const reasonCode =
            typeof message.error?.code === 'string' ? message.error.code : 'TOPOLOGY_REJECTION_CODE_MISSING';
          settle(resolve, {
            status: reasonCode === 'TOPOLOGY_ROLE_OCCUPIED' ? 'PASS' : 'FAIL',
            messageType: message.type,
            reasonCode,
          });
        }
      } catch {
        settle(resolve, {status: 'FAIL', reasonCode: 'TOPOLOGY_PROTOCOL_REJECTED'});
      }
    };
    const onClose = (_code, reason) => {
      closeObserved = true;
      settle(resolve, {
        status: 'FAIL',
        reasonCode: String(reason).includes('ROLE_OCCUPIED')
          ? 'TOPOLOGY_REJECTION_MESSAGE_MISSING'
          : 'TOPOLOGY_PEER_UNREACHABLE',
      });
    };
    const onError = error => settle(reject, error);
    const onLateError = () => undefined;
    const settle = (complete, value) => {
      if (settled) return;
      settled = true;
      if (timeout !== null) timers.clearTimeout(timeout);
      socket.removeListener('message', onMessage);
      socket.removeListener('close', onClose);
      socket.removeListener('error', onError);
      if (!closeObserved) {
        socket.on('error', onLateError);
        socket.once('close', () => socket.removeListener('error', onLateError));
        try {
          socket.close();
        } catch {
          // A socket that already errored or closed needs no second close action.
        }
      }
      complete(value);
    };

    socket.on('message', onMessage);
    socket.on('close', onClose);
    socket.on('error', onError);
    timeout = timers.setTimeout(() => settle(resolve, {status: 'FAIL', reasonCode: 'TOPOLOGY_TIMEOUT'}), timeoutMs);
  });
