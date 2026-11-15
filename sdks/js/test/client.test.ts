import { describe, expect, it, vi } from "vitest"

import { PairMesh } from "../src/client"
import { memoryStore } from "../src/storage"

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 201 })

describe("PairMesh#device", () => {
  it("registers once and reuses the stored identity", async () => {
    const fetch = vi.fn(async () => ok({ device_id: "d1", token: "t1" }))
    const pm = new PairMesh({ url: "http://pm.test/", storage: memoryStore(), fetch })

    expect(await pm.device()).toMatchObject({ deviceId: "d1", token: "t1" })
    expect(await pm.device()).toMatchObject({ deviceId: "d1" })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0]).toEqual(["http://pm.test/api/devices", expect.objectContaining({ method: "POST" })])
  })

  it("re-registers when asked to refresh", async () => {
    let n = 0
    const fetch = vi.fn(async () => ok({ device_id: `d${++n}`, token: "t" }))
    const pm = new PairMesh({ url: "http://pm.test", storage: memoryStore(), fetch })

    await pm.device()
    expect(await pm.device({ refresh: true })).toMatchObject({ deviceId: "d2" })
  })

  it("reports an unreachable server as connect_failed", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("fetch failed")
    })
    const pm = new PairMesh({ url: "http://pm.test", storage: memoryStore(), fetch })
    await expect(pm.device()).rejects.toMatchObject({ reason: "connect_failed" })
  })
})
