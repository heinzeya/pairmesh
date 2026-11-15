import { PairMeshError } from "./errors"

export interface JoinParams {
  pairingId: string
  /** Absent when rejoining a pairing this device already claimed. */
  secret?: string
}

/**
 * Appends the pairing to `base` as a URL fragment
 * (`#pairing_id=…&secret=…`). Fragments are never sent to servers, so the
 * one-time secret stays out of access logs and referrers.
 */
export function buildJoinUrl(base: string, { pairingId, secret }: JoinParams): string {
  const url = new URL(base)
  const hash = new URLSearchParams({ pairing_id: pairingId })
  if (secret) hash.set("secret", secret)
  url.hash = hash.toString()
  return url.toString()
}

/** Reads the pairing from a join URL's fragment (or, as a fallback, its query). */
export function parseJoinUrl(input: string): JoinParams {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new PairMeshError("invalid_join_url", `PairMesh: not a URL: ${input}`)
  }

  for (const params of [new URLSearchParams(url.hash.slice(1)), url.searchParams]) {
    const pairingId = params.get("pairing_id")
    if (pairingId) return { pairingId, secret: params.get("secret") ?? undefined }
  }

  throw new PairMeshError("invalid_join_url", "PairMesh: the URL has no pairing_id")
}

/** The same URL without the secret, safe to keep in the address bar or history. */
export function withoutSecret(input: string): string {
  const url = new URL(input)
  const hash = new URLSearchParams(url.hash.slice(1))
  hash.delete("secret")
  url.searchParams.delete("secret")
  url.hash = hash.toString()
  return url.toString()
}
