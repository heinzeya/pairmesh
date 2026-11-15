import { describe, expect, it } from "vitest"

import { buildJoinUrl, parseJoinUrl, withoutSecret } from "../src/join-url"
import { PairMeshError } from "../src/errors"

describe("join URLs", () => {
  it("puts the pairing in the fragment, replacing any existing one", () => {
    const url = buildJoinUrl("https://app.test/pad?mode=x#old", { pairingId: "p1", secret: "s/1" })
    expect(url).toBe("https://app.test/pad?mode=x#pairing_id=p1&secret=s%2F1")
  })

  it("round-trips through parseJoinUrl", () => {
    const url = buildJoinUrl("https://app.test/pad", { pairingId: "p1", secret: "s1" })
    expect(parseJoinUrl(url)).toEqual({ pairingId: "p1", secret: "s1" })
  })

  it("reads the query as a fallback and allows a missing secret", () => {
    expect(parseJoinUrl("https://app.test/?pairing_id=p2")).toEqual({ pairingId: "p2", secret: undefined })
  })

  it("rejects URLs without a pairing", () => {
    expect(() => parseJoinUrl("https://app.test/pad")).toThrow(PairMeshError)
    expect(() => parseJoinUrl("not a url")).toThrow(/not a URL/)
  })

  it("withoutSecret keeps only the pairing id", () => {
    const url = buildJoinUrl("https://app.test/pad", { pairingId: "p1", secret: "s1" })
    expect(withoutSecret(url)).toBe("https://app.test/pad#pairing_id=p1")
  })
})
