package expo.modules.lammanet

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.BufferedReader
import java.io.IOException
import java.io.InputStreamReader
import java.net.Inet4Address
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread

private const val SERVICE_TYPE = "_lamma._tcp"
private const val CONNECT_TIMEOUT_MS = 5000

/**
 * Local-network game connections (docs/games/werewolf-network.md §4): a TCP server advertised
 * with NSD (Bonjour), TCP clients, and an NSD browser. Messages are UTF-8 lines.
 */
class LammaNetModule : Module() {
  private class Conn(val socket: Socket, val writer: ExecutorService)

  private val conns = ConcurrentHashMap<String, Conn>()
  private val ids = AtomicInteger()
  @Volatile private var server: ServerSocket? = null
  private var registration: NsdManager.RegistrationListener? = null
  private var ownServiceName: String? = null
  private var discovery: NsdManager.DiscoveryListener? = null
  private val resolveQueue = Executors.newSingleThreadExecutor()
  /** Android 14+: one live info callback per found room, released when browsing stops. */
  private val infoCallbacks = ConcurrentHashMap<String, Any>()

  private val nsd: NsdManager
    get() = requireNotNull(appContext.reactContext).getSystemService(Context.NSD_SERVICE) as NsdManager

  override fun definition() = ModuleDefinition {
    Name("LammaNet")

    Events("onOpen", "onMessage", "onClose", "onRoomFound", "onRoomLost")

    AsyncFunction("startServer") { port: Int, name: String ->
      stopServer()
      val s = ServerSocket()
      s.reuseAddress = true
      try {
        s.bind(InetSocketAddress(port))
      } catch (e: IOException) {
        s.close()
        throw CodedException("ERR_LISTEN", e.message ?: "Can't listen on $port", e)
      }
      server = s
      thread(name = "lamma-accept", isDaemon = true) {
        try {
          while (!s.isClosed) {
            val socket = s.accept()
            adopt(socket) { id -> sendEvent("onOpen", mapOf("connId" to id)) }
          }
        } catch (_: IOException) {
          // Closed by stopServer.
        }
      }
      advertise(name, s.localPort)
      s.localPort
    }

    AsyncFunction("stopServer") { stopServer() }

    AsyncFunction("connect") { address: String ->
      val colon = address.lastIndexOf(':')
      val host = address.substring(0, maxOf(colon, 0)).trim('[', ']')
      val port = address.substring(colon + 1).toIntOrNull()
      if (colon <= 0 || host.isEmpty() || port == null) {
        throw CodedException("ERR_ADDRESS", "Can't read address $address", null)
      }
      val socket = Socket()
      try {
        socket.connect(InetSocketAddress(host, port), CONNECT_TIMEOUT_MS)
      } catch (e: IOException) {
        socket.close()
        throw CodedException("ERR_CONNECT", e.message ?: "Can't connect to $address", e)
      }
      val id = adopt(socket) {}
      mapOf("connId" to id, "remote" to "${socket.inetAddress.hostAddress}:${socket.port}")
    }

    Function("send") { connId: String, text: String ->
      val c = conns[connId] ?: return@Function
      c.writer.execute {
        try {
          c.socket.getOutputStream().apply {
            write((text + "\n").toByteArray(Charsets.UTF_8))
            flush()
          }
        } catch (_: IOException) {
          drop(connId)
        }
      }
    }

    Function("close") { connId: String ->
      val c = conns[connId] ?: return@Function
      // Runs after any queued sends, so they still go out; the reader then reports the close.
      c.writer.execute {
        try {
          c.socket.close()
        } catch (_: IOException) {
        }
      }
    }

    AsyncFunction("startBrowsing") { startBrowsing() }

    AsyncFunction("stopBrowsing") { stopBrowsing() }

    Function("localAddresses") { localIPv4Addresses() }

    OnDestroy {
      stopBrowsing()
      stopServer()
      conns.keys.forEach { drop(it) }
    }
  }

  // --- connections ---

  /** Tracks a socket and reads lines from it; `beforeRead` runs first (e.g. to announce it). */
  private fun adopt(socket: Socket, beforeRead: (String) -> Unit): String {
    val id = "c${ids.incrementAndGet()}"
    socket.tcpNoDelay = true
    conns[id] = Conn(socket, Executors.newSingleThreadExecutor())
    beforeRead(id)
    thread(name = "lamma-read-$id", isDaemon = true) {
      try {
        val reader = BufferedReader(InputStreamReader(socket.getInputStream(), Charsets.UTF_8))
        while (true) {
          val line = reader.readLine() ?: break
          sendEvent("onMessage", mapOf("connId" to id, "text" to line))
        }
      } catch (_: IOException) {
        // Dropped.
      } finally {
        drop(id)
      }
    }
    return id
  }

  /** Forgets a connection and tells JS once. */
  private fun drop(id: String) {
    val c = conns.remove(id) ?: return
    try {
      c.socket.close()
    } catch (_: IOException) {
    }
    c.writer.shutdown()
    sendEvent("onClose", mapOf("connId" to id))
  }

  private fun stopServer() {
    registration?.let { runCatching { nsd.unregisterService(it) } }
    registration = null
    ownServiceName = null
    server?.let { runCatching { it.close() } }
    server = null
  }

  // --- NSD (Bonjour) ---

  private fun advertise(name: String, port: Int) {
    val info = NsdServiceInfo().apply {
      serviceName = name
      serviceType = SERVICE_TYPE
      setPort(port)
    }
    val listener = object : NsdManager.RegistrationListener {
      override fun onServiceRegistered(info: NsdServiceInfo) {
        // NSD may rename it to avoid a clash; remember the real name to skip it when browsing.
        ownServiceName = info.serviceName
      }
      override fun onRegistrationFailed(info: NsdServiceInfo, errorCode: Int) {}
      override fun onServiceUnregistered(info: NsdServiceInfo) {}
      override fun onUnregistrationFailed(info: NsdServiceInfo, errorCode: Int) {}
    }
    registration = listener
    nsd.registerService(info, NsdManager.PROTOCOL_DNS_SD, listener)
  }

  private fun startBrowsing() {
    stopBrowsing()
    val listener = object : NsdManager.DiscoveryListener {
      override fun onDiscoveryStarted(serviceType: String) {}
      override fun onDiscoveryStopped(serviceType: String) {}
      override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {}
      override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
      override fun onServiceFound(info: NsdServiceInfo) {
        if (info.serviceName != ownServiceName) resolve(info)
      }
      override fun onServiceLost(info: NsdServiceInfo) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
          infoCallbacks.remove(info.serviceName)?.let {
            runCatching { nsd.unregisterServiceInfoCallback(it as NsdManager.ServiceInfoCallback) }
          }
        }
        sendEvent("onRoomLost", mapOf("id" to info.serviceName))
      }
    }
    discovery = listener
    nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
  }

  private fun stopBrowsing() {
    discovery?.let { runCatching { nsd.stopServiceDiscovery(it) } }
    discovery = null
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      infoCallbacks.values.forEach {
        runCatching { nsd.unregisterServiceInfoCallback(it as NsdManager.ServiceInfoCallback) }
      }
    }
    infoCallbacks.clear()
  }

  private fun found(info: NsdServiceInfo) {
    val addresses =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) info.hostAddresses
      else listOfNotNull(info.host)
    // Prefer IPv4: it works on every hotspot and is easy to type as a room code.
    val host = (addresses.firstOrNull { it is Inet4Address } ?: addresses.firstOrNull()) ?: return
    sendEvent(
      "onRoomFound",
      mapOf(
        "id" to info.serviceName,
        "name" to info.serviceName,
        "address" to "${host.hostAddress}:${info.port}",
      ),
    )
  }

  /** Older Android resolves one service at a time, so resolves wait their turn. */
  private fun resolve(info: NsdServiceInfo) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      if (infoCallbacks.containsKey(info.serviceName)) return
      val callback = object : NsdManager.ServiceInfoCallback {
        override fun onServiceInfoCallbackRegistrationFailed(errorCode: Int) {
          infoCallbacks.remove(info.serviceName)
        }
        override fun onServiceUpdated(updated: NsdServiceInfo) = found(updated)
        override fun onServiceLost() {}
        override fun onServiceInfoCallbackUnregistered() {}
      }
      infoCallbacks[info.serviceName] = callback
      runCatching { nsd.registerServiceInfoCallback(info, resolveQueue, callback) }
        .onFailure { infoCallbacks.remove(info.serviceName) }
      return
    }
    resolveQueue.execute {
      val done = java.util.concurrent.CountDownLatch(1)
      @Suppress("DEPRECATION")
      nsd.resolveService(
        info,
        object : NsdManager.ResolveListener {
          override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) = done.countDown()
          override fun onServiceResolved(resolved: NsdServiceInfo) {
            found(resolved)
            done.countDown()
          }
        },
      )
      done.await(CONNECT_TIMEOUT_MS.toLong(), java.util.concurrent.TimeUnit.MILLISECONDS)
    }
  }
}

/**
 * This phone's IPv4 addresses on local networks (Wi-Fi, or its own hotspot), Wi-Fi first.
 * Cellular (rmnet, ccmni, ...) and loopback are skipped: nobody can join through those.
 */
internal fun localIPv4Addresses(): List<String> {
  val wifi = listOf("wlan", "swlan", "ap", "softap", "eth")
  return runCatching { NetworkInterface.getNetworkInterfaces()?.toList().orEmpty() }
    .getOrDefault(emptyList())
    .filter { runCatching { it.isUp && !it.isLoopback }.getOrDefault(false) }
    .mapNotNull { nif ->
      val rank = wifi.indexOfFirst { nif.name.startsWith(it) }
      if (rank < 0) return@mapNotNull null
      nif.inetAddresses.toList().filterIsInstance<Inet4Address>().map { rank to it.hostAddress }
    }
    .flatten()
    .sortedBy { it.first }
    .mapNotNull { it.second }
}
