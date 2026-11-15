/** Where the SDK keeps the device identity between page loads. */
export interface KeyValueStore {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export function memoryStore(): KeyValueStore {
  const data = new Map<string, string>()
  return {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
  }
}

/**
 * `localStorage`, falling back to memory where it is missing or blocked
 * (Node, private windows, sandboxed iframes).
 */
export function defaultStore(): KeyValueStore {
  try {
    const ls = globalThis.localStorage
    const probe = "__pairmesh_probe__"
    ls.setItem(probe, probe)
    ls.removeItem(probe)
    return {
      get: (key) => ls.getItem(key),
      set: (key, value) => ls.setItem(key, value),
      remove: (key) => ls.removeItem(key),
    }
  } catch {
    return memoryStore()
  }
}
