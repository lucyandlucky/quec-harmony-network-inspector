import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  root: 'src',
  base: './',
  build: {
    outDir: '../dist-renderer',
    emptyOutDir: true,
    assetsInlineLimit: 0
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true
  },
  plugins: command === 'serve' ? [{
    name: 'development-csp',
    transformIndexHtml(html: string): string {
      return html.replace("style-src 'self';", "style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:5173;")
    }
  }] : []
}))
