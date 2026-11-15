// Presenter: show the deck, create a "presentation" pairing for the phone
// remote, move slides on slide.next / slide.previous, and tell the remote
// which slide is showing with slide.changed.
import { PairMesh } from "@pairmesh/js"

import { serverUrl } from "./config.js"
import { slides } from "./slides.js"

const $ = (selector) => document.querySelector(selector)
const pm = new PairMesh({ url: serverUrl })
const BADGES = {
  connecting: ["Connecting…", ""],
  error: ["Offline", "badge-error"],
  waiting: ["Not paired", ""],
  requested: ["Approval needed", "badge-warn"],
  approved: ["Paired", "badge-ok"],
}

let index = 0
let pairing

$("#localhost-hint").hidden = !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)

function renderSlide() {
  const slide = slides[index]
  $("#slide-section").textContent = slide.section
  $("#slide-title").textContent = slide.title
  $("#slide-text").textContent = slide.body
  $("#slide-counter").textContent = `${index + 1} / ${slides.length}`
}

function announce() {
  if (!pairing?.approved) return
  pairing
    .send("slide.changed", { index, total: slides.length, title: slides[index].title })
    .catch((error) => console.warn("slide.changed", error))
}

function move(step) {
  const next = Math.min(slides.length - 1, Math.max(0, index + step))
  if (next === index) return
  index = next
  renderSlide()
  announce()
}

function show(status, message) {
  for (const el of document.querySelectorAll("[data-show]")) el.hidden = el.dataset.show !== status
  const [text, tone] = BADGES[status]
  $("#badge").textContent = text
  $("#badge").className = `badge ${tone}`
  if (message) $('[data-show="error"]').textContent = message
}

async function start() {
  await pairing?.leave()
  show("connecting")

  try {
    pairing = await pm.createPairing({
      plugin: "presentation",
      joinUrl: new URL("remote.html", location.href).href,
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
  pairing.on("approved", announce)
  pairing.on("expired", start)
  pairing.on("slide.next", () => move(1))
  pairing.on("slide.previous", () => move(-1))
}

$("#previous").addEventListener("click", () => move(-1))
$("#next").addEventListener("click", () => move(1))
window.addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, textarea, [contenteditable]")) return
  if (e.key === "ArrowRight") move(1)
  if (e.key === "ArrowLeft") move(-1)
})
$("#approve").addEventListener("click", () => pairing.approve().catch(start))
$("#new-code").addEventListener("click", start)
pm.on("disconnected", () => (pairing?.approved ? ($("#badge").textContent = "Reconnecting…") : null))
pm.on("connected", () => pairing && show(pairing.status))

renderSlide()
start()
