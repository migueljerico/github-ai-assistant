import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy /auth/* to Express backend for OAuth.
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Proxy /api/* (Gemini chat + catálogo de modelos) al Express local.
      // Sin esto, en dev `fetch('/api/gemini/models')` cae en Vite y no llega
      // al backend (#58 hotfix v3.23.2). En prod Express sirve ambos orígenes.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
