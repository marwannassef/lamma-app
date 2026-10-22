// The Transport on real phones: the local LammaNet module (TCP + Bonjour/NSD), see
// modules/lamma-net. Needs a development or store build; Expo Go doesn't include it.
import LammaNet, { type Room } from '../../../modules/lamma-net';

import type { Client, ClientHandlers, Peer, ServerHandlers, Transport } from './transport';
import { DEFAULT_PORT } from './transport';

const clients = new Map<string, ClientHandlers>();
const serverConns = new Set<string>();
let server: ServerHandlers | null = null;
/** Messages for a connection whose `connect()` hasn't resolved yet, or that already closed. */
const early = new Map<string, string[] | 'closed'>();

LammaNet.addListener('onOpen', ({ connId }) => {
  const peer: Peer = {
    id: connId,
    send: (text) => LammaNet.send(connId, text),
    close: () => LammaNet.close(connId),
  };
  serverConns.add(connId);
  server?.onOpen(peer);
});

LammaNet.addListener('onMessage', ({ connId, text }) => {
  const client = clients.get(connId);
  if (client) return client.onMessage(text);
  if (serverConns.has(connId)) return server?.onMessage(connId, text);
  const queued = early.get(connId);
  if (queued !== 'closed') early.set(connId, [...(queued ?? []), text]);
});

LammaNet.addListener('onClose', ({ connId }) => {
  const client = clients.get(connId);
  if (client) {
    clients.delete(connId);
    return client.onClose();
  }
  if (serverConns.delete(connId)) return server?.onClose(connId);
  early.set(connId, 'closed');
});

/**
 * A transport whose server advertises itself as `roomName` (shown in other phones' "nearby
 * games" list).
 */
export function nativeTransport(roomName: string): Transport {
  return {
    async listen(handlers: ServerHandlers, port = DEFAULT_PORT) {
      server = handlers;
      const actual = await LammaNet.startServer(port, roomName);
      const ip = LammaNet.localAddresses()[0] ?? '';
      return {
        address: ip ? `${ip}:${actual}` : '',
        close() {
          server = null;
          void LammaNet.stopServer();
        },
      };
    },

    async connect(address: string, handlers: ClientHandlers): Promise<Client> {
      const { connId, remote } = await LammaNet.connect(address);
      // Anything that happened before we knew this connection was ours.
      const queued = early.get(connId);
      early.delete(connId);
      if (queued === 'closed') {
        setTimeout(handlers.onClose, 0);
      } else {
        clients.set(connId, handlers);
        // After the caller has the Client in hand.
        if (queued) setTimeout(() => queued.forEach(handlers.onMessage), 0);
      }
      return {
        remote,
        send: (text) => LammaNet.send(connId, text),
        close: () => LammaNet.close(connId),
      };
    },
  };
}

/** Lists games advertised nearby while subscribed. Returns a stop function. */
export function browseRooms(onChange: (rooms: Room[]) => void): () => void {
  const rooms = new Map<string, Room>();
  const emit = () => onChange([...rooms.values()].sort((a, b) => a.name.localeCompare(b.name)));
  const found = LammaNet.addListener('onRoomFound', (room) => {
    rooms.set(room.id, room);
    emit();
  });
  const lost = LammaNet.addListener('onRoomLost', ({ id }) => {
    if (rooms.delete(id)) emit();
  });
  void LammaNet.startBrowsing();
  return () => {
    found.remove();
    lost.remove();
    void LammaNet.stopBrowsing();
  };
}

/** This phone's address on the local network, or null when it isn't on Wi-Fi or a hotspot. */
export const localAddress = () => LammaNet.localAddresses()[0] ?? null;

export type { Room };
