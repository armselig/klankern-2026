import type { BrowserContext, WebSocketRoute } from '@playwright/test'

// Shared by the e2e specs that need to cut or watch the Realtime connection.

const REALTIME_SOCKET = /\/realtime\/v1\/websocket/

/**
 * Proxies a context's Realtime websocket so the test can cut it. Chrome's
 * offline emulation (`context.setOffline`) does not close an already open
 * websocket, so a network drop is simulated here instead: `goOffline` closes
 * the open connection and refuses reconnects until `goOnline`. Frames are
 * recorded both ways: sent ones to check what the app tells the server,
 * received ones to know when a change has reached the app. `holdReceivedFrames`
 * delays chosen frames from the server, to deliver them out of order the way
 * Realtime itself sometimes does.
 */
export async function controlRealtimeSocket(context: BrowserContext) {
  let offline = false
  const openSockets = new Set<WebSocketRoute>()
  const sentFrames: string[] = []
  const receivedFrames: string[] = []
  const holds = new Set<{ matches: (frame: string) => boolean; deliveries: (() => void)[] }>()

  await context.routeWebSocket(REALTIME_SOCKET, (socket) => {
    if (offline) {
      void socket.close({ code: 1006, reason: 'e2e offline' })
      return
    }
    const server = socket.connectToServer()
    openSockets.add(socket)
    socket.onMessage((message) => {
      sentFrames.push(message.toString())
      server.send(message)
    })
    server.onMessage((message) => {
      const frame = message.toString()
      receivedFrames.push(frame)
      const hold = [...holds].find((candidate) => candidate.matches(frame))
      if (hold) hold.deliveries.push(() => socket.send(message))
      else socket.send(message)
    })
    socket.onClose(() => openSockets.delete(socket))
  })

  return {
    sentFrames,
    receivedFrames,
    goOffline() {
      offline = true
      for (const socket of openSockets) void socket.close({ code: 1006, reason: 'e2e offline' })
      openSockets.clear()
    },
    goOnline() {
      offline = false
    },
    /**
     * Keeps matching frames from the server away from the app until the
     * returned function is called, which delivers them in their original
     * order. Held frames still show up in `receivedFrames` right away.
     */
    holdReceivedFrames(matches: (frame: string) => boolean) {
      const hold = { matches, deliveries: [] as (() => void)[] }
      holds.add(hold)
      return () => {
        holds.delete(hold)
        for (const deliver of hold.deliveries) deliver()
      }
    },
  }
}
