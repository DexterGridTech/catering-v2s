import {createHash} from 'node:crypto';
import {createServer, type IncomingMessage, type Server, type ServerResponse} from 'node:http';
import {connect, type Socket} from 'node:net';
import type {Duplex} from 'node:stream';
import {createDeflateRaw, constants as zlibConstants} from 'node:zlib';
import {Agent, ProxyAgent, WebSocket} from 'undici';
import {afterEach, describe, expect, it} from 'vitest';

const maxPayloadSize = 65_536;
const maxFragments = 1_024;
const websocketGuid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const liveServers: Server[] = [];
const liveDispatchers: Array<Agent | ProxyAgent> = [];

type UpgradeHandler = (socket: Duplex, request: IncomingMessage, head: Buffer) => void;
type SocketErrorObservation = Readonly<{
  readonly server: 'origin' | 'proxy';
  readonly connection: number;
  readonly code: string;
}>;

const observeSocketErrors = (
  socket: Duplex,
  server: SocketErrorObservation['server'],
  connection: number,
  observations: SocketErrorObservation[],
): void => {
  socket.on('error', error => {
    const code = (error as NodeJS.ErrnoException).code;
    observations.push({server, connection, code: typeof code === 'string' ? code : 'UNKNOWN'});
  });
};

const listen = async (server: Server): Promise<string> => {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('UNDICI_TEST_SERVER_ADDRESS_MISSING');
  return `http://127.0.0.1:${address.port}`;
};

const createOriginServer = (onUpgrade: UpgradeHandler, socketErrors: SocketErrorObservation[]): Server => {
  const server = createServer((_request: IncomingMessage, response: ServerResponse) => response.writeHead(404).end());
  let connectionNumber = 0;
  server.on('connection', socket => {
    connectionNumber += 1;
    observeSocketErrors(socket, 'origin', connectionNumber, socketErrors);
  });
  server.on('upgrade', (request, socket, head) => onUpgrade(socket, request, head));
  liveServers.push(server);
  return server;
};

const acceptWebSocket = (
  socket: Duplex,
  request: IncomingMessage,
  input: Readonly<{readonly compressedText?: Buffer; readonly text?: string}>,
): void => {
  const key = request.headers['sec-websocket-key'];
  if (typeof key !== 'string') {
    socket.destroy();
    return;
  }
  const accept = createHash('sha1').update(`${key}${websocketGuid}`).digest('base64');
  const extensionOffer = request.headers['sec-websocket-extensions'];
  const canCompress = typeof extensionOffer === 'string' && extensionOffer.includes('permessage-deflate');
  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    ...(canCompress ? ['Sec-WebSocket-Extensions: permessage-deflate'] : []),
  ];
  socket.write(`${headers.join('\r\n')}\r\n\r\n`);
  let received = Buffer.alloc(0);
  socket.on('data', payload => {
    received = Buffer.concat([received, payload]);
    if (received.length < 6) return;
    const lengthMarker = received[1]! & 0x7f;
    const extendedLengthBytes = lengthMarker === 126 ? 2 : lengthMarker === 127 ? 8 : 0;
    const maskOffset = 2 + extendedLengthBytes;
    if ((received[1]! & 0x80) === 0 || received.length < maskOffset + 4) return;
    const length =
      extendedLengthBytes === 2
        ? received.readUInt16BE(2)
        : extendedLengthBytes === 8
          ? Number(received.readBigUInt64BE(2))
          : lengthMarker;
    const payloadOffset = maskOffset + 4;
    if (received.length < payloadOffset + length || (received[0]! & 0x0f) !== 0x08) return;
    const mask = received.subarray(maskOffset, payloadOffset);
    const closePayload = Buffer.from(received.subarray(payloadOffset, payloadOffset + length));
    for (let index = 0; index < closePayload.length; index += 1) closePayload[index] ^= mask[index % 4]!;
    const closeHeader =
      closePayload.length < 126
        ? Buffer.from([0x88, closePayload.length])
        : Buffer.from([0x88, 126, closePayload.length >> 8, closePayload.length & 0xff]);
    socket.end(Buffer.concat([closeHeader, closePayload]));
  });
  if (input.compressedText !== undefined) {
    socket.write(encodeServerFrame(input.compressedText, true));
  } else if (input.text !== undefined) {
    socket.write(encodeServerFrame(Buffer.from(input.text, 'utf8'), false));
  }
};

const encodeServerFrame = (payload: Buffer, compressed: boolean, final = true, opcode = 0x01): Buffer => {
  const firstByte = (compressed ? 0x40 : 0) | (final ? 0x80 : 0) | opcode;
  if (payload.length < 126) return Buffer.concat([Buffer.from([firstByte, payload.length]), payload]);
  if (payload.length <= 65_535) {
    const header = Buffer.alloc(4);
    header[0] = firstByte;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = firstByte;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(payload.length), 2);
  return Buffer.concat([header, payload]);
};

const deflateMessage = (payload: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const deflater = createDeflateRaw();
    const chunks: Buffer[] = [];
    deflater.on('data', chunk => chunks.push(Buffer.from(chunk)));
    deflater.once('error', reject);
    deflater.write(payload);
    deflater.flush(zlibConstants.Z_SYNC_FLUSH, () => {
      const flushed = Buffer.concat(chunks);
      const trailer = Buffer.from([0x00, 0x00, 0xff, 0xff]);
      if (!flushed.subarray(-4).equals(trailer)) {
        reject(new Error('UNDICI_TEST_DEFLATE_SYNC_FLUSH_TRAILER_MISSING'));
        return;
      }
      deflater.close();
      resolve(flushed.subarray(0, -4));
    });
  });

const frameFor = async (input: Readonly<{readonly text?: string; readonly bytes?: number}>): Promise<Buffer> => {
  const plain = input.bytes === undefined ? Buffer.from(input.text ?? '', 'utf8') : Buffer.alloc(input.bytes, 0x61);
  return encodeServerFrame(await deflateMessage(plain), true);
};

const fragmentedFrameFor = async (bytes: number): Promise<Buffer> => {
  const compressed = await deflateMessage(Buffer.alloc(bytes, 0x61));
  const splitAt = Math.ceil(compressed.length / 2);
  return Buffer.concat([
    encodeServerFrame(compressed.subarray(0, splitAt), true, false, 0x01),
    encodeServerFrame(compressed.subarray(splitAt), false, true, 0x00),
  ]);
};

const waitForOpen = (socket: WebSocket): Promise<void> =>
  new Promise((resolve, reject) => {
    const onOpen = (): void => {
      socket.removeEventListener('error', onError);
      resolve();
    };
    const onError = (event: Event): void => {
      socket.removeEventListener('open', onOpen);
      const errorEvent = event as ErrorEvent;
      reject(new Error(`UNDICI_TEST_WEBSOCKET_OPEN_FAILED:${event.type}:${errorEvent.message}`));
    };
    socket.addEventListener('open', onOpen, {once: true});
    socket.addEventListener('error', onError, {once: true});
  });

const waitForMessage = (socket: WebSocket): Promise<string> =>
  new Promise((resolve, reject) => {
    const onMessage = (event: Event): void => {
      socket.removeEventListener('error', onError);
      const data = (event as Event & {readonly data: unknown}).data;
      if (typeof data !== 'string') reject(new Error('UNDICI_TEST_EXPECTED_TEXT_MESSAGE'));
      else resolve(data);
    };
    const onError = (event: Event): void => {
      socket.removeEventListener('message', onMessage);
      reject(new Error(`UNDICI_TEST_WEBSOCKET_MESSAGE_FAILED:${event.type}`));
    };
    socket.addEventListener('message', onMessage, {once: true});
    socket.addEventListener('error', onError, {once: true});
  });

const waitForClose = (socket: WebSocket): Promise<CloseEvent> =>
  new Promise(resolve => socket.addEventListener('close', event => resolve(event as CloseEvent), {once: true}));

const closeCleanly = async (socket: WebSocket): Promise<void> => {
  const closed = waitForClose(socket);
  socket.close();
  const event = await closed;
  if (!event.wasClean) throw new Error('UNDICI_TEST_WEBSOCKET_CLOSE_UNCLEAN');
};

const createTunnelProxy = (
  options: Readonly<{
    readonly token?: string;
    readonly requests: string[];
    readonly socketErrors: SocketErrorObservation[];
  }>,
): Server => {
  const proxy = createServer((_request, response) => response.writeHead(405).end());
  let connectionNumber = 0;
  proxy.on('connection', socket => {
    connectionNumber += 1;
    observeSocketErrors(socket, 'proxy', connectionNumber, options.socketErrors);
  });
  proxy.on('connect', (request, clientSocket, head) => {
    options.requests.push(`CONNECT ${String(request.url)}`);
    if (options.token !== undefined && request.headers['proxy-authorization'] !== options.token) {
      clientSocket.end('HTTP/1.1 407 Proxy Authentication Required\r\nConnection: close\r\n\r\n');
      return;
    }
    const separator = String(request.url).lastIndexOf(':');
    const hostname = String(request.url).slice(0, separator);
    const port = Number(String(request.url).slice(separator + 1));
    if (!hostname || !Number.isInteger(port) || port < 1 || port > 65_535) {
      clientSocket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      return;
    }
    const upstream = connect(port, hostname);
    upstream.once('connect', () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length > 0) upstream.write(head);
      upstream.pipe(clientSocket).pipe(upstream);
    });
    upstream.once('error', () => clientSocket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n'));
  });
  liveServers.push(proxy);
  return proxy;
};

const withCleanup = async (
  scenario: string,
  callback: (socketErrors: SocketErrorObservation[]) => Promise<void>,
): Promise<void> => {
  const socketErrors: SocketErrorObservation[] = [];
  try {
    await callback(socketErrors);
  } finally {
    await Promise.all(liveDispatchers.splice(0).map(dispatcher => dispatcher.close()));
    await Promise.all(liveServers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  }
  const isExpectedReset = (observation: SocketErrorObservation): boolean => {
    if (observation.code !== 'ECONNRESET') return false;
    if (scenario === 'compressed-bound') {
      return (
        (observation.server === 'origin' && [2, 4, 6].includes(observation.connection)) ||
        (observation.server === 'proxy' && observation.connection === 2)
      );
    }
    return scenario === 'proxy-auth-rejection' && observation.server === 'proxy' && observation.connection === 1;
  };
  console.error(`UNDICI_TEST_SOCKET_DIAGNOSTICS ${JSON.stringify({scenario, socketErrors})}`);
  const unexpected = socketErrors.filter(observation => !isExpectedReset(observation));
  if (unexpected.length > 0) throw new Error(`UNDICI_TEST_UNEXPECTED_SOCKET_ERRORS:${JSON.stringify(unexpected)}`);
};

const boundedWebSocketAgent = (): Agent => {
  const dispatcher = new Agent({webSocket: {maxPayloadSize, maxFragments}});
  liveDispatchers.push(dispatcher);
  return dispatcher;
};

describe('terminal Node network injection with Undici 8.11.2', () => {
  it('uses per-service proxy dispatchers, preserves proxy auth at the proxy, and keeps credentials off the origin', async () => {
    await withCleanup('proxy-isolation', async socketErrors => {
      const observedOriginHeaders: Array<Record<string, string | string[] | undefined>> = [];
      const origin = createOriginServer((socket, request) => {
        observedOriginHeaders.push(request.headers);
        acceptWebSocket(socket, request, {text: 'ready'});
      }, socketErrors);
      const originUrl = await listen(origin);
      const proxyOneRequests: string[] = [];
      const proxyTwoRequests: string[] = [];
      const tokenOne = `Basic ${Buffer.from('service-one:secret-one').toString('base64')}`;
      const tokenTwo = `Basic ${Buffer.from('service-two:secret-two').toString('base64')}`;
      const proxyOne = await listen(createTunnelProxy({token: tokenOne, requests: proxyOneRequests, socketErrors}));
      const proxyTwo = await listen(createTunnelProxy({token: tokenTwo, requests: proxyTwoRequests, socketErrors}));
      const agentOne = new ProxyAgent({
        uri: proxyOne,
        token: tokenOne,
        proxyTunnel: true,
        webSocket: {maxPayloadSize, maxFragments},
      });
      const agentTwo = new ProxyAgent({
        uri: proxyTwo,
        token: tokenTwo,
        proxyTunnel: true,
        webSocket: {maxPayloadSize, maxFragments},
      });
      liveDispatchers.push(agentOne, agentTwo);
      const directAgent = boundedWebSocketAgent();

      const connect = async (dispatcher: Agent | ProxyAgent): Promise<void> => {
        const socket = new WebSocket(originUrl.replace(/^http:/, 'ws:'), {dispatcher});
        await waitForOpen(socket);
        expect(await waitForMessage(socket)).toBe('ready');
        await closeCleanly(socket);
      };
      await connect(agentOne);
      await connect(agentTwo);
      await connect(directAgent);

      expect(proxyOneRequests).toHaveLength(1);
      expect(proxyTwoRequests).toHaveLength(1);
      const originAddress = new URL(originUrl);
      expect(proxyOneRequests[0]).toContain(`${originAddress.hostname}:${originAddress.port}`);
      expect(proxyTwoRequests[0]).toContain(`${originAddress.hostname}:${originAddress.port}`);
      expect(observedOriginHeaders).toHaveLength(3);
      expect(observedOriginHeaders.every(headers => headers['proxy-authorization'] === undefined)).toBe(true);
    });
  });

  it('accepts the exact compressed bound and closes without delivering an oversized message on direct and tunneled proxy dispatchers', async () => {
    await withCleanup('compressed-bound', async socketErrors => {
      const exact = await frameFor({bytes: maxPayloadSize});
      const overflow = await frameFor({bytes: maxPayloadSize + 1});
      const fragmentedExact = await fragmentedFrameFor(maxPayloadSize);
      const fragmentedOverflow = await fragmentedFrameFor(maxPayloadSize + 1);
      expect(overflow.length).toBeLessThan(126);
      const frames = [exact, overflow, fragmentedExact, fragmentedOverflow, exact, overflow];
      let connectionNumber = 0;
      const origin = createOriginServer((socket, request) => {
        const frame = frames[connectionNumber];
        if (frame === undefined) throw new Error('UNDICI_TEST_FRAME_SEQUENCE_EXHAUSTED');
        connectionNumber += 1;
        acceptWebSocket(socket, request, {});
        socket.write(frame);
      }, socketErrors);
      const url = (await listen(origin)).replace(/^http:/, 'ws:');
      const dispatcher = boundedWebSocketAgent();
      const proxyRequests: string[] = [];
      const proxyUrl = await listen(createTunnelProxy({requests: proxyRequests, socketErrors}));
      const proxyDispatcher = new ProxyAgent({
        uri: proxyUrl,
        proxyTunnel: true,
        webSocket: {maxPayloadSize, maxFragments},
      });
      liveDispatchers.push(proxyDispatcher);

      const accepted = new WebSocket(url, {dispatcher});
      await waitForOpen(accepted);
      const message = await waitForMessage(accepted);
      expect(Buffer.byteLength(message, 'utf8')).toBe(maxPayloadSize);
      await closeCleanly(accepted);

      const directOversized = new WebSocket(url, {dispatcher});
      let directOverflowDelivered = false;
      directOversized.addEventListener('message', () => {
        directOverflowDelivered = true;
      });
      await waitForOpen(directOversized);
      await waitForClose(directOversized);
      expect(directOversized.readyState).toBe(WebSocket.CLOSED);
      expect(directOverflowDelivered).toBe(false);

      const directFragmentedExact = new WebSocket(url, {dispatcher});
      await waitForOpen(directFragmentedExact);
      expect(Buffer.byteLength(await waitForMessage(directFragmentedExact), 'utf8')).toBe(maxPayloadSize);
      await closeCleanly(directFragmentedExact);

      const directFragmentedOversized = new WebSocket(url, {dispatcher});
      let directFragmentedOverflowDelivered = false;
      directFragmentedOversized.addEventListener('message', () => {
        directFragmentedOverflowDelivered = true;
      });
      await waitForOpen(directFragmentedOversized);
      await waitForClose(directFragmentedOversized);
      expect(directFragmentedOversized.readyState).toBe(WebSocket.CLOSED);
      expect(directFragmentedOverflowDelivered).toBe(false);

      const proxiedExact = new WebSocket(url, {dispatcher: proxyDispatcher});
      await waitForOpen(proxiedExact);
      expect(Buffer.byteLength(await waitForMessage(proxiedExact), 'utf8')).toBe(maxPayloadSize);
      await closeCleanly(proxiedExact);

      const proxiedOversized = new WebSocket(url, {dispatcher: proxyDispatcher});
      let proxyOverflowDelivered = false;
      proxiedOversized.addEventListener('message', () => {
        proxyOverflowDelivered = true;
      });
      await waitForOpen(proxiedOversized);
      await waitForClose(proxiedOversized);
      expect(proxiedOversized.readyState).toBe(WebSocket.CLOSED);
      expect(proxyOverflowDelivered).toBe(false);
      expect(proxyRequests).toHaveLength(2);
    });
  });

  it('fails the WebSocket handshake when a proxy requires credentials and none are configured', async () => {
    await withCleanup('proxy-auth-rejection', async socketErrors => {
      const origin = createOriginServer(
        (socket, request) => acceptWebSocket(socket, request, {text: 'unexpected-origin-reach'}),
        socketErrors,
      );
      const originUrl = (await listen(origin)).replace(/^http:/, 'ws:');
      const requests: string[] = [];
      const proxy = await listen(createTunnelProxy({token: 'Basic expected', requests, socketErrors}));
      const dispatcher = new ProxyAgent({uri: proxy, proxyTunnel: true, webSocket: {maxPayloadSize, maxFragments}});
      liveDispatchers.push(dispatcher);
      const socket = new WebSocket(originUrl, {dispatcher});
      const closed = waitForClose(socket);
      await expect(waitForOpen(socket)).rejects.toThrow('UNDICI_TEST_WEBSOCKET_OPEN_FAILED');
      await closed;
      expect(requests).toHaveLength(1);
    });
  });
});
