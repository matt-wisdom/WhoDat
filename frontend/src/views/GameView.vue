<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';
import { useAuth0 } from '@auth0/auth0-vue';

const { getAccessTokenSilently } = useAuth0();
const message = ref('');
const response = ref('');

const startGame = async () => {
  try {
    const token = await getAccessTokenSilently();
    const res = await axios.post('/api/game/start', {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    response.value = res.data.message;
  } catch (error) {
    console.error(error);
    response.value = 'Error starting game';
  }
};
</script>

<template>
  <div class="game">
    <h1>Game Board</h1>
    <button @click="startGame">Start New Game</button>
    <p>{{ response }}</p>
  </div>
</template>

<style scoped>
.game {
  padding: 2rem;
}
</style>
