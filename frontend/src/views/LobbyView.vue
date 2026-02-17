<script setup lang="ts">
import { computed, ref } from 'vue';
import { useUser } from '@clerk/vue';
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
    
    <div class="invite-section">
        <h3>Invite Players</h3>
        <p>Share Room Code: <strong>{{ roomId }}</strong></p>
        <div class="invite-form">
            <input v-model="inviteTarget" placeholder="User ID to invite" />
            <button @click="handleInvite">Send Invite</button>
        </div>
        <p v-if="inviteStatus">{{ inviteStatus }}</p>
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
.invite-section {
    margin-top: 2rem;
    padding: 1rem;
    border-top: 1px solid #eee;
}
.invite-form {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1rem;
}
input {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
}
</style>
