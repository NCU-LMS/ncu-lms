import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './api/client.js'
import './assets/main.css'

import { vNoCopy } from './directives/vNoCopy.js'
import { initActivityTracker } from './utils/activityTracker.js'

const app = createApp(App)
app.directive('no-copy', vNoCopy)
app.use(router)

initActivityTracker({ router })

app.mount('#app')
