import { defineConfig } from 'vite'

// GitHub Pages 專案頁部署於 https://cygstudio.github.io/art-exhibition-space/
// build 時需指向子路徑；dev server 維持根路徑。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/art-exhibition-space/' : '/',
  server: {
    allowedHosts: ['mini'],
  },
}))
