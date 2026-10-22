import {
  DEFAULT_PORT,
  type Client,
  type ClientHandlers,
  type Server,
  type ServerHandlers,
  type Transport,
} from './transport';

/**
 * An in-memory network for tests: messages wait in a queue until `flush()`, so tests control
 * delivery order the way a real network might reorder it across phones.
 */
export function createFakeNetwork() {
  const servers = new Map<string, ServerHandlers>();
  const queue: (() => void)[] = [];
  const links = new Map<string, { client: ClientHandlers; address: string; open: boolean }>();
  let nextPeer = 0;

  const closeLink = (peerId: string) => {
    const link = links.get(peerId);
    if (!link?.open) return;
    link.open = false;
    queue.push(() => servers.get(link.address)?.onClose(peerId));
    queue.push(() => link.client.onClose());
  };

  const transport: Transport = {
    async listen(handlers, port = DEFAULT_PORT): Promise<Server> {
      const address = `10.0.0.1:${port}`;
      if (servers.has(address)) throw new Error(`${address} is in use`);
      servers.set(address, handlers);
      return {
        address,
        close() {
          servers.delete(address);
          for (const [id, link] of links) if (link.address === address) closeLink(id);
        },
      };
    },
    async connect(address, client): Promise<Client> {
      const server = servers.get(address);
      if (!server) throw new Error(`Nothing listening at ${address}`);
      const peerId = `peer-${++nextPeer}`;
      const link = { client, address, open: true };
      links.set(peerId, link);
      server.onOpen({
        id: peerId,
        send: (text) => {
          // Like TCP, what was sent before a close still arrives.
          if (link.open) queue.push(() => client.onMessage(text));
        },
        close: () => closeLink(peerId),
      });
      return {
        send: (text) => {
          if (link.open) queue.push(() => servers.get(address)?.onMessage(peerId, text));
        },
        close: () => closeLink(peerId),
      };
    },
  };

  return {
    transport,
    /** Delivers every queued message, including replies sent while delivering. */
    flush() {
      for (let i = 0; i < 10_000 && queue.length > 0; i++) queue.shift()?.();
    },
    /** Drops one connection as if the phone lost Wi-Fi. */
    drop(peerId: string) {
      closeLink(peerId);
    },
    /** Ids of the connections still open. */
    openPeers: () => [...links].filter(([, l]) => l.open).map(([id]) => id),
  };
}

export type FakeNetwork = ReturnType<typeof createFakeNetwork>;
