<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useGameStore } from './stores/game';
import { useUser } from '@clerk/vue';

const store = useGameStore();
const { user } = useUser();

onMounted(() => {
  store.connect();
  if (user.value?.id) {
    store.registerUser(user.value.id);
  }
});

watch(user, (newUser) => {
  if (newUser?.id) {
    store.registerUser(newUser.id);
  }
});
</script>

<template>
  <div class="container">
    <router-view></router-view>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;600;700&family=Orbitron:wght@400;700;900&display=swap');

/* Global Dark Theme */
:root {
  --bg-color: #0f172a; /* Deep blue-black */
  --surface-color: #1e293b;
  --surface-hover: #334155;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --border-color: #475569;
  --primary-color: #10b981; /* Emerald */
  --accent-color: #3b82f6; /* Blue */
  --error-color: #ef4444;
  
  --font-display: 'Orbitron', sans-serif;
  --font-body: 'Chakra Petch', sans-serif;
  
  --shadow-sm: 0 2px 0 rgba(0,0,0,0.5);
  --shadow-md: 0 4px 0 rgba(0,0,0,0.5);
}

body {
  background-color: var(--bg-color);
  background-image: 
    radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 30px 30px;
  color: var(--text-primary);
  margin: 0;
  font-family: var(--font-body);
}

a {
  color: var(--accent-color);
  text-decoration: none;
}

button {
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 1px;
  border-bottom: 4px solid rgba(0,0,0,0.4) !important;
  transition: all 0.1s;
}
button:active {
    transform: translateY(2px);
    border-bottom-width: 2px !important;
}

h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-display);
}
</style>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}
</style>
