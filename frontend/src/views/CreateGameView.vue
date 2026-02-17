<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { useUser } from '@clerk/vue';

const router = useRouter();
const store = useGameStore();
const { user } = useUser();

const isPublic = ref(false);
const isLoading = ref(false);

const handleCreate = async () => {
  if (!user.value) return;
  
  isLoading.value = true;
  const playerName = user.value.firstName || 'Player';
  
  const roomId = await store.createRoom(playerName, isPublic.value);
  isLoading.value = false;
  
  router.push(`/lobby/${roomId}`);
};
</script>

<template>
  <div class="create-game">
    <h2>Create New Game</h2>
    
    <div class="options">
      <div class="option" :class="{ active: !isPublic }" @click="isPublic = false">
        <h3>Private Room</h3>
        <p>Invite friends via link or user ID.</p>
      </div>
      
      <div class="option" :class="{ active: isPublic }" @click="isPublic = true">
        <h3>Public Room</h3>
        <p>Anyone can see and join this room.</p>
      </div>
    </div>
    
    <div class="actions">
      <button @click="handleCreate" :disabled="isLoading">
        {{ isLoading ? 'Creating...' : 'Create Room' }}
      </button>
      <router-link to="/">
        <button class="secondary">Cancel</button>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.create-game {
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
}

.options {
  display: flex;
  gap: 1rem;
  margin: 2rem 0;
  justify-content: center;
}

.option {
  border: 2px solid #ccc;
  border-radius: 8px;
  padding: 1.5rem;
  cursor: pointer;
  flex: 1;
  transition: all 0.2s;
  background: white;
  color: black;
}

.option:hover {
    border-color: #666;
}

.option.active {
  border-color: #4CAF50;
  background-color: #e8f5e9;
}

.actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

button {
  padding: 0.8rem 2rem;
  font-size: 1.1rem;
  cursor: pointer;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

button.secondary {
  background-color: #999;
}
</style>
