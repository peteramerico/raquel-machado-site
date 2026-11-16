/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // dev: o backend (docker em produção) roda em :3337; o navegador fala só com o Vite (mesma origem)
    proxy: { '/api': 'http://localhost:3337' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
})
