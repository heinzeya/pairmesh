import { resolve } from "node:path"
import { defineConfig } from "vite"

export default defineConfig({
  // Listen on the LAN so a phone can open the remote page.
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    rollupOptions: {
      input: {
        host: resolve(import.meta.dirname, "index.html"),
        remote: resolve(import.meta.dirname, "remote.html"),
      },
    },
  },
})
