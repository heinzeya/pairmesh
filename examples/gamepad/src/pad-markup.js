// Gamepad layout shared by the host display and the phone controls. Buttons
// carry data-button and sticks data-stick, which is what
// gamepad.controller() from @pairmesh/js binds to on the phone.

const chevron = (d) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="${d}"/></svg>`

const ARROWS = {
  up: chevron("m4.5 15.75 7.5-7.5 7.5 7.5"),
  down: chevron("m19.5 8.25-7.5 7.5-7.5-7.5"),
  left: chevron("M15.75 19.5 8.25 12l7.5-7.5"),
  right: chevron("m8.25 4.5 7.5 7.5-7.5 7.5"),
}

export function renderPad(root, { controls }) {
  // The host only displays state, so its buttons are not focusable controls.
  const tag = controls ? "button" : "span"
  const button = (name, label, extra = "") =>
    `<${tag} ${controls ? 'type="button"' : ""} class="pad-btn pad-${name} ${extra}" data-button="${name}" aria-label="${name}">${label}</${tag}>`
  const stick = (name) =>
    `<div class="stick" data-stick="${name}" aria-label="${name} stick"><span class="stick-knob"></span></div>`

  root.classList.add("gamepad", controls ? "gamepad-controller" : "gamepad-display")
  root.innerHTML = `
    <div class="gamepad-row">
      ${button("l", "L", "pad-shoulder")}
      ${button("select", "Select", "pad-small")}
      ${button("start", "Start", "pad-small")}
      ${button("r", "R", "pad-shoulder")}
    </div>
    <div class="gamepad-row">
      <div class="pad-cluster pad-dpad">
        ${["up", "left", "right", "down"].map((name) => button(name, ARROWS[name])).join("")}
      </div>
      <div class="pad-cluster pad-face">
        ${["y", "x", "b", "a"].map((name) => button(name, name.toUpperCase())).join("")}
      </div>
    </div>
    <div class="gamepad-row">${stick("left")}${stick("right")}</div>`
}
