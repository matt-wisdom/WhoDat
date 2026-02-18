<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { useUser } from '@clerk/vue';

const router = useRouter();
const store = useGameStore();
const { user } = useUser();

const isPublic = ref(false);
const selectedCategory = ref('People');
const categories = ['People', 'Animals', 'Countries', 'Places'];
const isLoading = ref(false);

const handleCreate = async () => {
  if (!user.value) return;
  
  isLoading.value = true;
  const playerName = user.value.firstName || 'Player';
  
  const roomId = await store.createRoom(playerName, selectedCategory.value, isPublic.value);
  isLoading.value = false;
  
  router.push(`/lobby/${roomId}`);
};
</script>

<template>
  <div class="create-game">
    <h2>Create New Game</h2>
    
    <div class="options">
      <!-- Category Selection -->
      <div class="category-selection">
          <h3>Select Category</h3>
          <div class="category-grid">
              <div 
                v-for="cat in categories" 
                :key="cat" 
                class="category-card"
                :class="{ active: selectedCategory === cat }"
                @click="selectedCategory = cat"
              >
                {{ cat }}
              </div>
          </div>
      </div>
    
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
  color: var(--text-primary);
}

.options {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin: 2rem 0;
  justify-content: center;
}

.category-selection {
    text-align: left;
}

.category-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-top: 0.5rem;
}

.category-card {
    border: 1px solid var(--border-color);
    padding: 1rem;
    border-radius: 8px;
    background: var(--surface-color);
    cursor: pointer;
    text-align: center;
    font-weight: bold;
    transition: all 0.2s;
}

.category-card:hover {
    border-color: var(--primary-color);
    transform: translateY(-2px);
}

.category-card.active {
    background: var(--primary-color);
    color: #0f172a;
    border-color: var(--primary-color);
}

.option {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.5rem;
  cursor: pointer;
  flex: 1;
  transition: all 0.2s;
  background: var(--surface-color);
  color: var(--text-primary);
}

.option:hover {
    border-color: var(--primary-color);
    background: var(--surface-hover);
}

.option.active {
  border-color: var(--primary-color);
  background-color: rgba(16, 185, 129, 0.1); /* transparent primary */
}

h3 {
    margin-top: 0;
    color: var(--text-primary);
}
p {
    color: var(--text-secondary);
    font-size: 0.9rem;
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
  background-color: var(--primary-color);
  color: black;
  border: none;
  border-radius: 4px;
  font-weight: 600;
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

button.secondary {
  background-color: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}
button.secondary:hover {
    color: var(--text-primary);
    border-color: var(--text-primary);
}
</style>
