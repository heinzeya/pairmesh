export const slides = [
  {
    section: "Introduction",
    title: "Welcome to PairMesh",
    body: "Connect two browsers with QR pairing",
  },
  {
    section: "Step 1",
    title: "pairing.create",
    body: "The laptop asks PairMesh for a short-lived pairing and shows it as a QR code",
  },
  {
    section: "Step 2",
    title: "pairing.claim",
    body: "The phone scans the code and claims the pairing with its one-time secret",
  },
  {
    section: "Step 3",
    title: "pairing.approve",
    body: "The laptop sees pairing.requested and approves the device it expects",
  },
  {
    section: "Step 4",
    title: "slide.next",
    body: "Approved devices send plugin commands, relayed to everyone in the session",
  },
]
