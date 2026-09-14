import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// GitHub Pages 專案頁部署於 https://cygstudio.github.io/art-exhibition-space/
// build 時需指向子路徑；dev server 維持根路徑。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/art-exhibition-space/' : '/',
  server: {
    allowedHosts: ['mini'],
  },
  build: {
    rolldownOptions: {
      input: {
        exhibition: resolve(import.meta.dirname, 'index.html'),
        tracker: resolve(import.meta.dirname, 'tracker.html'),
      },
    },
  },
}))
