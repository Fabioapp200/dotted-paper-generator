import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    watch: process.env.VITE_POLL ? { usePolling: true, interval: 300 } : undefined,
  },
})
