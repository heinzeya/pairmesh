// The PairMesh server. Defaults to port 4000 on the host this page was opened
// from, so a phone that opened the pad page over the LAN reaches it too.
// Override with VITE_PAIRMESH_URL=https://pairmesh.example.com npm run dev
export const serverUrl =
  import.meta.env.VITE_PAIRMESH_URL || `${location.protocol}//${location.hostname}:4000`
