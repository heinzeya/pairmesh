// Full pairing flow against a running server:
//   PAIRMESH_URL=http://localhost:4000 npm run test:integration
import { afterEach, describe, expect, it } from "vitest"

import { PairMesh, gamepad, memoryStore, type Session } from "../../src"

const url = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.PAIRMESH_URL
const clients: PairMesh[] = []
const client = () => {
  const pm = new PairMesh({ url: url!, storage: memoryStore() })
  clients.push(pm)
  return pm
}
const next = <T>(session: Session, event: string) => new Promise<T>((resolve) => session.once<T>(event, resolve))

afterEach(() => clients.splice(0).forEach((pm) => pm.disconnect()))

describe.skipIf(!url)("pairing flow", () => {
  it("creates, claims, approves and relays gamepad commands", async () => {
    const host = client()
    const pairing = await host.createPairing({ plugin: "gamepad", joinUrl: "https://app.test/pad" })
    expect(pairing.status).toBe("waiting")
    expect(pairing.role).toBe("owner")
    expect(pairing.joinUrl).toMatch(/^https:\/\/app\.test\/pad#pairing_id=.+&secret=.+/)
    expect(pairing.qrSvg()).toContain("<svg")

    const requested = next<{ deviceId: string }>(pairing, "requested")
    const phone = client()
    const session = await phone.join(pairing.joinUrl)
    expect(session).toMatchObject({ status: "requested", role: "claimant", plugin: "gamepad" })
    expect((await requested).deviceId).toBe(session.deviceId)

    await expect(session.send("gamepad.button.down", { button: "a" })).rejects.toMatchObject({ reason: "not_approved" })

    await pairing.approve()
    await session.whenApproved()
    expect(pairing.status).toBe("approved")

    const seen: string[] = []
    gamepad.track(pairing, (state) => seen.push([...state.pressed].join(",")))
    const pressed = next(pairing, "gamepad.button.down")
    await expect(session.send("gamepad.button.down", { button: "a" })).resolves.toMatchObject({ button: "a" })
    expect(await pressed).toMatchObject({ button: "a", plugin: "gamepad", device_id: session.deviceId })
    expect(seen).toEqual(["a"])

    await expect(session.send("slide.next")).rejects.toMatchObject({ reason: "forbidden" })
    await expect(session.send("gamepad.button.down", { button: "turbo" })).rejects.toMatchObject({
      reason: "invalid_payload",
    })
  })

  it("relays presentation commands both ways", async () => {
    const pairing = await client().createPairing({ plugin: "presentation", joinUrl: "https://app.test/remote" })
    const session = await client().join(pairing.joinUrl)
    await pairing.approve()
    await session.whenApproved()

    const next = new Promise((resolve) => pairing.once("slide.next", resolve))
    await session.send("slide.next")
    expect(await next).toMatchObject({ plugin: "presentation", device_id: session.deviceId })

    const changed = new Promise((resolve) => session.once("slide.changed", resolve))
    await pairing.send("slide.changed", { index: 1, total: 5, title: "pairing.create" })
    expect(await changed).toMatchObject({ index: 1, total: 5, title: "pairing.create" })

    await expect(pairing.send("slide.changed", { index: 9, total: 5, title: "x" })).rejects.toMatchObject({
      reason: "invalid_payload",
    })
  })

  it("lets the claimant rejoin without the secret and knows it is approved", async () => {
    const storage = memoryStore()
    const host = client()
    const pairing = await host.createPairing({ plugin: "presentation", joinUrl: "https://app.test/remote" })

    const phone = new PairMesh({ url: url!, storage })
    clients.push(phone)
    await phone.join(pairing.joinUrl)
    await pairing.approve()
    phone.disconnect()

    const reloaded = new PairMesh({ url: url!, storage })
    clients.push(reloaded)
    const session = await reloaded.join({ pairingId: pairing.id })
    expect(session.status).toBe("approved")
    await expect(session.send("slide.next")).resolves.toMatchObject({ event: "slide.next" })
  })

  it("rejects a used or wrong secret and unknown plugins", async () => {
    const pairing = await client().createPairing({ plugin: "gamepad", joinUrl: "https://app.test/pad" })
    await client().join(pairing.joinUrl)

    await expect(client().join(pairing.joinUrl)).rejects.toMatchObject({ reason: "unauthorized" })
    await expect(client().join({ pairingId: pairing.id, secret: "wrong" })).rejects.toMatchObject({
      reason: "unauthorized",
    })
    await expect(client().createPairing({ plugin: "nope", joinUrl: "https://app.test" })).rejects.toMatchObject({
      reason: "unknown_plugin",
    })
  })
})
