/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// VITE_BASE : '/stella/' pour GitHub Pages, '/' pour Vercel / Netlify / Cloudflare
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_BASE || '/',
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          // Bibliothèques dans des fichiers séparés : mises en cache, pas retéléchargées à chaque mise à jour du site
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined
            if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react'
            if (id.includes('@supabase')) return 'supabase'
            if (/[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion'
            return undefined
          },
        },
      },
    },
    test: {
      environment: 'node',
    },
  }
})
