import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom'],
          'vendor-maps':     ['@react-google-maps/api'],
          'vendor-firebase': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          'vendor-framer':   ['framer-motion'],
          'vendor-google-ai':['@google/generative-ai'],
          'vendor-misc':     ['fuse.js', 'canvas-confetti', '@react-oauth/google'],
        }
      }
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    }
  }
})