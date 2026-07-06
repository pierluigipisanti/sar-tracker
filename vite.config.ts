import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function removeCrossOriginAndModule(): Plugin {
  return {
    name: 'remove-crossorigin-and-module',
    transformIndexHtml(html) {
      return html
        .replace(/ crossorigin/g, '')
        .replace(/ type="module"/g, ' defer')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), removeCrossOriginAndModule()],
  base: './',
  build: {
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
  },
})
