# Gamepad example

A phone becomes a gamepad for a laptop, using the PairMesh JavaScript SDK
(`sdks/js`) and the `gamepad` plugin.

- `index.html` / `src/host.js`: the laptop. It creates a pairing, shows the
  QR code, approves the phone and mirrors its input with `gamepad.track()`.
- `pad.html` / `src/pad.js`: the phone. It joins from the QR code and binds
  the on-screen controls with `gamepad.controller()`.

## Run it

```sh
# 1. PairMesh server (repo root). Dev config allows any origin.
mix phx.server

# 2. SDK build (the example depends on sdks/js via file:)
cd sdks/js && npm install && npm run build

# 3. This example
cd examples/gamepad && npm install && npm run dev
```

Open the **Network** URL Vite prints (e.g. `http://192.168.1.20:5173`) on the
laptop, not `localhost`, so the QR code points at an address the phone can
reach. Both devices must be on the same network.

The pages talk to the server on port 4000 of the same host. To use another
server, set `VITE_PAIRMESH_URL=https://pairmesh.example.com npm run dev`; in
production, add this app's origin to `PAIRMESH_ALLOWED_ORIGINS` on the server.
