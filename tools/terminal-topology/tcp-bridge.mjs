import net from 'node:net'

export const createTcpBridge = ({listenHost = '127.0.0.1', listenPort, targetHost = '127.0.0.1', targetPort}) => {
  let server = null
  let accepting = false
  const connections = new Set()

  const destroyPair = pair => {
    pair.client.destroy()
    pair.upstream?.destroy()
  }

  const removeIfClosed = pair => {
    if (pair.clientClosed && (pair.upstream === null || pair.upstreamClosed)) connections.delete(pair)
  }

  return {
    async listen() {
      if (server !== null) throw new Error('topology TCP bridge is already listening')
      server = net.createServer(client => {
        const pair = {client, upstream: null, clientClosed: false, upstreamClosed: false}
        connections.add(pair)
        client.once('close', () => {
          pair.clientClosed = true
          if (pair.upstream !== null && !pair.upstream.destroyed) pair.upstream.destroy()
          removeIfClosed(pair)
        })
        client.once('end', () => {
          if (pair.upstream !== null && !pair.upstream.destroyed) pair.upstream.destroy()
        })
        client.on('error', () => destroyPair(pair))
        if (!accepting) {
          client.destroy()
          return
        }
        const upstream = net.connect({host: targetHost, port: targetPort})
        pair.upstream = upstream
        upstream.once('connect', () => {
          if (!accepting) {
            destroyPair(pair)
            return
          }
          client.pipe(upstream)
          upstream.pipe(client)
        })
        upstream.on('error', () => client.destroy())
        upstream.once('end', () => {
          if (!client.destroyed) client.destroy()
        })
        upstream.once('close', () => {
          pair.upstreamClosed = true
          if (!client.destroyed) client.destroy()
          removeIfClosed(pair)
        })
      })
      await new Promise((resolve, reject) => {
        const onError = error => {
          server?.off('listening', onListening)
          reject(error)
        }
        const onListening = () => {
          server?.off('error', onError)
          accepting = true
          resolve()
        }
        server.once('error', onError)
        server.once('listening', onListening)
        server.listen(listenPort, listenHost)
      })
      const address = server.address()
      if (address === null || typeof address === 'string') throw new Error('topology TCP bridge did not bind a TCP address')
      return {host: address.address, port: address.port}
    },
    pause() {
      if (server === null || !server.listening) throw new Error('topology TCP bridge is not listening')
      accepting = false
      const closedConnections = connections.size
      for (const pair of connections) destroyPair(pair)
      return closedConnections
    },
    resume() {
      if (server === null || !server.listening) throw new Error('topology TCP bridge is not listening')
      accepting = true
    },
    async close() {
      if (server === null) return
      accepting = false
      for (const pair of connections) destroyPair(pair)
      const current = server
      server = null
      if (!current.listening) return
      await new Promise((resolve, reject) => current.close(error => error ? reject(error) : resolve()))
      connections.clear()
    },
    get activeConnections() {
      return connections.size
    },
    get isAccepting() {
      return accepting
    },
  }
}
