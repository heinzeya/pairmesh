# @pairmesh/js

Pair two browsers with a QR code and send commands between them through a
PairMesh server. The SDK handles device identity, the WebSocket connection,
claiming and approving pairings, and reconnecting.

```sh
npm install @pairmesh/js
```

You can also skip the build step and use the script tag:
`<script src="https://unpkg.com/@pairmesh/js/dist/pairmesh.global.js"></script>`,
which exposes `window.PairMesh`.

## Usage

**Owner** (the screen that shows the QR code):

```js
import { PairMesh } from "@pairmesh/js"

const pm = new PairMesh({ url: "https://pairmesh.example.com" })

const pairing = await pm.createPairing({
  plugin: "presentation",
  joinUrl: "https://myapp.com/remote", // page the phone opens
})

pairing.renderQR(document.querySelector("#qr"))
pairing.on("requested", () => pairing.approve()) // or show an Approve button
pairing.on("slide.next", () => nextSlide())
pairing.on("slide.previous", () => previousSlide())
```

**Other device** (on the `joinUrl` page):

```js
import { PairMesh, withoutSecret } from "@pairmesh/js"

const pm = new PairMesh({ url: "https://pairmesh.example.com" })
const session = await pm.join(location.href)
history.replaceState(null, "", withoutSecret(location.href)) // the secret only works once

await session.whenApproved()
nextButton.onclick = () => session.send("slide.next")
```

Reloading the page rejoins the same pairing: the device identity is kept in
`localStorage` and the URL still has the `pairing_id`.

## API

| | |
|---|---|
| `new PairMesh({ url, storage?, timeout?, fetch?, transport? })` | Client for one server. |
| `pm.createPairing({ plugin, joinUrl })` → `Pairing` | Creates and joins a pairing as its owner. |
| `pm.join(urlOrParams)` → `Session` | Claims (with the secret) or rejoins (without it) a pairing. |
| `pm.on("connected" \| "disconnected", fn)` | Connection state. |
| `pm.disconnect()` | Closes the socket. |
| `session.status` | `"waiting"`, `"requested"`, `"approved"` or `"closed"` |
| `session.on(event, fn)` → `off()` | `"status"`, `"requested"`, `"approved"`, `"disconnected"`, `"closed"`, any plugin event, or `"*"` for every event. |
| `session.send(command, payload?)` | Resolves with the plugin's event. Rejects with a `PairMeshError`. |
| `session.whenApproved()`, `session.leave()` | |
| `pairing.joinUrl`, `pairing.expiresAt`, `pairing.approve()` | Owner only. |
| `pairing.qrSvg(opts?)`, `pairing.renderQR(el, opts?)` | QR code for `joinUrl`. |

A `PairMeshError` has a `reason`: `unauthorized`, `not_approved`,
`forbidden`, `invalid_payload`, `unknown_plugin`, `timeout` or
`connect_failed`.

### Gamepad helpers

```js
import { gamepad } from "@pairmesh/js"

// Phone: <button data-button="a">, <div data-stick="left"><span></span></div>
gamepad.controller(session, document.querySelector("#controls"))

// Owner
gamepad.track(pairing, (state, change) => {
  state.pressed.has("a") // current buttons
  state.sticks.left // { x, y }, each -1..1
})
```

See [`examples/gamepad`](../../examples/gamepad) for a complete app.

## Development

```sh
npm install
npm run typecheck && npm test
npm run build          # dist/: ESM, CJS, types, pairmesh.global.js

# Full flow against a running server (from the repo root: mix phx.server)
PAIRMESH_URL=http://localhost:4000 npm run test:integration
```

The wire protocol is documented in [`docs/protocol.md`](../../docs/protocol.md).
