import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  logLevel: 'error',
  server: {
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@napi-rs/canvas': path.resolve(__dirname, './src/lib/noop-canvas.js'),
    },
  },
  define: {
    'process.getBuiltinModule': 'undefined',
  },
  build: {
    rollupOptions: {
      external: [],
    },
  },
  optimizeDeps: {
    exclude: ['@napi-rs/canvas'],
  },
})