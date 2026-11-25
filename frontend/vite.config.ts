/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  // O build SSR (pré-renderização) só precisa do código: não copiar public/ (fotos grandes, apresentações).
  build: { copyPublicDir: !isSsrBuild },
  server: {
    // dev: o backend (docker em produção) roda em :3337; o navegador fala só com o Vite (mesma origem)
    // changeOrigin: false de propósito — o atalho de string do Vite liga changeOrigin e reescreve o Host,
    // e o backend rejeita POST cujo Origin não bate com o Host (defesa CSRF). Em produção o nginx repassa o Host.
    proxy: { '/api': { target: 'http://localhost:3337', changeOrigin: false } },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
}))
