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
    if (roomId && (!store.players.length || store.roomId !== roomId)) {
        console.log('Refreshing or direct link: joining room', roomId);
        await store.connect();
        const success = await store.joinRoom(roomId, user.value?.fullName || 'Returning Player');
        if (!success) {
            inviteStatus.value = 'Failed to rejoin room. It may have expired.';
            setTimeout(() => router.push('/'), 2500);
        }
    }
    checkGameState();
});

/** Derived count of custom names parsed from the textarea. */
const parsedNameCount = computed(() => {
    if (!store.customNamesRaw.trim()) return 0;
    return store.customNamesRaw
        .split(/[\n,]+/)
        .map(n => n.trim())
        .filter(n => n.length > 0).length;
});

/** True when custom names are set but not enough for all players. */
const notEnoughNames = computed(() =>
    parsedNameCount.value > 0 && parsedNameCount.value < players.value.length
);
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

    <!-- Bot Section -->
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

    <!-- Custom Names (host only) -->
    <div v-if="isHost" class="custom-names-section">
        <h3>Custom Identities (optional)</h3>
        <p class="hint">Enter names to use as secret identities instead of the default Wikipedia list. One name per line or comma-separated.</p>
        <textarea
            v-model="store.customNamesRaw"
            placeholder="e.g. Batman, Sherlock Holmes, Albert Einstein"
            rows="5"
        ></textarea>
        <p class="name-count" v-if="parsedNameCount > 0">
            {{ parsedNameCount }} name{{ parsedNameCount !== 1 ? 's' : '' }} entered
            <span v-if="notEnoughNames" class="warn">
                — need at least {{ players.length }} for {{ players.length }} players
            </span>
        </p>
    </div>

    <div v-if="isHost" class="controls">
      <button
        @click="startGame"
        :disabled="players.length < 2 || notEnoughNames"
      >
        Start Game
      </button>
      <p v-if="players.length < 2">Need at least 2 players</p>
      <p v-if="notEnoughNames" class="warn">Not enough custom names for all players</p>
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
  max-width: 600px;
  margin: 0 auto;
  padding: 1.5rem;
}
ul {
  list-style: none;
  padding: 0;
}
li {
  font-size: 1.1rem;
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

/* Custom names section */
.custom-names-section {
    margin-top: 2rem;
    padding: 1rem;
    border-top: 1px solid var(--border-color);
    text-align: left;
}
.custom-names-section h3 {
    text-align: center;
}
.hint {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
    text-align: center;
}
textarea {
    width: 100%;
    padding: 0.65rem 0.75rem;
    background: var(--bg-color);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.9rem;
    resize: vertical;
    box-sizing: border-box;
}
textarea:focus {
    outline: none;
    border-color: var(--primary-color);
}
.name-count {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin-top: 0.4rem;
    text-align: center;
}
.warn {
    color: #f59e0b;
    font-weight: 600;
}
</style>
