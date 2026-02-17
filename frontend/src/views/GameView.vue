<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useGameStore } from '../stores/game';

const store = useGameStore();

const question = ref('');
const guess = ref('');
const activeAction = ref<'QUESTION' | 'GUESS'>('QUESTION');

const myTurn = computed(() => store.currentTurn === store.myId);
const currentTurnName = computed(() => {
    const p = store.players.find((p: any) => p.id === store.currentTurn);
    return p ? p.name : 'Unknown';
});

const submit = () => {
    if (activeAction.value === 'QUESTION') {
        if (!question.value) return;
        store.submitAction('QUESTION', question.value);
        question.value = '';
    } else {
        if (!guess.value) return;
        store.submitAction('GUESS', guess.value);
        guess.value = '';
    }
};

// Scroll logs
watch(() => store.logs.length, () => {
    const logsContainer = document.querySelector('.sidebar');
    if (logsContainer) logsContainer.scrollTop = logsContainer.scrollHeight;
});

onMounted(() => {
    // If not connected, redirect or reconnect? 
    // Store handles connection in App.vue usually.
});
</script>

<template>
  <div class="game">
    <div class="sidebar">
        <h3>Game Log</h3>
        <div class="logs">
            <div v-for="(log, i) in store.logs" :key="i" class="log-entry">
                <strong>{{ log.result }}</strong>
                <p>{{ log.action }}: {{ log.content }}</p>
                <div v-if="log.correct" class="correct">CORRECT!</div>
            </div>
        </div>
    </div>
    
    <div class="main">
        <div class="turn-indicator" :class="{ myTurn: myTurn }">
            Current Turn: {{ myTurn ? 'YOUR TURN' : currentTurnName }}
        </div>

        <div class="opponents">
            <!-- Ensure players exist -->
            <div v-for="player in store.players" :key="player.id" class="player-card">
                <div v-if="player.id !== store.myId">
                    <h4>{{ player.name }}</h4>
                    <!-- Show identity of OTHER players -->
                    <div v-if="player.secretIdentity" class="identity">
                        <img v-if="player.secretIdentity.image" :src="player.secretIdentity.image" alt="Identity" class="id-img" />
                        <p>{{ player.secretIdentity.title }}</p>
                        <!-- Show summary tooltip or expandable? -->
                        <details>
                            <summary>Details</summary>
                            <p class="summary">{{ player.secretIdentity.summary }}</p>
                        </details>
                    </div>
                    <div v-else>Identity Hidden</div>
                </div>
            </div>
        </div>

        <div v-if="myTurn" class="actions">
            <div class="tabs">
                <button :class="{ active: activeAction === 'QUESTION' }" @click="activeAction = 'QUESTION'">Ask Question</button>
                <button :class="{ active: activeAction === 'GUESS' }" @click="activeAction = 'GUESS'">Make Guess</button>
            </div>
            
            <div class="input-area">
                <input v-if="activeAction === 'QUESTION'" v-model="question" placeholder="Is it an animal?" @keyup.enter="submit" />
                <input v-else v-model="guess" placeholder="Lion" @keyup.enter="submit" />
                <button @click="submit">Submit</button>
            </div>
        </div>
        <div v-else class="waiting">
            Waiting for {{ currentTurnName }}...
        </div>
    </div>
  </div>
</template>

<style scoped>
.game {
    display: flex;
    height: 80vh;
    gap: 1rem;
}
.sidebar {
    width: 250px;
    border-right: 1px solid #ddd;
    overflow-y: auto;
    padding-right: 1rem;
}
.logs {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
.log-entry {
    border-bottom: 1px solid #eee;
    padding-bottom: 0.5rem;
}
.correct {
    color: green;
    font-weight: bold;
}
.main {
    flex: 1;
    display: flex;
    flex-direction: column;
}
.opponents {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    overflow-y: auto;
}
.player-card {
    border: 1px solid #eee;
    padding: 1rem;
    margin: 0.5rem;
    border-radius: 8px;
    text-align: center;
    width: 200px;
}
.id-img {
    width: 100px;
    height: 100px;
    object-fit: cover;
    border-radius: 50%;
}
.summary {
    font-size: 0.8rem;
    text-align: left;
    height: 100px;
    overflow-y: auto;
}
.turn-indicator {
    padding: 1rem;
    background: #f0f0f0;
    text-align: center;
    font-size: 1.5rem;
    margin-bottom: 1rem;
    border-radius: 8px;
}
.myTurn {
    background: #e6fffa;
    color: #006b5f;
    font-weight: bold;
    border: 2px solid #006b5f;
}
.actions {
    margin-top: auto;
    padding: 1rem;
    background: #fafafa;
    border-top: 1px solid #ddd;
}
.tabs {
    margin-bottom: 1rem;
}
.tabs button {
    margin-right: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    background: #ddd;
    cursor: pointer;
}
.tabs button.active {
    background: #333;
    color: white;
}
.input-area {
    display: flex;
    gap: 0.5rem;
}
input {
    flex: 1;
    padding: 0.5rem;
}
.waiting {
    margin-top: auto;
    padding: 1rem;
    text-align: center;
    font-style: italic;
    color: #666;
}
</style>
