import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiOrigin = (() => {
    try {
      return new URL(env.VITE_ACTIVITY_API_BASE_URL || '').origin
    } catch (_) {
      return ''
    }
  })()

  return {
    // Relative base for bucket-root static hosting (R2 / TOS).
    base: './',
    plugins: [
      vue(),
      {
        name: 'inject-api-preconnect',
        transformIndexHtml(html) {
          if (!apiOrigin) return html
          const tags = [
            `<link rel="dns-prefetch" href="${apiOrigin}" />`,
            `<link rel="preconnect" href="${apiOrigin}" crossorigin />`,
          ].join('\n    ')
          return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    ${tags}`)
        },
      },
    ],
    build: {
      target: 'es2020',
      modulePreload: { polyfill: false },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/vue/') || id.includes('node_modules/@vue/')) {
              return 'vue-vendor'
            }
            if (id.includes('node_modules/vue-router')) {
              return 'vue-vendor'
            }
            if (
              id.includes('/lib/activity-api') ||
              id.includes('/lib/activity-page-cache') ||
              id.includes('/lib/activity-session') ||
              id.includes('/lib/activity-auth') ||
              id.includes('/lib/activity-cache-fingerprints')
            ) {
              return 'activity-core'
            }
          },
        },
      },
    },
  }
})
