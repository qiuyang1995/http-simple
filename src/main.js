import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'
import App from './App.vue'

const app = createApp(App)

app.use(ElementPlus)
app.use(VueJsonPretty)

app.mount('#app')