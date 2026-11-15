import type { Channel } from "phoenix"
import qrcode from "qrcode-generator"

import { Emitter, type Handler } from "./emitter"
import { PairMeshError, reasonOf } from "./errors"

/**
 * Where a pairing stands, for either device:
 *
 * - `"waiting"`: created, nobody has scanned the code yet
 * - `"requested"`: a device claimed it and is waiting for the owner's approval
 * - `"approved"`: both devices may send plugin commands
 * - `"closed"`: this device left
 */
export type SessionStatus = "waiting" | "requested" | "approved" | "closed"

export type Role = "owner" | "claimant"

/** The reply to joining `session:<id>` (see docs/protocol.md). */
export interface JoinReply {
  status: "pending" | "claimed" | "approved"
  plugin: string
  role: Role
}

export interface PairingEvents {
  status: SessionStatus
  requested: { deviceId: string }
  approved: { deviceId: string }
  expired: undefined
  disconnected: undefined
  closed: undefined
}

const SERVER_STATUS: Record<JoinReply["status"], SessionStatus> = {
  pending: "waiting",
  claimed: "requested",
  approved: "approved",
}

/**
 * A joined pairing. Both devices get one: the owner gets a `Pairing` (from
 * `createPairing`), the phone gets a `Session` (from `join`).
 *
 * Plugin events arrive under their own names, e.g.
 * `session.on("gamepad.button.down", ({ button }) => …)`, with the server's
 * payload (including `plugin` and `device_id`). `"*"` receives everything.
 */
export class Session {
  readonly id: string
  readonly deviceId: string
  plugin: string
  role: Role
  status: SessionStatus

  protected readonly emitter = new Emitter()
  protected readonly channel: Channel
  protected readonly timeout: number

  /** @internal Use `PairMesh#createPairing` or `PairMesh#join`. */
  constructor(channel: Channel, init: { id: string; deviceId: string; reply: JoinReply; timeout: number }) {
    this.channel = channel
    this.id = init.id
    this.deviceId = init.deviceId
    this.timeout = init.timeout
    this.plugin = init.reply.plugin
    this.role = init.reply.role
    this.status = SERVER_STATUS[init.reply.status] ?? "waiting"

    channel.onMessage = (event: string, payload: any) => {
      if (!event.startsWith("phx_") && !event.startsWith("chan_reply_")) this.handle(event, payload)
      return payload
    }
    channel.onError(() => this.emitter.emit("disconnected", undefined))
  }

  get approved(): boolean {
    return this.status === "approved"
  }

  on<K extends keyof PairingEvents>(event: K, handler: Handler<PairingEvents[K]>): () => void
  on<T = Record<string, any>>(event: string, handler: Handler<T>): () => void
  on(event: string, handler: Handler): () => void {
    return this.emitter.on(event, handler)
  }

  once<K extends keyof PairingEvents>(event: K, handler: Handler<PairingEvents[K]>): () => void
  once<T = Record<string, any>>(event: string, handler: Handler<T>): () => void
  once(event: string, handler: Handler): () => void {
    return this.emitter.once(event, handler)
  }

  /** Resolves once the pairing is approved (immediately if it already is). */
  whenApproved(): Promise<this> {
    if (this.approved) return Promise.resolve(this)
    return new Promise((resolve, reject) => {
      const offs = [
        this.on("approved", () => (offs.forEach((off) => off()), resolve(this))),
        this.on("closed", () => (offs.forEach((off) => off()), reject(new PairMeshError("closed")))),
      ]
    })
  }

  /**
   * Sends a command of the pairing's plugin, e.g.
   * `send("gamepad.button.down", { button: "a" })`. Resolves with the event the
   * plugin produced; rejects with a `PairMeshError` (`"not_approved"`,
   * `"forbidden"`, `"invalid_payload"`, …).
   */
  send(command: string, payload: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    return push(this.channel, command, payload, this.timeout)
  }

  /** Leaves the pairing on this device. */
  leave(): Promise<void> {
    if (this.status === "closed") return Promise.resolve()
    this.setStatus("closed")
    this.emitter.emit("closed", undefined)
    return new Promise((resolve) => {
      this.channel
        .leave(this.timeout)
        .receive("ok", () => resolve())
        .receive("timeout", () => resolve())
    })
  }

  /** @internal Applied on every (re)join reply. */
  applyJoinReply(reply: JoinReply): void {
    this.plugin = reply.plugin
    this.role = reply.role
    const status = SERVER_STATUS[reply.status]
    if (status && this.status !== "closed") this.setStatus(status)
  }

  protected setStatus(status: SessionStatus): void {
    if (status === this.status) return
    this.status = status
    this.emitter.emit("status", status)
  }

  private handle(event: string, payload: Record<string, any>): void {
    switch (event) {
      case "pairing.requested":
        this.setStatus("requested")
        this.emitter.emit("requested", { deviceId: payload.device_id })
        return

      case "pairing.approved":
        if (this.role === "owner" || payload.device_id === this.deviceId) {
          this.setStatus("approved")
          this.emitter.emit("approved", { deviceId: payload.device_id })
        }
        return

      default:
        this.emitter.emit(event, payload)
    }
  }
}

export interface QrOptions {
  /** Quiet zone around the code, in modules. Default 2. */
  margin?: number
  /** Error correction level. Default "M". */
  errorCorrection?: "L" | "M" | "Q" | "H"
}

/** The owner's side of a pairing: the join URL/QR code and `approve()`. */
export class Pairing extends Session {
  /** Open this on the other device (it is what the QR code encodes). */
  readonly joinUrl: string
  readonly expiresAt: Date
  private expiryTimer?: ReturnType<typeof setTimeout>

  /** @internal Use `PairMesh#createPairing`. */
  constructor(
    channel: Channel,
    init: { id: string; deviceId: string; reply: JoinReply; timeout: number; joinUrl: string; expiresAt: Date },
  ) {
    super(channel, init)
    this.joinUrl = init.joinUrl
    this.expiresAt = init.expiresAt

    const wait = init.expiresAt.getTime() - Date.now()
    this.expiryTimer = setTimeout(() => {
      if (this.status === "waiting" || this.status === "requested") this.emitter.emit("expired", undefined)
    }, Math.max(0, wait))
    this.on("approved", () => clearTimeout(this.expiryTimer))
    this.on("closed", () => clearTimeout(this.expiryTimer))
  }

  /** Approves the device that claimed the pairing. */
  async approve(): Promise<void> {
    await push(this.channel, "pairing.approve", {}, this.timeout)
  }

  /** The join URL as a scalable SVG QR code (an `<svg>` string). */
  qrSvg({ margin = 2, errorCorrection = "M" }: QrOptions = {}): string {
    const qr = qrcode(0, errorCorrection)
    qr.addData(this.joinUrl)
    qr.make()
    return qr
      .createSvgTag({ cellSize: 4, margin, scalable: true })
      .replace("<svg ", '<svg role="img" aria-label="PairMesh pairing code" ')
  }

  /** Renders the QR code into `element`, replacing its contents. */
  renderQR(element: Element, options?: QrOptions): void {
    element.innerHTML = this.qrSvg(options)
  }
}

/** @internal */
export function push(
  channel: Channel,
  event: string,
  payload: Record<string, unknown>,
  timeout: number,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    channel
      .push(event, payload, timeout)
      .receive("ok", (reply) => resolve(reply ?? {}))
      .receive("error", (reply) => reject(new PairMeshError(reasonOf(reply, "error"))))
      .receive("timeout", () => reject(new PairMeshError("timeout")))
  })
}
