import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy /auth/* to Express backend for OAuth (AI calls go directly to providers)
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
