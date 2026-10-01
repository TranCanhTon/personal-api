import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Where /api goes in dev. Production by default, since that's where the phone sends data.
  // Use the local Docker API instead with API_TARGET=http://localhost:8000 in frontend/.env.local
  const target = loadEnv(mode, process.cwd(), '').API_TARGET || 'https://ton-api.duckdns.org'

  return {
    plugins: [react(), tailwindcss()],
    // ECharts is most of the bundle (~280 kB gzipped in total); fine for a personal dashboard
    build: { chunkSizeWarningLimit: 1000 },
    server: {
      // The site calls /api/...; the dev server passes it on, so no CORS setup is needed.
      // In production nginx will do the same job.
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
