// Phone remote, opened from the QR code: join, wait for approval, then send
// slide.next / slide.previous and show the slide the presenter announces.
import { PairMesh, withoutSecret } from "@pairmesh/js"

import { serverUrl } from "./config.js"

const $ = (selector) => document.querySelector(selector)
const pm = new PairMesh({ url: serverUrl })
const BADGES = {
  connecting: ["Connecting…", ""],
  invalid: ["Invalid code", "badge-error"],
  requested: ["Not paired", ""],
  approved: ["Paired", "badge-ok"],
  closed: ["Disconnected", "badge-error"],
}

function show(status) {
  for (const el of document.querySelectorAll("[data-show]")) el.hidden = el.dataset.show !== status
  const [text, tone] = BADGES[status] ?? BADGES.connecting
  $("#badge").textContent = text
  $("#badge").className = `badge ${tone}`
}

async function main() {
  let session
  try {
    session = await pm.join(location.href)
  } catch {
    show("invalid")
    return
  }

  // The secret is single-use; keep only the pairing id so a reload rejoins.
  history.replaceState(null, "", withoutSecret(location.href))

  show(session.status)
  session.on("status", show)
  session.on("slide.changed", ({ index, total, title }) => {
    $("#remote-slide").textContent = `${index + 1} / ${total} · ${title}`
  })
  pm.on("disconnected", () => ($("#badge").textContent = "Reconnecting…"))
  pm.on("connected", () => show(session.status))

  const send = (command) =>
    session.send(command).catch((error) => {
      if (error.reason === "not_approved") show("invalid")
    })
  $("#remote-previous").addEventListener("click", () => send("slide.previous"))
  $("#remote-next").addEventListener("click", () => send("slide.next"))
}

main()
