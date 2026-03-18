import type { Env } from '../types';

/**
 * ES Module Default Export - Worker Entry Point
 * Handles incoming requests and routes to Durable Object instances
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Route all requests to the MarketFeedRoom Durable Object
    const id = env.MARKET_FEED_ROOM.idFromName('global_market_feed');
    const stub = env.MARKET_FEED_ROOM.get(id);
    return stub.fetch(request);
  }
};

/**
 * MarketFeedRoom Durable Object
 * Manages WebSocket connections for real-time market feed updates
 */
export class MarketFeedRoom {
  state: DurableObjectState;
  env: Env;
  sessions: Set<WebSocket>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    // Provide a simple broadcast endpoint allowing the API to send updates to all connected clients
    if (request.method === "POST" && url.pathname === "/broadcast") {
      const payload = await request.text();
      const failedSessions: WebSocket[] = [];

      for (const session of this.sessions) {
        try {
          session.send(payload);
        } catch (err) {
          console.error('[MarketFeedRoom] Failed to send to session:', err);
          failedSessions.push(session);
        }
      }

      // Clean up failed sessions
      for (const failed of failedSessions) {
        this.sessions.delete(failed);
        try {
          failed.close(1011, 'Send failed');
        } catch (e) {
          // Ignore close errors
        }
      }

      return new Response(JSON.stringify({
        broadcasted: true,
        recipients: this.sessions.size,
        failed: failedSessions.length
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle WebSocket upgrade requests
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.state.acceptWebSocket(server);
      this.sessions.add(server);

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    // Basic ping-pong keep-alive logic could go here
    if (message === "PING") {
      ws.send("PONG");
    }
  }

  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    this.sessions.delete(ws);
  }

  webSocketError(ws: WebSocket, error: unknown) {
    this.sessions.delete(ws);
  }
}
