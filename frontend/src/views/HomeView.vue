<script setup lang="ts">
import { onMounted, computed, ref } from 'vue';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from '@clerk/vue';
import { useGameStore } from '../stores/game';
import { useRouter } from 'vue-router';

const { user } = useUser();
const store = useGameStore();
const router = useRouter();

const publicRooms = computed(() => store.publicRooms);

onMounted(() => {
    store.connect(); // Ensure connection
    store.getPublicRooms();
});

const joinRoom = async (roomId: string) => {
    if (!user.value) return;
    const success = await store.joinRoom(roomId, user.value.firstName || 'Player');
    if (success) {
        router.push(`/lobby/${roomId}`);
    }
    if (success) {
        router.push(`/lobby/${roomId}`);
    }
};

const copied = ref(false);
const copyToClipboard = () => {
    if (user.value?.id) {
        navigator.clipboard.writeText(user.value.id);
        copied.value = true;
        setTimeout(() => copied.value = false, 2000);
    }
};
</script>

<template>
  <div class="home">
    <h1>Welcome to Guess Who AI</h1>
    <SignedOut>
      <SignInButton />
    </SignedOut>
    <SignedIn>
      <h2>Hello, {{ user?.firstName }}</h2>
      <h2>Hello, {{ user?.firstName }}</h2>
      
      <div class="user-id-container" @click="copyToClipboard">
        <span class="label">Your ID:</span>
        <code class="id-text">{{ user?.id }}</code>
        <span class="copy-btn">{{ copied ? 'Copied!' : 'Copy' }}</span>
      </div>

      <UserButton />
      
      <div class="actions">
        <router-link to="/create">
            <button class="primary">Create New Game</button>
        </router-link>
      </div>

      <div class="public-games" v-if="publicRooms.length">
        <h3>Public Games</h3>
        <ul>
            <li v-for="room in publicRooms" :key="room.id">
                <span>Room {{ room.id }} ({{ JSON.parse(room.players_json).length }} players)</span>
                <button @click="joinRoom(room.id)" class="small">Join</button>
            </li>
        </ul>
      </div>
      <div v-else class="no-games">
        <p>No public games available.</p>
      </div>
    </SignedIn>
  </div>
</template>

<style scoped>
.home {
  text-align: center;
  padding: 2rem;
}
button {
  margin: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 1rem;
  cursor: pointer;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
}
button.primary {
    font-size: 1.2rem;
    padding: 1rem 2rem;
}
button.small {
    padding: 0.3rem 0.8rem;
    font-size: 0.9rem;
}
.public-games {
    margin-top: 3rem;
    text-align: left;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
}
.public-games ul {
    list-style: none;
    padding: 0;
}
.public-games li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f5f5f5;
    margin: 0.5rem 0;
    padding: 1rem;
    border-radius: 4px;
    color: #333;
}
.no-games {
    margin-top: 2rem;
    color: #666;
}

.user-id-container {
    margin: 1.5rem auto;
    display: inline-flex;
    align-items: center;
    gap: 0.8rem;
    background: white;
    padding: 0.8rem 1.5rem;
    border-radius: 50px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
    border: 1px solid #eaeaea;
    cursor: pointer;
    transition: all 0.2s ease;
    max-width: 100%;
}

.user-id-container:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.08);
    border-color: #4CAF50;
}

.label {
    font-weight: 500;
    color: #888;
    font-size: 0.9rem;
}

.id-text {
    font-family: 'Courier New', monospace;
    font-size: 1rem;
    color: #333;
    font-weight: 600;
}

.copy-btn {
    font-size: 0.8rem;
    color: #4CAF50;
    font-weight: 600;
    background: #e8f5e9;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
}
</style>
