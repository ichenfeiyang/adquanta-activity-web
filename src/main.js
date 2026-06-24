import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initGtag } from './boot/init-gtag.js'

initGtag()

createApp(App).use(router).mount('#app')
