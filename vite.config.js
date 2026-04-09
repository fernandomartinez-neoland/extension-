import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

const CSP_DEV  = "script-src 'self' http://localhost:5173; style-src 'self' 'unsafe-inline'; object-src 'none'; img-src 'self' data: https://lh3.googleusercontent.com; connect-src https://www.googleapis.com https://oauth2.googleapis.com ws://localhost:5173 http://localhost:5173;"
const CSP_PROD = "script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; img-src 'self' data: https://lh3.googleusercontent.com; connect-src https://www.googleapis.com https://oauth2.googleapis.com;"

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'

  const manifestWithCSP = {
    ...manifest,
    content_security_policy: {
      extension_pages: isDev ? CSP_DEV : CSP_PROD,
    },
  }

  return {
    plugins: [
      react(),
      crx({ manifest: manifestWithCSP }),
    ],
    server: {
      port: 5173,
      strictPort: true,
      hmr: {
        port: 5173,
      },
    },
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
    },
  }
})
