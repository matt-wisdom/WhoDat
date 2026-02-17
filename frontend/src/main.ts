import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { createAuth0 } from '@auth0/auth0-vue'
import './style.css'
import App from './App.vue'

// Import views (to be created)
import HomeView from './views/HomeView.vue'
import GameView from './views/GameView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/game', component: GameView }
  ]
})

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(
  createAuth0({
    domain: import.meta.env.VITE_AUTH0_DOMAIN || 'YOUR_DOMAIN',
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || 'YOUR_CLIENT_ID',
    authorizationParams: {
      redirect_uri: window.location.origin
    }
  })
)

app.mount('#app')
