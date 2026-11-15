import { resolve } from "node:path"
import { defineConfig } from "vite"

export default defineConfig({
  // Listen on the LAN so a phone can open the pad page.
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    rollupOptions: {
      input: {
        host: resolve(import.meta.dirname, "index.html"),
        pad: resolve(import.meta.dirname, "pad.html"),
      },
    },
  },
})
