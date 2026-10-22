// A local-network message channel between one host phone and its guests
// (docs/games/werewolf-network.md §4). Messages are whole strings: the TCP implementation
// frames them as lines, the in-memory one used in tests just hands them over.

/** One guest's connection, as the host sees it. */
export interface Peer {
  /** Unique per connection; a guest who reconnects gets a new one. */
  id: string;
  send(text: string): void;
  close(): void;
}

export interface ServerHandlers {
  onOpen(peer: Peer): void;
  onMessage(peerId: string, text: string): void;
  onClose(peerId: string): void;
}

export interface Server {
  /** Where guests can reach this host (shown as a room code). */
  address: string;
  close(): void;
}

export interface ClientHandlers {
  onMessage(text: string): void;
  /** The connection ended or never opened. */
  onClose(): void;
}

export interface Client {
  /** The host's resolved address, when the transport knows it (reconnect there next time). */
  remote?: string;
  send(text: string): void;
  close(): void;
}

/** The port a host listens on, so a relaunched host is found at the same address. */
export const DEFAULT_PORT = 47777;

export interface Transport {
  listen(handlers: ServerHandlers, port?: number): Promise<Server>;
  connect(address: string, handlers: ClientHandlers): Promise<Client>;
}
