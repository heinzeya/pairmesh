// Laptop side: create a "gamepad" pairing, show its QR code, approve the
// phone, and mirror the phone's buttons and sticks.
import { PairMesh, gamepad } from "@pairmesh/js"

import { serverUrl } from "./config.js"
import { renderPad } from "./pad-markup.js"

const $ = (selector) => document.querySelector(selector)
const pm = new PairMesh({ url: serverUrl })
const pad = $("#pad")
const log = $("#input-log")
const BADGES = {
  connecting: ["Connecting…", ""],
  error: ["Offline", "badge-error"],
  waiting: ["Not paired", ""],
  requested: ["Approval needed", "badge-warn"],
  approved: ["Paired", "badge-ok"],
}

let pairing
let stopTracking

renderPad(pad, { controls: false })
$("#localhost-hint").hidden = !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)

function show(status, message) {
  for (const el of document.querySelectorAll("[data-show]")) el.hidden = el.dataset.show !== status
  const [text, tone] = BADGES[status]
  $("#badge").textContent = text
  $("#badge").className = `badge ${tone}`
  if (message) $('[data-show="error"]').textContent = message
}

function mirror(state, change) {
  for (const el of pad.querySelectorAll("[data-button]")) {
    el.classList.toggle("pressed", state.pressed.has(el.dataset.button))
  }
  for (const el of pad.querySelectorAll("[data-stick]")) {
    const { x, y } = state.sticks[el.dataset.stick]
    el.style.setProperty("--x", x)
    el.style.setProperty("--y", y)
  }
  if (change.type === "button" && change.pressed) addLog(`${change.button.toUpperCase()} pressed`)
}

function addLog(text) {
  log.querySelector(".empty")?.remove()
  const item = document.createElement("li")
  item.textContent = text
  log.prepend(item)
  while (log.children.length > 8) log.lastElementChild.remove()
}

async function start() {
  stopTracking?.()
  await pairing?.leave()
  show("connecting")

  try {
    pairing = await pm.createPairing({
      plugin: "gamepad",
      joinUrl: new URL("pad.html", location.href).href,
    })
  } catch (error) {
    show("error", `Can't reach PairMesh at ${serverUrl} (${error.reason ?? error.message}).`)
    return
  }

  pairing.renderQR($("#qr"))
  $("#join-link").href = pairing.joinUrl
  show(pairing.status)

  // "closed" comes from leaving an old pairing when making a new code.
  pairing.on("status", (status) => status !== "closed" && show(status))
  pairing.on("expired", start)
  stopTracking = gamepad.track(pairing, mirror)
}

$("#approve").addEventListener("click", () => pairing.approve().catch(start))
$("#new-code").addEventListener("click", start)
pm.on("disconnected", () => (pairing?.approved ? ($("#badge").textContent = "Reconnecting…") : null))
pm.on("connected", () => pairing && show(pairing.status))

start()
