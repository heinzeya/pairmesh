# PairMesh protocol, version 1

This is the contract every PairMesh SDK implements. A client talks to a
PairMesh server in two ways: one HTTP call to get a device identity, then a
[Phoenix Channels](https://hexdocs.pm/phoenix/channels.html) WebSocket for
everything else.

Terms used below:

- **Owner**: the device that creates a pairing, e.g. a laptop showing a QR code.
- **Claimant**: the device that claims it with the secret, e.g. a phone.
- **Participant**: the owner, or a claimant that has been approved.

## 0. Server info

`GET /` returns `{"name": "PairMesh", "protocols": ["1"], "plugins": [...], "docs": ...}`.
`GET /api/health` returns `{"status": "ok"}`.

## 1. Device identity

```http
POST /api/devices
Content-Type: application/json

{}
```

```http
201 Created

{"device_id": "Yq3…", "token": "SFMy…"}
```

- The token is valid for **30 days**. Clients store it (the JS SDK uses
  `localStorage`) and reuse it, because the pairing system recognises devices
  by `device_id`. A device that keeps its token can rejoin its pairings
  without the secret.
- A token grants nothing by itself. It only identifies the device.
- Browsers on other origins may call this endpoint if their origin is
  allowed (see [Origins](#origins)). Preflight `OPTIONS` requests are
  answered.

## 2. Connecting

```
GET /socket/websocket?vsn=2.0.0&token=<token>&protocol=1
```

| Param | Meaning |
|---|---|
| `vsn` | Phoenix serializer version. Always `2.0.0` (the official Phoenix clients send it). |
| `token` | From `POST /api/devices`. |
| `protocol` | This document's version. A missing value means `1`; an unknown value is refused. |

A refused connection (bad token, unknown protocol or disallowed origin) gets
HTTP **403** and no reason. Clients should register a new device once and
retry. If that also fails, report `connect_failed`.

Messages use the Phoenix v2 JSON format:
`[join_ref, ref, topic, event, payload]`. Clients send a `heartbeat` on the
`phoenix` topic every 30 s. Replies to a push arrive as `phx_reply` with
`{"status": "ok" | "error", "response": {...}}`. Error responses always have
a `reason` string.

## 3. Pairing flow

```
Owner                                  Server                                 Claimant
  | join session:lobby                   |                                       |
  | push pairing.create {plugin}  ─────► |                                       |
  | ◄── {pairing_id, secret, plugin, expires_at}                                 |
  | join session:<pairing_id>  ────────► |                                       |
  |                                      |   (QR: join URL with id + secret)     |
  |                                      | ◄──── join session:<id> {secret}      |
  | ◄──────── pairing.requested ───────  | ───── reply {status: "claimed"} ────► |
  | push pairing.approve  ─────────────► |                                       |
  | ◄──────── pairing.approved ────────  | ─────── pairing.approved ───────────► |
  |                                      | ◄──── push gamepad.button.down {…}    |
  | ◄─────── gamepad.button.down ──────  | ─────── gamepad.button.down ────────► |
```

### `session:lobby`

Any connected device may join. Only one event is accepted here:

**`pairing.create`** `{"plugin": "presentation" | "gamepad" | …}`

- ok: `{"pairing_id", "secret", "plugin", "expires_at"}`. `expires_at` is
  Unix seconds, 5 minutes from now. The pairing must be claimed and approved
  before then.
- error: `unknown_plugin` (missing or not enabled).

Any other event in the lobby gets the error `unknown_event`.

### `session:<pairing_id>`

**Join** with `{}` (owner or existing claimant) or `{"secret": "<secret>"}`
(first claim). Joining with a valid secret **is** the claim: it works once,
before expiry, and not for the owner.

- ok: `{"status": "pending" | "claimed" | "approved", "plugin": "…", "role": "owner" | "claimant"}`
- error: `unauthorized` (unknown pairing, wrong, used or expired secret, or
  not a member).

Phoenix clients rejoin automatically after a reconnect, using the same reply
format. Because of that, a device that missed broadcasts (e.g. the phone
reloaded after approval) still learns the current `status`.

**Pushes**

| Event | Who | Reply |
|---|---|---|
| `pairing.approve` `{}` | owner, while `claimed` and unexpired | ok `{}` · error `not_allowed` |
| `<plugin command>` `{…}` | participants | ok: the plugin's event, e.g. `{"event": "gamepad.button.down", "button": "a"}` · error `not_approved`, `forbidden` (not a command of this pairing's plugin), `invalid_payload`, … |
| `relay` `{…}` | participants | no reply; sent to the other participants as `relay` |
| `ping` `{…}` | members | ok: the same payload |

**Broadcasts** (sent to everyone who joined the topic)

| Event | Payload |
|---|---|
| `pairing.requested` | `{"device_id"}`: a device claimed the pairing |
| `pairing.approved` | `{"device_id"}`: the claimant that was approved |
| `<plugin event>` | The plugin's fields plus `"plugin"` and `"device_id"` (the sender) |

A pairing accepts only the commands of the plugin it was created for.

## 4. Join URLs

The owner shows a URL that the other device opens. SDKs put the pairing in
the URL **fragment**, so the secret is never sent to a web server or written
to access logs:

```
https://myapp.com/pad#pairing_id=<pairing_id>&secret=<secret>
```

After a successful claim, clients should remove `secret` from the address bar
and keep `pairing_id`, so a reload can rejoin. The server has no pages of its
own: apps host the join page (see `examples/`).

## 5. Plugins

### `presentation`

| Command | Payload | Event |
|---|---|---|
| `slide.next` | `{}` | `slide.next` |
| `slide.previous` | `{}` | `slide.previous` |
| `slide.changed` | `{"index", "total", "title"}` | same fields; sent by the presenter so remotes can show the current slide. `index` is zero-based and below `total`, `title` ≤ 200 characters |

### `gamepad`

| Command | Payload | Event fields |
|---|---|---|
| `gamepad.button.down` | `{"button"}` | `button` |
| `gamepad.button.up` | `{"button"}` | `button` |
| `gamepad.stick` | `{"stick": "left" \| "right", "x", "y"}` | `stick`, `x`, `y` (floats, capped to -1.0..1.0, y positive downward) |

Buttons: `a b x y up down left right start select l r`. Anything else gets
the error `invalid_payload`.

## Origins

Browsers send an `Origin` header. The server accepts its own host plus the
configured list:

```elixir
config :pairmesh_server, :allowed_origins, ["https://myapp.com"]  # or :all
```

In production, set `PAIRMESH_ALLOWED_ORIGINS="https://a.com,https://b.com"`
(or `*`). Development allows all origins.

## Versioning

Additive changes (new optional fields, plugins or events) keep `protocol=1`.
Anything that breaks an existing client bumps the version. The server then
accepts both versions for a deprecation period
(`PairmeshServerWeb.DeviceSocket.protocols/0`).
