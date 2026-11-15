// Phone side, opened from the QR code: join the pairing, wait for approval,
// then turn the on-screen buttons and sticks into gamepad commands.
import { PairMesh, gamepad, withoutSecret } from "@pairmesh/js"

import { serverUrl } from "./config.js"
import { renderPad } from "./pad-markup.js"

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
  pm.on("disconnected", () => ($("#badge").textContent = "Reconnecting…"))
  pm.on("connected", () => show(session.status))

  await session.whenApproved()
  const controls = $("#controls")
  renderPad(controls, { controls: true })
  gamepad.controller(session, controls, {
    onError: (error) => {
      if (error.reason === "not_approved") show("invalid")
    },
  })
}

main()
