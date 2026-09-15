import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve('src/renderer'),
  base: './',
  plugins: [react(), {
    name: 'development-csp',
    transformIndexHtml(html, context) {
      // The React refresh preamble is inline in development only.
      return context.server ? html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'") : html;
    },
  }],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { outDir: resolve('dist/renderer'), emptyOutDir: true },
});
