import ExpoModulesCore
import Network

private let serviceType = "_lamma._tcp"
/** A peer that never sends a newline can't make us buffer forever. */
private let maxBuffered = 1_000_000

/**
 * Local-network game connections (docs/games/werewolf-network.md §4): a TCP server that
 * advertises itself with Bonjour, TCP clients, and a Bonjour browser. Messages are UTF-8 lines.
 * All state lives on `queue`.
 */
public class LammaNetModule: Module {
  private let queue = DispatchQueue(label: "com.anventureslabs.lamma.net")
  private var listener: NWListener?
  private var browser: NWBrowser?
  private var conns: [String: NWConnection] = [:]
  private var buffers: [String: Data] = [:]
  private var rooms: [String: NWEndpoint] = [:]
  private var nextId = 0

  public func definition() -> ModuleDefinition {
    Name("LammaNet")

    Events("onOpen", "onMessage", "onClose", "onRoomFound", "onRoomLost")

    AsyncFunction("startServer") { (port: Int, name: String, promise: Promise) in
      self.queue.async { self.listen(port: port, name: name, promise: promise) }
    }

    AsyncFunction("stopServer") { (promise: Promise) in
      self.queue.async {
        self.listener?.cancel()
        self.listener = nil
        promise.resolve(nil)
      }
    }

    AsyncFunction("connect") { (address: String, promise: Promise) in
      self.queue.async { self.dial(address, promise: promise) }
    }

    Function("send") { (connId: String, text: String) in
      self.queue.async {
        guard let c = self.conns[connId], let data = (text + "\n").data(using: .utf8) else { return }
        c.send(content: data, completion: .contentProcessed { error in
          if error != nil { self.queue.async { self.drop(connId) } }
        })
      }
    }

    Function("close") { (connId: String) in
      self.queue.async {
        // Send what's queued, then end the stream, then cancel.
        guard let c = self.conns[connId] else { return }
        c.send(content: nil, contentContext: .finalMessage, isComplete: true, completion: .contentProcessed { _ in
          c.cancel()
        })
      }
    }

    AsyncFunction("startBrowsing") { (promise: Promise) in
      self.queue.async {
        self.browser?.cancel()
        self.rooms = [:]
        let b = NWBrowser(for: .bonjour(type: serviceType, domain: nil), using: .tcp)
        b.browseResultsChangedHandler = { _, changes in
          for change in changes {
            switch change {
            case .added(let r): self.found(r.endpoint)
            case .removed(let r): self.lost(r.endpoint)
            case .changed(let old, let new, _):
              self.lost(old.endpoint)
              self.found(new.endpoint)
            default: break
            }
          }
        }
        b.start(queue: self.queue)
        self.browser = b
        promise.resolve(nil)
      }
    }

    AsyncFunction("stopBrowsing") { (promise: Promise) in
      self.queue.async {
        self.browser?.cancel()
        self.browser = nil
        self.rooms = [:]
        promise.resolve(nil)
      }
    }

    Function("localAddresses") { () -> [String] in
      return localIPv4Addresses()
    }

    OnDestroy {
      self.queue.async {
        self.listener?.cancel()
        self.browser?.cancel()
        self.conns.values.forEach { $0.cancel() }
        self.conns = [:]
      }
    }
  }

  // MARK: - server

  private func listen(port: Int, name: String, promise: Promise) {
    listener?.cancel()
    listener = nil
    guard let p = NWEndpoint.Port(rawValue: UInt16(clamping: port)) else {
      return promise.reject("ERR_LISTEN", "Bad port \(port)")
    }
    let params = NWParameters.tcp
    params.allowLocalEndpointReuse = true
    let l: NWListener
    do {
      l = try NWListener(using: params, on: p)
    } catch {
      return promise.reject("ERR_LISTEN", error.localizedDescription)
    }
    l.service = NWListener.Service(name: name, type: serviceType)
    var settled = false
    l.stateUpdateHandler = { state in
      switch state {
      case .ready where !settled:
        settled = true
        promise.resolve(Int(l.port?.rawValue ?? p.rawValue))
      case .failed(let error) where !settled:
        settled = true
        promise.reject("ERR_LISTEN", error.localizedDescription)
      default: break
      }
    }
    l.newConnectionHandler = { c in
      let id = self.makeId()
      self.start(c, id: id, onReady: { self.sendEvent("onOpen", ["connId": id]) }, onFail: { _ in })
    }
    l.start(queue: queue)
    listener = l
  }

  // MARK: - client

  private func dial(_ address: String, promise: Promise) {
    guard let endpoint = endpoint(for: address) else {
      return promise.reject("ERR_ADDRESS", "Can't read address \(address)")
    }
    let id = makeId()
    let c = NWConnection(to: endpoint, using: .tcp)
    start(c, id: id, onReady: {
      // The resolved address, so a reconnect doesn't depend on Bonjour.
      var remote = address
      if case let .hostPort(host, port)? = c.currentPath?.remoteEndpoint {
        remote = "\(host):\(port)"
      }
      promise.resolve(["connId": id, "remote": remote])
    }, onFail: { promise.reject("ERR_CONNECT", $0) })
  }

  private func endpoint(for address: String) -> NWEndpoint? {
    if address.hasPrefix("svc:") { return rooms[String(address.dropFirst(4))] }
    guard let colon = address.lastIndex(of: ":"),
          let port = NWEndpoint.Port(String(address[address.index(after: colon)...])) else { return nil }
    let host = address[..<colon].trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
    return host.isEmpty ? nil : .hostPort(host: NWEndpoint.Host(host), port: port)
  }

  // MARK: - connections

  private func makeId() -> String {
    nextId += 1
    return "c\(nextId)"
  }

  /** Tracks a connection, reads lines from it, and reports when it ends. */
  private func start(
    _ c: NWConnection, id: String, onReady: @escaping () -> Void, onFail: @escaping (String) -> Void
  ) {
    conns[id] = c
    buffers[id] = Data()
    var ready = false
    var failed = false
    let fail = { (reason: String) in
      if !ready && !failed {
        failed = true
        onFail(reason)
      }
    }
    c.stateUpdateHandler = { state in
      switch state {
      case .ready:
        if !ready && !failed {
          ready = true
          onReady()
        }
      case .waiting(let error):
        // Nothing is listening there (yet): report it now instead of waiting forever.
        fail(error.localizedDescription)
        c.cancel()
      case .failed(let error):
        fail(error.localizedDescription)
        self.drop(id)
      case .cancelled:
        fail("cancelled")
        self.drop(id)
      default: break
      }
    }
    receive(c, id: id)
    c.start(queue: queue)
  }

  private func receive(_ c: NWConnection, id: String) {
    c.receive(minimumIncompleteLength: 1, maximumLength: 65536) { data, _, isComplete, error in
      if let data, !data.isEmpty {
        var buf = (self.buffers[id] ?? Data()) + data
        while let nl = buf.firstIndex(of: 0x0A) {
          let line = buf.subdata(in: buf.startIndex..<nl)
          buf = buf.subdata(in: buf.index(after: nl)..<buf.endIndex)
          if let text = String(data: line, encoding: .utf8) {
            self.sendEvent("onMessage", ["connId": id, "text": text])
          }
        }
        if buf.count > maxBuffered { return self.drop(id) }
        self.buffers[id] = buf
      }
      if isComplete || error != nil { return self.drop(id) }
      self.receive(c, id: id)
    }
  }

  /** Forgets a connection and tells JS once. */
  private func drop(_ id: String) {
    guard let c = conns.removeValue(forKey: id) else { return }
    buffers.removeValue(forKey: id)
    c.cancel()
    sendEvent("onClose", ["connId": id])
  }

  // MARK: - browsing

  private func roomId(_ endpoint: NWEndpoint) -> (id: String, name: String)? {
    guard case let .service(name, type, domain, _) = endpoint else { return nil }
    return ("\(name).\(type)\(domain)", name)
  }

  private func found(_ endpoint: NWEndpoint) {
    guard let room = roomId(endpoint) else { return }
    rooms[room.id] = endpoint
    sendEvent("onRoomFound", ["id": room.id, "name": room.name, "address": "svc:\(room.id)"])
  }

  private func lost(_ endpoint: NWEndpoint) {
    guard let room = roomId(endpoint) else { return }
    rooms.removeValue(forKey: room.id)
    sendEvent("onRoomLost", ["id": room.id])
  }
}

/**
 * This phone's IPv4 addresses on local networks: Wi-Fi (en*) and its own hotspot (bridge*),
 * Wi-Fi first. Cellular (pdp_ip*) and loopback are skipped: nobody can join through those.
 */
func localIPv4Addresses() -> [String] {
  var found: [(rank: Int, ip: String)] = []
  var ifaddr: UnsafeMutablePointer<ifaddrs>?
  guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return [] }
  defer { freeifaddrs(ifaddr) }
  for ptr in sequence(first: first, next: { $0.pointee.ifa_next }) {
    let ifa = ptr.pointee
    guard let addr = ifa.ifa_addr, addr.pointee.sa_family == UInt8(AF_INET),
          (ifa.ifa_flags & UInt32(IFF_UP)) != 0, (ifa.ifa_flags & UInt32(IFF_LOOPBACK)) == 0 else { continue }
    let name = String(cString: ifa.ifa_name)
    let rank = name.hasPrefix("en") ? 0 : name.hasPrefix("bridge") ? 1 : -1
    guard rank >= 0 else { continue }
    var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
    if getnameinfo(addr, socklen_t(addr.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 {
      found.append((rank, String(cString: host)))
    }
  }
  return found.sorted { $0.rank < $1.rank }.map { $0.ip }
}
