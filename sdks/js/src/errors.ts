/**
 * Raised for any refused request. `reason` is the server's reason string
 * (e.g. `"unauthorized"`, `"forbidden"`, `"invalid_payload"`,
 * `"unknown_plugin"`, `"not_approved"`) or an SDK one (`"timeout"`,
 * `"connect_failed"`, `"invalid_join_url"`, `"closed"`).
 */
export class PairMeshError extends Error {
  readonly reason: string

  constructor(reason: string, message?: string) {
    super(message ?? `PairMesh: ${reason}`)
    this.name = "PairMeshError"
    this.reason = reason
  }
}

export function reasonOf(response: unknown, fallback: string): string {
  if (response && typeof response === "object" && "reason" in response) {
    return String((response as { reason: unknown }).reason)
  }
  return fallback
}
