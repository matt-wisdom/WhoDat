<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useGameStore } from '../stores/game';

const store = useGameStore();
const route = useRoute();

const roomId = route.params.roomId as string;
const players = computed(() => store.players);
// Fix: Ensure store.players is accessed safely
const isHost = computed(() => store.players.length > 0 && store.players[0]?.id === store.myId);

const startGame = () => {
  store.startGame();
};
</script>

<template>
  <div class="lobby">
    <h2>Lobby: {{ roomId }}</h2>
    
    <div class="players">
      <h3>Players</h3>
      <ul v-if="players.length">
        <li v-for="player in players" :key="player.id">
          {{ player.name }} <span v-if="player.id === store.myId">(You)</span>
        </li>
      </ul>
      <p v-else>Loading players...</p>
    </div>

    <div v-if="isHost" class="controls">
      <button @click="startGame" :disabled="players.length < 2">Start Game</button>
      <p v-if="players.length < 2">Need at least 2 players</p>
    </div>
    <div v-else>
      <p>Waiting for host to start...</p>
    </div>
  </div>
</template>

<style scoped>
.lobby {
  text-align: center;
}
ul {
  list-style: none;
  padding: 0;
}
li {
  font-size: 1.2rem;
  margin: 0.5rem 0;
}
.controls {
  margin-top: 2rem;
}
</style>
