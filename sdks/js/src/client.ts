import { Socket, type Channel } from "phoenix"

import { Emitter, type Handler } from "./emitter"
import { PairMeshError, reasonOf } from "./errors"
import { buildJoinUrl, parseJoinUrl, type JoinParams } from "./join-url"
import { Pairing, Session, type JoinReply } from "./session"
import { defaultStore, type KeyValueStore } from "./storage"

/** Wire protocol version sent on connect (see docs/protocol.md). */
export const PROTOCOL_VERSION = "1"

// Device tokens are valid for 30 days; refresh a little earlier.
const DEVICE_MAX_AGE_MS = 25 * 24 * 60 * 60 * 1000

export interface PairMeshOptions {
  /** Base URL of the PairMesh server, e.g. `"https://pairmesh.example.com"`. */
  url: string
  /** Where the device identity is kept. Default: `localStorage`, else memory. */
  storage?: KeyValueStore
  /** Request timeout in milliseconds. Default 10000. */
  timeout?: number
  /** `fetch` implementation. Default: the global one. */
  fetch?: typeof fetch
  /** WebSocket constructor. Default: the global one. */
  transport?: unknown
}

export interface CreatePairingOptions {
  /** Plugin the pairing is for, e.g. `"presentation"` or `"gamepad"`. */
  plugin: string
  /**
   * Page the other device should open. The SDK appends the pairing to it
   * (`#pairing_id=…&secret=…`); on that page call `pm.join(location.href)`.
   */
  joinUrl: string
}

export interface Device {
  deviceId: string
  token: string
  issuedAt: number
}

export interface ClientEvents {
  connected: undefined
  disconnected: undefined
}

/**
 * Client for a PairMesh server.
 *
 * ```js
 * const pm = new PairMesh({ url: "https://pairmesh.example.com" })
 *
 * // Owner (laptop): show a QR code, approve whoever scans it.
 * const pairing = await pm.createPairing({ plugin: "gamepad", joinUrl: "https://myapp.com/pad" })
 * pairing.renderQR(document.querySelector("#qr"))
 * pairing.on("requested", () => pairing.approve())
 * pairing.on("gamepad.button.down", ({ button }) => console.log(button))
 *
 * // Other device (phone), on the joinUrl page:
 * const session = await pm.join(location.href)
 * await session.whenApproved()
 * await session.send("gamepad.button.down", { button: "a" })
 * ```
 */
export class PairMesh {
  readonly url: string

  private readonly storage: KeyValueStore
  private readonly timeout: number
  private readonly fetchImpl: typeof fetch
  private readonly transport: unknown
  private readonly emitter = new Emitter()
  private socket?: Promise<{ socket: Socket; device: Device }>
  private lobby?: Promise<Channel>

  constructor(options: PairMeshOptions) {
    if (!options?.url) throw new PairMeshError("invalid_options", "PairMesh: `url` is required")
    this.url = options.url.replace(/\/+$/, "")
    this.storage = options.storage ?? defaultStore()
    this.timeout = options.timeout ?? 10_000
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis)
    this.transport = options.transport
  }

  on<K extends keyof ClientEvents>(event: K, handler: Handler<ClientEvents[K]>): () => void {
    return this.emitter.on(event, handler)
  }

  /** Creates a pairing owned by this device and joins it. */
  async createPairing({ plugin, joinUrl }: CreatePairingOptions): Promise<Pairing> {
    if (!joinUrl) throw new PairMeshError("invalid_options", "PairMesh: `joinUrl` is required")
    const { socket, device } = await this.connect()
    const lobby = await this.joinLobby(socket)

    const created = (await new Promise((resolve, reject) => {
      lobby
        .push("pairing.create", { plugin }, this.timeout)
        .receive("ok", resolve)
        .receive("error", (reply) => reject(new PairMeshError(reasonOf(reply, "error"))))
        .receive("timeout", () => reject(new PairMeshError("timeout")))
    })) as { pairing_id: string; secret: string; expires_at: number }

    const channel = socket.channel(`session:${created.pairing_id}`, {})
    let pairing: Pairing | undefined
    const reply = await joinChannel(channel, this.timeout, (r) => pairing?.applyJoinReply(r))

    pairing = new Pairing(channel, {
      id: created.pairing_id,
      deviceId: device.deviceId,
      reply,
      timeout: this.timeout,
      joinUrl: buildJoinUrl(joinUrl, { pairingId: created.pairing_id, secret: created.secret }),
      expiresAt: new Date(created.expires_at * 1000),
    })
    return pairing
  }

  /**
   * Joins a pairing from a join URL (e.g. `location.href`) or its parts.
   * The first join claims it with the secret; later joins from the same
   * device (e.g. after a reload) work without one.
   */
  async join(target: string | JoinParams): Promise<Session> {
    const { pairingId, secret: initialSecret } = typeof target === "string" ? parseJoinUrl(target) : target
    const { socket, device } = await this.connect()

    // Send the secret only until the claim succeeds; rejoins don't need it.
    let secret = initialSecret
    const channel = socket.channel(`session:${pairingId}`, () => (secret ? { secret } : {}))
    let session: Session | undefined
    const reply = await joinChannel(channel, this.timeout, (r) => {
      secret = undefined
      session?.applyJoinReply(r)
    })

    session = new Session(channel, { id: pairingId, deviceId: device.deviceId, reply, timeout: this.timeout })
    return session
  }

  /** This device's identity, registering one with the server if needed. */
  async device(options: { refresh?: boolean } = {}): Promise<Device> {
    const key = `pairmesh:device:${this.url}`
    if (!options.refresh) {
      const stored = readDevice(this.storage.get(key))
      if (stored && Date.now() - stored.issuedAt < DEVICE_MAX_AGE_MS) return stored
    }

    let response: Response
    try {
      response = await this.fetchImpl(`${this.url}/api/devices`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
    } catch (error) {
      throw new PairMeshError("connect_failed", `PairMesh: cannot reach ${this.url} (${error})`)
    }
    if (!response.ok) throw new PairMeshError("connect_failed", `PairMesh: POST /api/devices returned ${response.status}`)

    const body = (await response.json()) as { device_id: string; token: string }
    const device = { deviceId: body.device_id, token: body.token, issuedAt: Date.now() }
    this.storage.set(key, JSON.stringify(device))
    return device
  }

  /** Closes the connection; sessions stop receiving events. */
  disconnect(): void {
    const current = this.socket
    this.socket = undefined
    this.lobby = undefined
    current?.then(({ socket }) => socket.disconnect()).catch(() => {})
  }

  private connect(): Promise<{ socket: Socket; device: Device }> {
    this.socket ??= this.openSocket().catch((error) => {
      this.socket = undefined
      throw error
    })
    return this.socket
  }

  // Connects with the stored identity; if the server rejects it (e.g. it was
  // issued by another server or has expired), registers a new one once.
  private async openSocket(): Promise<{ socket: Socket; device: Device }> {
    for (const refresh of [false, true]) {
      const device = await this.device({ refresh })
      const socket = new Socket(`${this.url.replace(/^http/, "ws")}/socket`, {
        params: { token: device.token, protocol: PROTOCOL_VERSION },
        timeout: this.timeout,
        ...(this.transport ? { transport: this.transport } : {}),
      } as any)

      const opened = await new Promise<boolean>((resolve) => {
        const refs: string[] = [
          socket.onOpen(() => (socket.off(refs), resolve(true))),
          socket.onError(() => (socket.off(refs), resolve(false))),
        ]
        socket.connect()
      })

      if (opened) {
        socket.onOpen(() => this.emitter.emit("connected", undefined))
        socket.onError(() => this.emitter.emit("disconnected", undefined))
        this.emitter.emit("connected", undefined)
        return { socket, device }
      }
      socket.disconnect()
    }
    throw new PairMeshError("connect_failed", `PairMesh: could not open a socket to ${this.url}`)
  }

  private joinLobby(socket: Socket): Promise<Channel> {
    this.lobby ??= (async () => {
      const lobby = socket.channel("session:lobby", {})
      await joinChannel(lobby, this.timeout)
      return lobby
    })().catch((error) => {
      this.lobby = undefined
      throw error
    })
    return this.lobby
  }
}

// Joins `channel`; `onEveryOk` also runs on automatic rejoins after a
// reconnect. A refused join is left so Phoenix stops retrying it.
function joinChannel(channel: Channel, timeout: number, onEveryOk?: (reply: JoinReply) => void): Promise<JoinReply> {
  return new Promise((resolve, reject) => {
    channel
      .join(timeout)
      .receive("ok", (reply: JoinReply) => {
        onEveryOk?.(reply)
        resolve(reply)
      })
      .receive("error", (reply) => {
        channel.leave()
        reject(new PairMeshError(reasonOf(reply, "join_failed")))
      })
      .receive("timeout", () => {
        channel.leave()
        reject(new PairMeshError("timeout"))
      })
  })
}

function readDevice(raw: string | null): Device | undefined {
  if (!raw) return undefined
  try {
    const device = JSON.parse(raw)
    if (typeof device?.deviceId === "string" && typeof device?.token === "string") return device
  } catch {
    // Ignore corrupt entries; a new identity is registered.
  }
  return undefined
}
