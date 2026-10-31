import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Read root settings for the proxy only. Never expose them with `define`.
  const env = loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), '')
  const backend = env.BACKEND_URL || `http://127.0.0.1:${env.PORT || '8080'}`

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': backend,
        '/healthz': backend,
        '/slots': backend,
        '/bookings': backend,
        '/reset': backend,
      },
    },
  }
})
