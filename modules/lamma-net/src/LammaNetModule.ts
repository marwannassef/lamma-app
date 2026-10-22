import { NativeModule, requireNativeModule } from 'expo';

import type { LammaNetModuleEvents } from './LammaNet.types';

declare class LammaNetModule extends NativeModule<LammaNetModuleEvents> {
  /** Listens on `port` and advertises `_lamma._tcp` under `name`. Resolves with the port. */
  startServer(port: number, name: string): Promise<number>;
  stopServer(): Promise<void>;
  /**
   * "host:port" or a Room address. Resolves once connected, with the connection id and the
   * host's resolved "ip:port" (use it to reconnect without browsing again).
   */
  connect(address: string): Promise<{ connId: string; remote: string }>;
  /** Sends one message; a newline is added as the frame end. */
  send(connId: string, text: string): void;
  close(connId: string): void;
  /** This phone's local IPv4 addresses (Wi-Fi or its own hotspot), best first. */
  localAddresses(): string[];
  startBrowsing(): Promise<void>;
  stopBrowsing(): Promise<void>;
}

export default requireNativeModule<LammaNetModule>('LammaNet');
