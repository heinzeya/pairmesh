import { describe, expect, it, vi } from "vitest"

import { Emitter } from "../src/emitter"
import { track } from "../src/plugins/gamepad"

describe("gamepad.track", () => {
  it("follows buttons and sticks until stopped", () => {
    const events = new Emitter()
    const onChange = vi.fn()
    const stop = track(events, onChange)

    events.emit("gamepad.button.down", { button: "a", device_id: "phone" })
    events.emit("gamepad.button.down", { button: "b", device_id: "phone" })
    events.emit("gamepad.button.up", { button: "a", device_id: "phone" })
    events.emit("gamepad.stick", { stick: "left", x: 0.5, y: -1, device_id: "phone" })

    const [state, change] = onChange.mock.lastCall!
    expect([...state.pressed]).toEqual(["b"])
    expect(state.sticks.left).toEqual({ x: 0.5, y: -1 })
    expect(change).toEqual({ type: "stick", stick: "left", x: 0.5, y: -1, deviceId: "phone" })

    stop()
    events.emit("gamepad.button.down", { button: "x", device_id: "phone" })
    expect(onChange).toHaveBeenCalledTimes(4)
  })
})
