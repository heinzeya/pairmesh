# Presentation example

A phone becomes a slide remote for a laptop, using the PairMesh JavaScript SDK
(`sdks/js`) and the `presentation` plugin.

- `index.html` / `src/host.js`: the presenter. It shows the deck and the QR
  code, approves the phone, moves slides on `slide.next` / `slide.previous`,
  and announces the current slide with `slide.changed`. Arrow keys work too.
- `remote.html` / `src/remote.js`: the phone. It joins from the QR code and
  sends `slide.next` / `slide.previous`.

## Run it

```sh
# 1. PairMesh server (repo root). Dev config allows any origin.
mix phx.server

# 2. SDK build (the example depends on sdks/js via file:)
cd sdks/js && npm install && npm run build

# 3. This example
cd examples/presentation && npm install && npm run dev
```

Open the **Network** URL Vite prints (e.g. `http://192.168.1.20:5173`) on the
laptop, not `localhost`, so the QR code points at an address the phone can
reach. Both devices must be on the same network.

The pages talk to the server on port 4000 of the same host. To use another
server, set `VITE_PAIRMESH_URL=https://pairmesh.example.com npm run dev`; in
production, add this app's origin to `PAIRMESH_ALLOWED_ORIGINS` on the server.
