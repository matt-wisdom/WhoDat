import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import LobbyView from '../views/LobbyView.vue';
import GameView from '../views/GameView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue')
    },
    {
      path: '/lobby/:roomId',
      name: 'lobby',
      component: () => import('../views/LobbyView.vue')
    },
    {
      path: '/game/:roomId',
      name: 'game',
      component: () => import('../views/GameView.vue')
    }
  ]
});

export default router;
