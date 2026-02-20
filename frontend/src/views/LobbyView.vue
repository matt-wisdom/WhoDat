<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { useUser } from '@clerk/vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';

const store = useGameStore();
const route = useRoute();
const router = useRouter();

const roomId = route.params.roomId as string;
const players = computed(() => store.players);
// Fix: Ensure store.players is accessed safely
const isHost = computed(() => store.players.length > 0 && store.players[0]?.id === store.myId);

const startGame = () => {
  store.startGame();
};

const inviteTarget = ref('');
const inviteStatus = ref('');
const { user } = useUser();

const handleInvite = async () => {
    if (!inviteTarget.value) return;
    inviteStatus.value = 'Sending...';
    try {
        const res = await store.invitePlayer(inviteTarget.value, user.value?.firstName || 'Friend');
        inviteStatus.value = res.message;
    } catch (e) {
        inviteStatus.value = 'Failed to send invite.';
    }
};

const selectedPersona = ref('standard');
const addBot = async () => {
    inviteStatus.value = 'Adding Bot...';
    try {
        await store.addAIPlayer(selectedPersona.value);
        inviteStatus.value = 'Bot added!';
        setTimeout(() => inviteStatus.value = '', 2000);
    } catch (e: any) {
        inviteStatus.value = `Failed to add bot: ${e.message || e}`;
    }
};

const checkGameState = () => {
    if (store.gameState === 'PLAYING') {
        router.push(`/game/${roomId}`);
    }
};

watch(() => store.gameState, (newState) => {
    if (newState === 'PLAYING') {
        router.push(`/game/${roomId}`);
    }
});

onMounted(async () => {
    // If we have a roomId but no players/state (likely refresh), try to rejoin
    if (roomId && (!store.players.length || store.roomId !== roomId)) {
        console.log('Refreshing or direct link: joining room', roomId);
        // Ensure connection first
        await store.connect();
        
        // Wait a brief moment for socket to be ready if needed, though connect() should handle it
        // The joinRoom action in store handles the emit
        const success = await store.joinRoom(roomId, user.value?.fullName || 'Returning Player');
        if (!success) {
            alert('Failed to rejoin room. It may have expired.');
            router.push('/');
        }
    }
    checkGameState();
});
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

    <!-- AI Section Moved Up -->
    <div class="ai-section">
        <h3>Add Bot Player</h3>
        <div class="ai-controls">
            <select v-model="selectedPersona">
                <option value="standard">Standard AI</option>
                <option value="sherlock">Sherlock (Logical)</option>
                <option value="joker">Joker (Chaotic)</option>
                <option value="toddler">Toddler (Simple)</option>
            </select>
            <button @click="addBot" :disabled="!selectedPersona || inviteStatus === 'Adding Bot...'">Add Bot</button>
        </div>
        <p v-if="inviteStatus && inviteStatus.includes('Bot')">{{ inviteStatus }}</p>
    </div>

    <div v-if="isHost" class="controls">
      <button @click="startGame" :disabled="players.length < 2">Start Game</button>
      <p v-if="players.length < 2">Need at least 2 players</p>
    </div>
    <div v-else>
      <p>Waiting for host to start...</p>
    </div>
    
    <div class="invite-section">
        <h3>Invite Friend</h3>
        <p>Share Room Code: <strong>{{ roomId }}</strong></p>
        <div class="invite-form">
            <input v-model="inviteTarget" placeholder="User ID to invite" />
            <button @click="handleInvite">Send Invite</button>
        </div>
        <p v-if="inviteStatus && !inviteStatus.includes('Bot')">{{ inviteStatus }}</p>
    </div>
  </div>
</template>

<style scoped>
.lobby {
  text-align: center;
  color: var(--text-primary);
}
ul {
  list-style: none;
  padding: 0;
}
li {
  font-size: 1.2rem;
  margin: 0.5rem 0;
  background: var(--surface-color);
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}
.controls {
  margin-top: 2rem;
}
.invite-section {
    margin-top: 2rem;
    padding: 1rem;
    border-top: 1px solid var(--border-color);
}
.invite-form {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1rem;
}
input {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-color);
    color: var(--text-primary);
}
button {
    padding: 0.5rem 1rem;
    background: var(--primary-color);
    color: black;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
}
button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
.ai-section {
    margin-top: 2rem;
    padding: 1rem;
    border-top: 1px solid var(--border-color);
}
.ai-controls {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 1rem;
}
select {
    padding: 0.5rem;
    background: var(--bg-color);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
}
</style>
