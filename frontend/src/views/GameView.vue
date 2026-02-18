<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';

const router = useRouter();

const store = useGameStore();

const question = ref('');
const guess = ref('');
const activeAction = ref<'QUESTION' | 'GUESS'>('QUESTION');
const showExitModal = ref(false);
const isExiting = ref(false);

const myTurn = computed(() => store.currentTurn === store.myId);
const currentTurnName = computed(() => {
    const p = store.players.find((p: any) => p.id === store.currentTurn);
    return p ? p.name : 'Unknown';
});

const opponents = computed(() => store.players.filter((p: any) => p.id !== store.myId));

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

const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (store.gameState === 'PLAYING') {
        e.preventDefault();
        e.returnValue = '';
    } else if (store.gameState === 'LOBBY' && store.myId === store.players[0]?.id) {
         // Host leaving lobby
         e.preventDefault();
         e.returnValue = '';
    }
};

const goHome = () => {
    isExiting.value = true;
    router.push('/');
};

const confirmExit = () => {
    isExiting.value = true;
    router.push('/');
};

onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    // If not connected, redirect or reconnect? 
    // Store handles connection in App.vue usually.
});

onUnmounted(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
});

onBeforeRouteLeave((to, from, next) => {
    if (store.gameState === 'PLAYING') {
        const answer = window.confirm('Are you sure you want to leave the game? You will be removed from the room.');
        if (answer) {
            next();
        } else {
            next(false);
        }
    } else if (store.gameState === 'LOBBY' && store.myId === store.players[0]?.id) {
        const answer = window.confirm('You are the host. If you leave, the game will be cancelled for everyone. Are you sure?');
        if (answer) {
             next();
        } else {
             next(false);
        }
    } else {
        next();
    }
});
</script>

<template>
  <div class="game">
    <!-- Game Over Modal -->
    <div v-if="store.gameState === 'ENDED'" class="modal-overlay">
        <div class="modal">
            <h2>Game Over!</h2>
            <h3 v-if="store.winner">Winner: {{ store.winner.name }}</h3>
            
            <div class="results-grid">
                <div v-for="player in store.players" :key="player.id" class="result-card" :class="{ winner: player.id === store.winner?.id }">
                    <img v-if="player.secretIdentity?.image" :src="player.secretIdentity.image" class="result-img" />
                    <div class="result-info">
                        <h4>{{ player.name }}</h4>
                        <p class="role">{{ player.secretIdentity?.title || 'Unknown' }}</p>
                    </div>
                </div>
            </div>

            <button class="home-btn" @click="goHome">Back to Home</button>
        </div>
    </div>

    <!-- Exit Confirmation Modal -->
    <div v-if="showExitModal" class="modal-overlay">
        <div class="modal">
            <h2>Leave Game?</h2>
            <p class="modal-text">
                {{ store.myId === store.players[0]?.id && store.gameState === 'LOBBY' 
                    ? 'You are the host. The game will be cancelled for everyone.' 
                    : 'Are you sure you want to leave? You will be removed from the room.' 
                }}
            </p>
            <div class="modal-actions">
                <button class="cancel-btn" @click="showExitModal = false">Cancel</button>
                <button class="confirm-btn" @click="confirmExit">Leave Game</button>
            </div>
        </div>
    </div>

    <div class="sidebar">
        <h3>Game Log</h3>
        <div class="logs">
            <div v-for="(log, i) in store.logs" :key="i" class="log-entry">
                <strong>{{ log.result }}</strong>
                <p>{{ log.action }}: {{ log.content }}</p>
                <div v-if="log.correct" class="correct">CORRECT!</div>
            </div>
        </div>
        <button class="exit-btn" @click="showExitModal = true">Exit Game</button>
    </div>
    
    <div class="main">
        <div class="turn-indicator" :class="{ myTurn: myTurn }">
            Current Turn: {{ myTurn ? 'YOUR TURN' : currentTurnName }}
        </div>

        <div class="opponents">
            <div v-for="player in opponents" :key="player.id" class="player-card">
                <h4>{{ player.name }}</h4>
                <div v-if="player.secretIdentity" class="identity">
                    <img v-if="player.secretIdentity.image" :src="player.secretIdentity.image" alt="Identity" class="id-img" />
                    <p class="id-title">{{ player.secretIdentity.title }}</p>
                    <details>
                        <summary>Read Bio</summary>
                        <p class="summary">{{ player.secretIdentity.summary }}</p>
                    </details>
                </div>
                <div v-else class="identity filtered">
                     <span class="icon">❓</span>
                     <p>Identity Hidden</p>
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
                <input v-else v-model="guess" placeholder="e.g. Batman" @keyup.enter="submit" />
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
    height: 90vh;
    width: 98vw;
    margin: 0 auto;
    gap: 1rem;
    color: var(--text-primary);
}
.sidebar {
    width: 250px;
    border-right: 1px solid var(--border-color);
    overflow-y: auto;
    padding-right: 1rem;
}
.logs {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
.log-entry {
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.5rem;
}
.correct {
    color: var(--primary-color);
    font-weight: bold;
}
.main {
    flex: 1;
    display: flex;
    flex-direction: column;
}
.opponents {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    overflow-y: auto;
    padding: 1rem;
}
.player-card {
    border: 1px solid var(--border-color);
    padding: 1rem;
    border-radius: 12px;
    text-align: center;
    background: var(--surface-color);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
}
.player-card:hover {
    transform: translateY(-2px);
    border-color: var(--primary-color);
}
.player-card h4 {
    color: var(--primary-color);
    font-size: 1.1rem;
    margin: 0;
}
.id-img {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: 50%;
    border: 2px solid var(--border-color);
}
.id-title {
    font-weight: 700;
    font-size: 1.1rem;
    margin: 0.5rem 0;
    color: var(--text-primary);
}
.summary {
    font-size: 0.9rem;
    text-align: left;
    min-height: 100px;
    color: var(--text-secondary);
    white-space: pre-wrap;
}
.turn-indicator {
    padding: 1rem;
    background: var(--surface-color);
    text-align: center;
    font-size: 1.5rem;
    margin-bottom: 1rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
}
.myTurn {
    background: rgba(16, 185, 129, 0.1);
    color: var(--primary-color);
    font-weight: bold;
    border: 2px solid var(--primary-color);
    box-shadow: 0 0 15px rgba(16, 185, 129, 0.2);
}
.actions {
    margin-top: auto;
    padding: 1rem;
    background: var(--surface-color);
    border-top: 1px solid var(--border-color);
    border-radius: 8px 8px 0 0;
}
.tabs {
    margin-bottom: 1rem;
}
.tabs button {
    margin-right: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    background: var(--surface-hover);
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 4px;
}
.tabs button.active {
    background: var(--primary-color);
    color: #0f172a;
    border-color: var(--primary-color);
    font-weight: bold;
    font-size: 0.9rem;
}
.input-area {
    display: flex;
    gap: 0.5rem;
}
input {
    flex: 1;
    padding: 0.8rem;
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    border-radius: 4px;
}
input:focus {
    outline: none;
    border-color: var(--primary-color);
}
.input-area button {
    padding: 0.8rem 1.5rem;
    background: var(--primary-color);
    border: none;
    border-radius: 4px;
    color: #0f172a;
    font-weight: bold;
    cursor: pointer;
}
.waiting {
    margin-top: auto;
    padding: 1rem;
    text-align: center;
    font-style: italic;
    color: var(--text-secondary);
}

/* Modal Styles */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}
.modal {
    background: var(--surface-color);
    padding: 2rem;
    border-radius: 12px;
    max-width: 800px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    text-align: center;
    border: 1px solid var(--border-color);
    color: var(--text-primary);
}
.modal h2 {
    color: var(--primary-color);
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
}
.modal h3 {
    margin-bottom: 2rem;
    font-size: 1.5rem;
}
.results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
}
.result-card {
    background: var(--bg-color);
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    align-items: center;
}
.result-card.winner {
    border-color: var(--primary-color);
    box-shadow: 0 0 15px rgba(16, 185, 129, 0.3);
}
.result-img {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    margin-bottom: 0.5rem;
}
.result-info h4 {
    margin: 0;
    color: var(--text-primary);
}
.role {
    color: var(--primary-color);
    font-weight: bold;
    font-size: 0.9rem;
}
.home-btn {
    padding: 1rem 2rem;
    font-size: 1.2rem;
    background: var(--primary-color);
    border: none;
    border-radius: 8px;
    color: #0f172a;
    font-weight: bold;
    cursor: pointer;
}

@media (max-width: 768px) {
    .game {
        flex-direction: column;
        height: auto;
        min-height: 100vh;
        width: 100%;
        padding: 1rem;
    }

    .sidebar {
        width: 100%;
        height: 200px;
        border-right: none;
        border-bottom: 1px solid var(--border-color);
        margin-bottom: 1rem;
    }

    .main {
        width: 100%;
    }

    .opponents {
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 0.5rem;
    }
    
    .player-card {
        padding: 0.8rem;
    }
    
    .id-img {
        width: 60px;
        height: 60px;
    }
}
</style>
