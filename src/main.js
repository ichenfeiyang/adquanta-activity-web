import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initGtag } from './boot/init-gtag.js'
import { initActivityLocale, getActivityLocaleDiagnostics } from './lib/i18n/activity-locale.js'
import { readPostReloadPath } from './lib/reload-activity-page.js'

if (typeof window !== 'undefined') {
  window.__activityLocaleDebug = getActivityLocaleDiagnostics
}

/**
 * Resolve post-locale-reload route before the first page mount so ActivityCenter
 * (and its ad callback registration) is not created twice.
 */
async function mountApp() {
  const pendingPath = readPostReloadPath()
  const app = createApp(App).use(router)
  await router.isReady()
  if (pendingPath && router.currentRoute.value.fullPath !== pendingPath) {
    await router.replace(pendingPath)
  }
  app.mount('#app')
}

async function bootstrap() {
  initGtag()
  try {
    await initActivityLocale()
  } catch (error) {
    console.error('[ADActivityWeb] Failed to initialize locale', error)
  }
  await mountApp()
}

void bootstrap()
