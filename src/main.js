import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initGtag } from './boot/init-gtag.js'
import { initActivityLocale, getActivityLocaleDiagnostics } from './lib/i18n/activity-locale.js'
import { readPostReloadPath } from './lib/reload-activity-page.js'

if (typeof window !== 'undefined') {
  window.__activityLocaleDebug = getActivityLocaleDiagnostics
}

initActivityLocale()
  .then(() => {
    initGtag()
    const pendingPath = readPostReloadPath()
    createApp(App).use(router).mount('#app')
    if (pendingPath) {
      void router.replace(pendingPath)
    }
  })
  .catch((error) => {
    console.error('[ADActivityWeb] Failed to initialize locale', error)
    initGtag()
    const pendingPath = readPostReloadPath()
    createApp(App).use(router).mount('#app')
    if (pendingPath) {
      void router.replace(pendingPath)
    }
  })
