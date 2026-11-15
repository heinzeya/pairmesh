/**
 * Helpers for the `"gamepad"` plugin.
 *
 * - Phone: `gamepad.controller(session, element)` turns `[data-button]` and
 *   `[data-stick]` elements inside `element` into touch controls.
 * - Owner: `gamepad.track(pairing, (state, change) => …)` keeps the current
 *   button and stick state.
 *
 * Commands: `gamepad.button.down` / `gamepad.button.up` with `{ button }`, and
 * `gamepad.stick` with `{ stick, x, y }` where x and y are in -1..1 and y is
 * positive downward (like the browser Gamepad API).
 */
import type { Session } from "../session"

export const BUTTONS = ["a", "b", "x", "y", "up", "down", "left", "right", "start", "select", "l", "r"] as const
export const STICKS = ["left", "right"] as const

export type Button = (typeof BUTTONS)[number]
export type Stick = (typeof STICKS)[number]

export interface GamepadState {
  pressed: Set<string>
  sticks: Record<Stick, { x: number; y: number }>
}

export type GamepadChange =
  | { type: "button"; button: string; pressed: boolean; deviceId: string }
  | { type: "stick"; stick: Stick; x: number; y: number; deviceId: string }

type Subscribable = Pick<Session, "on">
type Sendable = Pick<Session, "send">

/**
 * Follows a gamepad pairing's input. `onChange` gets the whole state and the
 * change that caused it. Returns a function that stops tracking.
 */
export function track(session: Subscribable, onChange: (state: GamepadState, change: GamepadChange) => void): () => void {
  const state: GamepadState = { pressed: new Set(), sticks: { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } } }

  const button = (pressed: boolean) => (payload: { button: string; device_id: string }) => {
    if (pressed) state.pressed.add(payload.button)
    else state.pressed.delete(payload.button)
    onChange(state, { type: "button", button: payload.button, pressed, deviceId: payload.device_id })
  }

  const offs = [
    session.on("gamepad.button.down", button(true)),
    session.on("gamepad.button.up", button(false)),
    session.on("gamepad.stick", (payload: { stick: Stick; x: number; y: number; device_id: string }) => {
      if (!(payload.stick in state.sticks)) return
      state.sticks[payload.stick] = { x: payload.x, y: payload.y }
      onChange(state, { type: "stick", stick: payload.stick, x: payload.x, y: payload.y, deviceId: payload.device_id })
    }),
  ]
  return () => offs.forEach((off) => off())
}

export interface ControllerOptions {
  /** Minimum time between stick updates, in ms. Default 50 (20 per second). */
  stickInterval?: number
  /** Vibrate briefly on press where supported. Default true. */
  haptics?: boolean
  /** Called when a command is refused (e.g. the pairing was closed). */
  onError?: (error: unknown) => void
}

/**
 * Makes the controls inside `root` send gamepad commands:
 *
 * - `<button data-button="a">` sends `gamepad.button.down` on press and
 *   `gamepad.button.up` on release (pointer, or Space/Enter when focused)
 * - `<div data-stick="left"><span></span></div>` sends `gamepad.stick` while
 *   dragged and springs back to 0,0. The SDK sets `--x`/`--y` (-1..1) on the
 *   stick element so CSS can move its knob.
 *
 * Pressed elements get the `pressed` class. Everything is released when the
 * page is hidden. Returns a function that removes the listeners.
 */
export function controller(session: Sendable, root: HTMLElement, options: ControllerOptions = {}): () => void {
  const { stickInterval = 50, haptics = true, onError = (e) => console.warn("[pairmesh] gamepad", e) } = options
  const cleanups: Array<() => void> = []
  const listen = <K extends keyof HTMLElementEventMap>(
    el: EventTarget,
    type: K | string,
    handler: (event: any) => void,
  ) => {
    el.addEventListener(type, handler)
    cleanups.push(() => el.removeEventListener(type, handler))
  }
  const send = (command: string, payload: Record<string, unknown>) => session.send(command, payload).catch(onError)

  const setButton = (el: HTMLElement, pressed: boolean) => {
    if (el.classList.contains("pressed") === pressed) return
    el.classList.toggle("pressed", pressed)
    if (pressed && haptics) navigator.vibrate?.(10)
    send(pressed ? "gamepad.button.down" : "gamepad.button.up", { button: el.dataset.button })
  }

  listen(root, "contextmenu", (e: Event) => e.preventDefault())

  const pointers = new Map<number, HTMLElement>()
  for (const el of root.querySelectorAll<HTMLElement>("[data-button]")) {
    listen(el, "pointerdown", (e: PointerEvent) => {
      e.preventDefault()
      el.setPointerCapture?.(e.pointerId)
      pointers.set(e.pointerId, el)
      setButton(el, true)
    })
    const release = (e: PointerEvent) => {
      if (pointers.get(e.pointerId) !== el) return
      pointers.delete(e.pointerId)
      setButton(el, false)
    }
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) listen(el, type, release)
    listen(el, "keydown", (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) {
        e.preventDefault()
        setButton(el, true)
      }
    })
    listen(el, "keyup", (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") setButton(el, false)
    })
    listen(el, "blur", () => setButton(el, false))
  }

  const sticks = [...root.querySelectorAll<HTMLElement>("[data-stick]")].map((el) =>
    trackStick(el, stickInterval, (x, y) => send("gamepad.stick", { stick: el.dataset.stick, x, y }), listen),
  )

  const releaseAll = () => {
    pointers.clear()
    for (const el of root.querySelectorAll<HTMLElement>("[data-button].pressed")) setButton(el, false)
    for (const stick of sticks) stick.reset()
  }
  listen(document, "visibilitychange", () => {
    if (document.visibilityState === "hidden") releaseAll()
  })

  return () => {
    releaseAll()
    sticks.forEach((stick) => stick.dispose())
    cleanups.forEach((cleanup) => cleanup())
  }
}

function trackStick(
  el: HTMLElement,
  interval: number,
  push: (x: number, y: number) => void,
  listen: (el: EventTarget, type: string, handler: (event: any) => void) => void,
) {
  let pointerId: number | null = null
  let last = 0
  let sent = "0,0"
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = (x: number, y: number) => {
    const key = `${x},${y}`
    if (key === sent) return
    sent = key
    last = Date.now()
    push(x, y)
  }

  const set = (x: number, y: number, immediate = false) => {
    x = Math.round(x * 100) / 100
    y = Math.round(y * 100) / 100
    el.style.setProperty("--x", String(x))
    el.style.setProperty("--y", String(y))
    clearTimeout(timer)
    const wait = interval - (Date.now() - last)
    if (immediate || wait <= 0) flush(x, y)
    else timer = setTimeout(() => flush(x, y), wait)
  }

  const move = (e: PointerEvent) => {
    const rect = el.getBoundingClientRect()
    const radius = rect.width / 2
    let x = (e.clientX - rect.left - radius) / radius
    let y = (e.clientY - rect.top - radius) / radius
    const length = Math.hypot(x, y)
    if (length > 1) {
      x /= length
      y /= length
    }
    set(x, y)
  }

  const end = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    pointerId = null
    el.classList.remove("pressed")
    set(0, 0, true)
  }

  listen(el, "pointerdown", (e: PointerEvent) => {
    e.preventDefault()
    pointerId = e.pointerId
    el.setPointerCapture?.(e.pointerId)
    el.classList.add("pressed")
    move(e)
  })
  listen(el, "pointermove", (e: PointerEvent) => {
    if (e.pointerId === pointerId) move(e)
  })
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) listen(el, type, end)

  return {
    reset: () => {
      pointerId = null
      el.classList.remove("pressed")
      set(0, 0, true)
    },
    dispose: () => clearTimeout(timer),
  }
}
