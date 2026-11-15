import { defineConfig } from "vitest/config"

// Runs against a live server: PAIRMESH_URL=http://localhost:4000 npm run test:integration
export default defineConfig({ test: { include: ["test/integration/**/*.test.ts"], testTimeout: 10_000 } })
