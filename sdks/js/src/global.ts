// Entry for the <script> bundle: `window.PairMesh` is the client class, with
// the rest of the SDK attached, e.g. `new PairMesh({ url })` and
// `PairMesh.gamepad.controller(session, element)`.
import { PairMesh } from "./client"
import { PairMeshError } from "./errors"
import { buildJoinUrl, parseJoinUrl, withoutSecret } from "./join-url"
import * as gamepad from "./plugins/gamepad"
import { Pairing, Session } from "./session"
import { defaultStore, memoryStore } from "./storage"

export default Object.assign(PairMesh, {
  PairMesh,
  PairMeshError,
  Pairing,
  Session,
  gamepad,
  buildJoinUrl,
  parseJoinUrl,
  withoutSecret,
  memoryStore,
  defaultStore,
})
