import type { Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

export function attachChatServer(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/realtime/chat' });

  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'system', message: 'Connected to Fidelity chat' }));

    socket.on('message', (raw) => {
      const text = String(raw);
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'chat', message: text }));
        }
      }
    });
  });

  return wss;
}
