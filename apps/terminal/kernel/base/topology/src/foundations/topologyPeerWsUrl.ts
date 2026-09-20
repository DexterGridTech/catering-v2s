export const topologyPeerWsUrl = (locator: Readonly<{readonly host: string; readonly port: number; readonly basePath: string}>): string =>
  `ws://${locator.host}:${locator.port}${locator.basePath}/ws`
