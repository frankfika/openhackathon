import { readFileSync, existsSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    traeBadgePlugin({
      variant: 'dark',
      position: 'bottom-right',
      prodOnly: true,
      clickable: true,
      clickUrl: 'https://www.trae.ai/solo?showJoin=1',
      autoTheme: true,
      autoThemeTarget: '#root'
    }), 
    tsconfigPaths(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (
            id.includes('/node_modules/react/')
            || id.includes('/node_modules/react-dom/')
            || id.includes('/node_modules/react-router-dom/')
          ) {
            return 'react-vendor'
          }
          if (id.includes('@tanstack/react-query')) {
            return 'query-vendor'
          }
          if (id.includes('i18next') || id.includes('react-i18next')) {
            return 'i18n-vendor'
          }
          if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('framer-motion')) {
            return 'ui-vendor'
          }
          if (id.includes('zod')) {
            return 'validation-vendor'
          }
          return undefined
        },
      },
    },
  },
  server: {
    host: true,
    https: existsSync('./localhost+1.pem')
      ? { cert: readFileSync('./localhost+1.pem'), key: readFileSync('./localhost+1-key.pem') }
      : undefined,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_URL || 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
