export type Handler<T = any> = (payload: T, event: string) => void

/** Minimal event emitter; `"*"` handlers receive every event. */
export class Emitter {
  private handlers = new Map<string, Set<Handler>>()

  on<T = any>(event: string, handler: Handler<T>): () => void {
    let set = this.handlers.get(event)
    if (!set) this.handlers.set(event, (set = new Set()))
    set.add(handler as Handler)
    return () => set!.delete(handler as Handler)
  }

  once<T = any>(event: string, handler: Handler<T>): () => void {
    const off = this.on<T>(event, (payload, name) => {
      off()
      handler(payload, name)
    })
    return off
  }

  emit(event: string, payload: unknown): void {
    for (const key of [event, "*"]) {
      for (const handler of [...(this.handlers.get(key) ?? [])]) {
        try {
          handler(payload, event)
        } catch (error) {
          console.error(`[pairmesh] "${event}" handler failed`, error)
        }
      }
    }
  }

  clear(): void {
    this.handlers.clear()
  }
}
