import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import node from "@astrojs/node"
export default defineConfig({
  output: "server",
  security: {
    allowedDomains: [
      { protocol: "http", hostname: "127.0.0.1", port: "4185" },
      { protocol: "http", hostname: "127.0.0.1", port: "4186" },
      { protocol: "http", hostname: "localhost", port: "4185" },
      { protocol: "http", hostname: "localhost", port: "4186" },
    ],
  },
  devToolbar: { enabled: false },
  adapter: node({ mode: "standalone" }),
  vite: { plugins: [tailwindcss()] },
  integrations: [react()],
  server: { host: "127.0.0.1", port: 4185 },
})
