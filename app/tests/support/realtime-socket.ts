import type { BrowserContext, WebSocketRoute } from '@playwright/test'

// Shared by the e2e specs that need to cut or watch the Realtime connection.

const REALTIME_SOCKET = /\/realtime\/v1\/websocket/

/**
 * Proxies a context's Realtime websocket so the test can cut it. Chrome's
 * offline emulation (`context.setOffline`) does not close an already open
 * websocket, so a network drop is simulated here instead: `goOffline` closes
 * the open connection and refuses reconnects until `goOnline`. Frames are
 * recorded both ways: sent ones to check what the app tells the server,
 * received ones to know when a change has reached the app.
 */
export async function controlRealtimeSocket(context: BrowserContext) {
  let offline = false
  const openSockets = new Set<WebSocketRoute>()
  const sentFrames: string[] = []
  const receivedFrames: string[] = []

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
      receivedFrames.push(message.toString())
      socket.send(message)
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
  }
}
