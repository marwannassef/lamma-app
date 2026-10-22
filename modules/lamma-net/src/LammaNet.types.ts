/** A room another phone is advertising on the local network (Bonjour / NSD). */
export type Room = {
  /** Stable while the room is advertised. */
  id: string;
  /** The advertised name (the host's room name). */
  name: string;
  /** What to pass to `connect`. */
  address: string;
};

export type LammaNetModuleEvents = {
  /** Server side: a phone connected. */
  onOpen: (e: { connId: string }) => void;
  /** Either side: one whole message (line) arrived. */
  onMessage: (e: { connId: string; text: string }) => void;
  /** Either side: a connection ended. */
  onClose: (e: { connId: string }) => void;
  onRoomFound: (room: Room) => void;
  onRoomLost: (e: { id: string }) => void;
};
