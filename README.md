# PairMesh

Pair two devices with a QR code and send commands between them in real time:
a phone as a slide remote, a phone as a gamepad, a kiosk controlled from a
tablet.

| Path | What |
|---|---|
| `apps/pairmesh_core` | Pairings (create, claim, approve) and the plugin registry. Entry point: `PairMesh.create_pairing/2`. |
| `apps/pairmesh_server` | Phoenix server with an API only: `POST /api/devices` and the `/socket` WebSocket. |
| `plugins/` | Plugins that define the commands a pairing accepts (`presentation`, `gamepad`). |
| `sdks/js` | JavaScript SDK (`@pairmesh/js`). |
| `examples/` | Apps built on the SDK: `presentation`, `gamepad`. |
| `docs/protocol.md` | The wire protocol every SDK implements. |

## Quick start

```sh
mix deps.get
mix phx.server                                   # server on :4000

cd sdks/js && npm install && npm run build       # SDK
cd ../../examples/presentation && npm install && npm run dev
```

Open the Network URL that Vite prints and scan the QR code with your phone.

## Tests

```sh
MIX_ENV=test mix precommit                       # server
(cd apps/pairmesh_core && mix test)              # core and plugins
(cd sdks/js && npm test)                         # SDK unit tests
PAIRMESH_URL=http://localhost:4000 npm --prefix sdks/js run test:integration
```
