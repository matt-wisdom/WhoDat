<script setup lang="ts">
import { onMounted } from 'vue';
import { useGameStore } from './stores/game.js';

const store = useGameStore();

onMounted(() => {
  store.connect();
});
</script>

<template>
  <div class="container">
    <router-view></router-view>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}
</style>
