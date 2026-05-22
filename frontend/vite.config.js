import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In Docker Compose the API container is reachable at http://api:8000.
// Locally it's http://localhost:8000.
// Set VITE_API_URL in the service's environment block to override.
const API_TARGET = process.env.VITE_API_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,   // needed so Docker port-binding works (0.0.0.0)
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
})
